import { describe, expect, it } from 'vitest'
import type { DamageType, Material } from '@gene/data'
import { createRng } from './rng'
import { rollDamage, type AttackContext } from './combat/formulas'
import { spawnMonster } from './monsters'
import { arenaGame, newTestGame } from './testing'
import { player, type GameState } from './state'
import { applyCommand } from './game'
import { resolveAttack, type ChosenAttack } from './combat/attack'
import type { Ctx } from './context'
import type { GameEvent } from './events'

function damageAgainst(type: DamageType, material: Material): number {
  const s = newTestGame(1)
  const p = player(s)
  const target = spawnMonster(s, 'goblin_brute', p.depth, p.x + 1, p.y)
  const part = target.parts.find((x) => x.defId === 'torso')!
  part.material = material
  const ctx: AttackContext = {
    attacker: p,
    target,
    attack: { damage: 20, accuracy: 0, damageType: type, skill: 'fighting', partTag: 'grasp' },
    attackerSkill: 0,
    attackerFighting: 0,
    targetDodging: 0,
    targetEvasion: 0,
    part,
  }
  const rng = createRng(9)
  let total = 0
  for (let i = 0; i < 200; i++) total += rollDamage(rng, ctx)
  return total
}

describe('магические типы урона: множители по материалу', () => {
  it('огонь бьёт органику сильнее обычного удара, бионику — как обычный', () => {
    expect(damageAgainst('fire', 'organic') / damageAgainst('blunt', 'organic')).toBeCloseTo(1.5, 1)
    expect(damageAgainst('fire', 'bionic')).toBe(damageAgainst('blunt', 'bionic'))
  })

  it('молния бьёт бионику сильнее обычного удара, органику — как обычный', () => {
    expect(damageAgainst('lightning', 'bionic') / damageAgainst('blunt', 'bionic')).toBeCloseTo(1.5, 1)
    expect(damageAgainst('lightning', 'organic')).toBe(damageAgainst('blunt', 'organic'))
  })

  it('холод не даёт лишнего урона ни по органике, ни по бионике', () => {
    for (const m of ['organic', 'bionic'] as Material[]) expect(damageAgainst('cold', m)).toBe(damageAgainst('blunt', m))
  })
})

/** Меткая атака заданного типа (заклинаний ещё нет — тип урона задаётся напрямую). */
function magicAttack(damageType: DamageType): ChosenAttack {
  return {
    profile: { damage: 20, accuracy: 100, damageType, skill: 'fighting', partTag: 'grasp' },
    ref: { kind: 'natural', attackId: 'fist', damageType },
  }
}

function coldHitOnPlayer(s: GameState): GameEvent[] {
  const p = player(s)
  const attacker = spawnMonster(s, 'goblin_brute', p.depth, p.x + 1, p.y)
  const ctx: Ctx = { state: s, events: [] }
  while (!ctx.events.some((e) => e.type === 'attackHit' && e.damage > 0)) resolveAttack(ctx, attacker, p, magicAttack('cold'))
  delete s.creatures[attacker.id]
  return ctx.events
}

describe('холод замедляет цель', () => {
  it('под холодом игрок ходит реже, затем эффект проходит с сообщением', () => {
    let s = arenaGame(3)
    const events = coldHitOnPlayer(s)
    expect(events).toContainEqual({ type: 'creatureSlowed', creature: { id: s.playerId, kind: 'player' } })

    const costs: number[] = []
    let ended = -1
    for (let i = 0; i < 20; i++) {
      const before = player(s).nextActAt
      const r = applyCommand(s, { type: 'wait' })
      s = r.state
      costs.push(player(s).nextActAt - before)
      if (ended < 0 && r.events.some((e) => e.type === 'slowEnded' && e.creature.id === s.playerId)) ended = i
    }
    expect(costs[0]).toBeGreaterThan(costs[costs.length - 1]!)
    expect(ended).toBeGreaterThan(0)
    expect(costs.slice(ended + 1).every((c) => c === costs[costs.length - 1])).toBe(true)
    expect(player(s).slowedUntil).toBeUndefined()
  })

  it('огонь и молния не замедляют', () => {
    for (const type of ['fire', 'lightning'] as DamageType[]) {
      const s = arenaGame(3)
      const p = player(s)
      const m = spawnMonster(s, 'goblin_brute', p.depth, p.x + 1, p.y)
      const ctx: Ctx = { state: s, events: [] }
      for (let i = 0; i < 10; i++) resolveAttack(ctx, m, p, magicAttack(type))
      expect(ctx.events.some((e) => e.type === 'creatureSlowed')).toBe(false)
      expect(p.slowedUntil).toBeUndefined()
    }
  })
})
