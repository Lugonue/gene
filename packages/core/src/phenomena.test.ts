import { describe, expect, it } from 'vitest'
import { SPELLS } from '@gene/data'
import { castSpell } from './combat/spells'
import { PHENOMENON_GAIN, PHENOMENON_THRESHOLDS, phenomenonStatusFor } from './combat/formulas'
import { spawnMonster } from './monsters'
import { arenaGame } from './testing'
import { buildView, playerVisibleCells } from './view'
import { partsWithTag } from './body'
import { player, type GameState } from './state'
import type { Ctx } from './context'
import type { GameEvent } from './events'

const dataOf = (s: GameState, id: string): number => s.knowledge.phenomena?.[id as 'fireball']?.data ?? 0

/** Колдовство kind по игроку с дистанции; ищет сид, где исход подходит под want. */
function castAtPlayer(
  kind: string,
  spellId: string,
  want: (events: GameEvent[]) => boolean,
): { state: GameState; events: GameEvent[] } {
  for (let seed = 1; seed < 200; seed++) {
    const s = arenaGame(seed)
    const m = spawnMonster(s, kind, 1, 24, 20)
    const ctx: Ctx = { state: s, events: [] }
    castSpell(ctx, m, SPELLS[spellId]!, player(s))
    if (want(ctx.events)) return { state: s, events: ctx.events }
  }
  throw new Error('не нашли подходящий сид')
}

const fizzled = (ev: GameEvent[]): boolean => ev.some((e) => e.type === 'spellFizzled')
const hitPlayer = (ev: GameEvent[]): boolean =>
  ev.some((e) => e.type === 'attackHit' && e.target.kind === 'player')
const missedPlayer = (ev: GameEvent[]): boolean =>
  ev.some((e) => e.type === 'attackMissed' && e.target.kind === 'player')

describe('явления: источники данных', () => {
  it('наблюдение заклинания даёт немного данных и фиксирует неизвестное явление', () => {
    const { state, events } = castAtPlayer('sorcerer', 'frost_bolt', missedPlayer)
    expect(dataOf(state, 'frost_bolt')).toBe(PHENOMENON_GAIN.observe)
    expect(events).toContainEqual({ type: 'phenomenonDiscovered', phenomenon: 'frost_bolt', n: 1 })
  })

  it('попадание по киборгу даёт больше данных, чем наблюдение', () => {
    const { state } = castAtPlayer('sorcerer', 'frost_bolt', hitPlayer)
    expect(PHENOMENON_GAIN.hit).toBeGreaterThan(PHENOMENON_GAIN.observe)
    expect(dataOf(state, 'frost_bolt')).toBe(PHENOMENON_GAIN.observe + PHENOMENON_GAIN.hit)
  })

  it('сорвавшееся заклинание даёт немного данных', () => {
    const { state } = castAtPlayer('sorcerer', 'frost_bolt', fizzled)
    expect(PHENOMENON_GAIN.fizzle).toBeLessThan(PHENOMENON_GAIN.hit)
    expect(dataOf(state, 'frost_bolt')).toBe(PHENOMENON_GAIN.fizzle)
  })

  it('невидимое игроку колдовство данных не даёт', () => {
    const s = arenaGame(1)
    const mage = spawnMonster(s, 'sorcerer', 1, 60, 30)
    const ally = spawnMonster(s, 'templar', 1, 61, 30)
    ally.hp = 1
    const ctx: Ctx = { state: s, events: [] }
    castSpell(ctx, mage, SPELLS.heal!, ally)
    expect(s.knowledge.phenomena?.heal).toBeUndefined()
    expect(ctx.events.some((e) => e.type === 'phenomenonDiscovered')).toBe(false)
  })

  it('огненный шар разных заклинателей и огненный плевок копят одну шкалу', () => {
    const s = arenaGame(3)
    for (const [kind, spellId] of [
      ['goblin_shaman', 'fireball'],
      ['dragon_priest', 'fireball'],
      ['dragonborn', 'fire_spit'],
    ] as const) {
      const before = dataOf(s, 'fireball')
      const m = spawnMonster(s, kind, 1, 24, 20)
      castSpell({ state: s, events: [] }, m, SPELLS[spellId]!, player(s))
      delete s.creatures[m.id]
      expect(dataOf(s, 'fireball')).toBeGreaterThan(before)
    }
    expect(Object.keys(s.knowledge.phenomena ?? {})).toEqual(['fireball'])
  })

  it('невидимый заклинатель: промах по киборгу данных не даёт, попадание — только за попадание', () => {
    const cast = (want: (ev: GameEvent[]) => boolean): GameState => {
      for (let seed = 1; seed < 200; seed++) {
        const s = arenaGame(seed)
        const p = player(s)
        // Покалеченное зрение сужает обзор: маг за его пределами, но снаряд долетает.
        for (const part of partsWithTag(p, 'vision')) part.wound = 'severed'
        const m = spawnMonster(s, 'sorcerer', 1, p.x + 6, p.y)
        expect(playerVisibleCells(s).has(m.y * s.levels[1]!.width + m.x)).toBe(false)
        const ctx: Ctx = { state: s, events: [] }
        castSpell(ctx, m, SPELLS.frost_bolt!, p)
        if (want(ctx.events)) return s
      }
      throw new Error('не нашли подходящий сид')
    }
    expect(dataOf(cast(missedPlayer), 'frost_bolt')).toBe(0)
    expect(dataOf(cast(hitPlayer), 'frost_bolt')).toBe(PHENOMENON_GAIN.hit)
  })
})

