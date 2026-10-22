import { describe, expect, it } from 'vitest'
import { resolveAttack } from './combat/attack'
import { spawnMonster } from './monsters'
import { arenaGame, newTestGame, run } from './testing'
import { player, type Creature, type GameState } from './state'
import type { Ctx } from './context'
import type { GameEvent } from './events'
import { sceneMoments } from './scene'

type Hit = Extract<GameEvent, { type: 'attackHit' }>

function sturdyGoblin(s: GameState): Creature {
  const p = player(s)
  const g = spawnMonster(s, 'goblin_brute', p.depth, p.x + 1, p.y)
  g.hp = 1_000_000
  for (const part of g.parts) part.hp = part.maxHp = 1_000_000
  return g
}

function hits(s: GameState, attacker: Creature, target: Creature, n = 200): Hit[] {
  const ctx: Ctx = { state: s, events: [] }
  for (let i = 0; i < n; i++) resolveAttack(ctx, attacker, target)
  return ctx.events.filter((e): e is Hit => e.type === 'attackHit' && e.damage > 0)
}

describe('сильный удар', () => {
  it('помечается, когда урон не меньше порога от максимума HP цели', () => {
    const s = newTestGame(3)
    const g = sturdyGoblin(s)
    g.maxHp = 1
    const hs = hits(s, player(s), g)
    expect(hs.length).toBeGreaterThan(0)
    expect(hs.every((e) => e.strong === true)).toBe(true)
  })

  it('слабый удар без тяжёлой раны не помечается', () => {
    const s = newTestGame(3)
    const g = sturdyGoblin(s)
    g.maxHp = 1_000_000
    const hs = hits(s, player(s), g)
    expect(hs.length).toBeGreaterThan(0)
    expect(hs.some((e) => e.strong)).toBe(false)
  })

  it('удар, переводящий часть тела в тяжёлую стадию, — сильный при любом уроне', () => {
    const s = newTestGame(3)
    const g = sturdyGoblin(s)
    g.maxHp = 1_000_000
    // Каждая часть на волосок выше «искалечена»: любое попадание калечит.
    for (const part of g.parts) {
      part.maxHp = 1000
      part.hp = 251
    }
    const [first] = hits(s, player(s), g, 50)
    expect(first?.strong).toBe(true)
  })
})

describe('первая встреча с видом', () => {
  it('событие только при первом появлении вида в поле зрения', () => {
    const s = arenaGame(1)
    spawnMonster(s, 'goblin_brute', 1, 23, 20)
    const first = run(s, [{ type: 'wait' }])
    expect(first.events.filter((e) => e.type === 'speciesDiscovered')).toEqual([
      { type: 'speciesDiscovered', kind: 'goblin_brute' },
    ])
    spawnMonster(first.state, 'goblin_brute', 1, 17, 20)
    const second = run(first.state, [{ type: 'wait' }])
    expect(second.events.some((e) => e.type === 'speciesDiscovered')).toBe(false)
  })
})

describe('моменты для сцены', () => {
  const me = { id: 'p', kind: 'player' }
  const gob = { id: 'm1', kind: 'goblin_brute' }

  it('смерть монстра от руки игрока, сильные удары игрока и по игроку, встреча', () => {
    const hit = (attacker: typeof me, target: typeof me, strong: boolean): GameEvent => ({
      type: 'attackHit',
      attacker,
      target,
      attack: { kind: 'natural', attackId: 'fist', damageType: 'blunt' },
      partId: 'head',
      partMaterial: 'organic',
      damage: 5,
      absorbed: 0,
      severity: 'medium',
      ...(strong ? { strong: true } : {}),
    })
    const events: GameEvent[] = [
      { type: 'speciesDiscovered', kind: 'hyena' },
      hit(me, gob, false),
      hit(me, gob, true),
      hit(gob, me, true),
      { type: 'creatureDied', creature: gob, killer: me, cause: 'hp' },
      { type: 'creatureDied', creature: { id: 'm2', kind: 'hyena' }, cause: 'hp' },
    ]
    expect(sceneMoments(events, 'p')).toEqual([
      { kind: 'encounter', species: 'hyena' },
      { kind: 'strongHit', species: 'goblin_brute', byPlayer: true },
      { kind: 'strongHit', species: 'goblin_brute', byPlayer: false },
      { kind: 'death', species: 'goblin_brute' },
    ])
  })
})
