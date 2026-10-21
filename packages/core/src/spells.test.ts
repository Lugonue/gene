import { describe, expect, it } from 'vitest'
import { fizzleChance, recoverFatigue, spellCooldown } from './combat/formulas'
import { monsterTurn } from './ai'
import { applyCommand } from './game'
import { spawnMonster } from './monsters'
import { arenaGame } from './testing'
import { player, type Creature, type GameState } from './state'
import type { Ctx } from './context'
import type { GameEvent } from './events'

describe('усталость мага: формулы', () => {
  it('с ростом усталости растут шанс срыва и перезарядка', () => {
    const levels = [0, 1, 2, 4, 6]
    const chances = levels.map(fizzleChance)
    const cooldowns = levels.map((f) => spellCooldown(40, f))
    for (let i = 1; i < levels.length; i++) {
      expect(chances[i]).toBeGreaterThan(chances[i - 1]!)
      expect(cooldowns[i]).toBeGreaterThan(cooldowns[i - 1]!)
    }
    expect(cooldowns[0]).toBe(40)
    expect(chances[0]).toBeGreaterThan(0)
    expect(chances[chances.length - 1]).toBeLessThan(1)
  })

  it('со временем усталость спадает до нуля', () => {
    expect(recoverFatigue(3, 0)).toBe(3)
    expect(recoverFatigue(3, 60)).toBeLessThan(3)
    expect(recoverFatigue(3, 60)).toBeGreaterThan(recoverFatigue(3, 120))
    expect(recoverFatigue(3, 100_000)).toBe(0)
  })
})

function waitTurns(s: GameState, n: number): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  for (let i = 0; i < n; i++) {
    const r = applyCommand(s, { type: 'wait' })
    s = r.state
    events.push(...r.events)
  }
  return { state: s, events }
}

/** Один ход монстра c с усталостью fatigue и готовыми заклинаниями. */
function castTurn(s: GameState, c: Creature, fatigue: number): Ctx {
  c.magic = { fatigue, fatigueAt: s.now, readyAt: {} }
  const ctx: Ctx = { state: s, events: [] }
  monsterTurn(ctx, c)
  return ctx
}

const isAttackOn = (e: GameEvent, id: string): boolean =>
  (e.type === 'attackHit' || e.type === 'attackMissed') && e.target.id === id

describe('заклинания монстров: ход мага', () => {
  it('маг на дистанции колдует снаряд в игрока; чем выше усталость, тем дольше перезарядка', () => {
    const cooldownAt = (fatigue: number): number => {
      for (let seed = 1; seed < 50; seed++) {
        const s = arenaGame(seed)
        const m = spawnMonster(s, 'sorcerer', 1, 25, 20)
        const { events } = castTurn(s, m, fatigue)
        if (!events.some((e) => e.type === 'spellCast')) continue
        expect(events).toContainEqual(
          expect.objectContaining({ type: 'spellCast', spellId: 'frost_bolt', target: { id: s.playerId, kind: 'player' } }),
        )
        expect(events.some((e) => isAttackOn(e, s.playerId))).toBe(true)
        expect(m.magic!.fatigue).toBeGreaterThan(fatigue)
        return m.magic!.readyAt.frost_bolt! - s.now
      }
      throw new Error('маг так и не колдовал')
    }
    expect(cooldownAt(3)).toBeGreaterThan(cooldownAt(0))
  })

  it('срыв тратит ход и перезарядку и не даёт эффекта', () => {
    for (let seed = 1; seed < 200; seed++) {
      const s = arenaGame(seed)
      const p = player(s)
      const m = spawnMonster(s, 'goblin_shaman', 1, 25, 20)
      const before = m.nextActAt
      const ctx = castTurn(s, m, 6)
      const { events } = ctx
      if (!events.some((e) => e.type === 'spellFizzled')) continue
      expect(events).toContainEqual({ type: 'spellFizzled', caster: { id: m.id, kind: m.kind }, spellId: 'fireball' })
      expect(events.some((e) => e.type === 'spellCast' || isAttackOn(e, p.id))).toBe(false)
      expect(p.hp).toBe(p.maxHp)
      expect(m.nextActAt).toBeGreaterThan(before)
      expect(m.magic!.readyAt.fireball).toBeGreaterThan(s.now)
      expect(ctx.projectiles).toBeUndefined()
      return
    }
    throw new Error('срыв так и не случился')
  })

  it('маг лечит раненого союзника в поле зрения', () => {
    const s = arenaGame(2)
    const mage = spawnMonster(s, 'sorcerer', 1, 26, 20)
    const ally = spawnMonster(s, 'templar', 1, 27, 22)
    ally.nextActAt = Number.POSITIVE_INFINITY
    ally.hp = Math.ceil(ally.maxHp * 0.3)
    const hpBefore = ally.hp
    const r = waitTurns(s, 10)
    expect(r.events).toContainEqual(
      expect.objectContaining({
        type: 'spellCast',
        caster: { id: mage.id, kind: 'sorcerer' },
        spellId: 'heal',
        target: { id: ally.id, kind: 'templar' },
      }),
    )
    expect(r.state.creatures[ally.id]!.hp).toBeGreaterThan(hpBefore + 5)
  })

  it('маг не колдует через союзника на линии огня', () => {
    let s = arenaGame(3)
    const ally = spawnMonster(s, 'templar', 1, 23, 20)
    ally.nextActAt = Number.POSITIVE_INFINITY
    const mage = spawnMonster(s, 'sorcerer', 1, 26, 20)
    const first = castTurn(s, mage, 0).events
    expect(first.some((e) => e.type === 'spellCast')).toBe(false)

    const r = waitTurns(s, 30)
    s = r.state
    expect(r.events.some((e) => isAttackOn(e, ally.id))).toBe(false)
    expect(r.events.some((e) => e.type === 'spellCast' && e.target.id === s.playerId)).toBe(true)
  })
})