describe('явления: стадии и рецепт', () => {
  it('пороги: неизвестно → частично → изучено', () => {
    expect(phenomenonStatusFor(0)).toBe('unknown')
    expect(phenomenonStatusFor(PHENOMENON_THRESHOLDS.partial - 0.01)).toBe('unknown')
    expect(phenomenonStatusFor(PHENOMENON_THRESHOLDS.partial)).toBe('partial')
    expect(phenomenonStatusFor(PHENOMENON_THRESHOLDS.known)).toBe('known')
  })

  it('каждый переход стадии сообщается, изученное явление открывает рецепт', () => {
    const s = arenaGame(1)
    const events: GameEvent[] = []
    for (let i = 0; i < 400 && phenomenonStatusFor(dataOf(s, 'lightning')) !== 'known'; i++) {
      const m = spawnMonster(s, 'orc_warshaman', 1, 24, 20)
      const ctx: Ctx = { state: s, events: [] }
      castSpell(ctx, m, SPELLS.lightning!, player(s))
      events.push(...ctx.events)
      delete s.creatures[m.id]
    }
    const study = events.filter(
      (e) =>
        e.type === 'phenomenonDiscovered' ||
        e.type === 'phenomenonStudyChanged' ||
        e.type === 'recipeUnlocked',
    )
    expect(study).toEqual([
      { type: 'phenomenonDiscovered', phenomenon: 'lightning', n: 1 },
      { type: 'phenomenonStudyChanged', phenomenon: 'lightning', n: 1, status: 'partial' },
      { type: 'phenomenonStudyChanged', phenomenon: 'lightning', n: 1, status: 'known' },
      { type: 'recipeUnlocked', phenomenon: 'lightning' },
    ])
  })
})

describe('явления в PlayerView', () => {
  it('неизученное явление показано под условным именем, без настоящего названия и id', () => {
    const s = arenaGame(1)
    s.knowledge.phenomena = { fireball: { data: PHENOMENON_THRESHOLDS.partial, n: 1 } }
    const [ph, ...rest] = buildView(s).phenomena
    expect(rest).toEqual([])
    expect(ph).toMatchObject({
      n: 1,
      status: 'partial',
      progress: PHENOMENON_THRESHOLDS.partial / PHENOMENON_THRESHOLDS.known,
    })
    expect(ph!.name).toMatch(/№1/)
    expect(ph!.recipe).toBeUndefined()
    const json = JSON.stringify(ph)
    expect(json).not.toMatch(/огнен|шар|fireball/i)
  })

  it('изученное явление — настоящее название и описание открытого рецепта', () => {
    const s = arenaGame(1)
    s.knowledge.phenomena = { fireball: { data: PHENOMENON_THRESHOLDS.known + 5, n: 2 } }
    const [ph] = buildView(s).phenomena
    expect(ph).toMatchObject({ n: 2, status: 'known', progress: 1, name: 'огненный шар' })
    expect(ph!.recipe?.name).toMatch(/поджог оружия/i)
    expect(ph!.recipe?.description).toBeTruthy()
  })

  it('старое сохранение без явлений — пустой список', () => {
    const s = arenaGame(1)
    delete s.knowledge.phenomena
    expect(buildView(s).phenomena).toEqual([])
  })
})
