import { describe, expect, it } from 'vitest'
import { applyCommand } from './game'
import { spawnMonster } from './monsters'
import { createEquipped, createItem, giveItem } from './items'
import { arenaGame, run } from './testing'
import { TILE, itemsAt, player, setTile, type Creature, type GameState } from './state'
import type { GameEvent } from './events'
import { killCreature } from './combat/attack'

/** Арена: игрок с оружием weapon и боеприпасами, на полу ничего не лежит. */
function shooter(weapon: string, ammo?: string, count = 30, seed = 1): GameState {
  const s = arenaGame(seed)
  for (const id of Object.keys(s.items)) if (s.items[id]!.loc.kind === 'floor') delete s.items[id]
  const p = player(s)
  delete p.equipment.weapon
  createEquipped(s, p, weapon)
  if (ammo) giveItem(s, p, createItem(s, ammo, { kind: 'carried', owner: p.id }, count))
  return s
}

/** Неподвижная и неубиваемая мишень. */
function dummy(s: GameState, x: number, y: number, kind = 'templar'): Creature {
  const c = spawnMonster(s, kind, 1, x, y)
  c.nextActAt = Number.POSITIVE_INFINITY
  c.hp = c.maxHp = 1_000_000
  for (const part of c.parts) part.hp = part.maxHp = 1_000_000
  return c
}

const carried = (s: GameState, defId: string): number =>
  player(s)
    .inventory.map((id) => s.items[id]!)
    .filter((i) => i.defId === defId)
    .reduce((n, i) => n + (i.count ?? 1), 0)

const onFloor = (s: GameState, defId: string, x: number, y: number): number =>
  itemsAt(s, 1, x, y)
    .filter((i) => i.defId === defId)
    .reduce((n, i) => n + (i.count ?? 1), 0)

const attacksOn = (events: GameEvent[], id: string): number =>
  events.filter((e) => (e.type === 'attackHit' || e.type === 'attackMissed') && e.target.id === id).length

describe('дальний бой: выстрел игрока', () => {
  it('выстрел тратит боеприпас; снаряд падает у цели или ломается; упавшие подбираются в стопку', () => {
    let s = shooter('bow', 'arrow', 30)
    const target = dummy(s, 24, 20)
    const r = run(
      s,
      Array.from({ length: 30 }, () => ({ type: 'fire' as const, x: 24, y: 20 })),
    )
    s = r.state
    expect(r.events.filter((e) => e.type === 'commandRejected')).toEqual([])
    expect(r.events.filter((e) => e.type === 'shotFired')).toHaveLength(30)
    expect(attacksOn(r.events, target.id)).toBe(30)
    const broken = r.events.filter((e) => e.type === 'projectileBroken').length
    const landed = onFloor(s, 'arrow', 24, 20)
    expect(carried(s, 'arrow')).toBe(0)
    expect(broken).toBeGreaterThan(0)
    expect(landed).toBeGreaterThan(0)
    expect(broken + landed).toBe(30)

    // Мишень убрана, игрок встаёт на её клетку и подбирает стрелы одной стопкой.
    delete s.creatures[target.id]
    player(s).x = 24
    const picked = applyCommand(s, { type: 'pickup' })
    expect(carried(picked.state, 'arrow')).toBe(landed)
    expect(player(picked.state).inventory.filter((id) => picked.state.items[id]!.defId === 'arrow')).toHaveLength(1)
  })

  it('снаряд попадает в первое существо на линии и не проходит сквозь него', () => {
    const s = shooter('sling', 'stone')
    const near = dummy(s, 23, 20)
    const far = dummy(s, 26, 20)
    const r = run(s, Array.from({ length: 10 }, () => ({ type: 'fire' as const, x: 26, y: 20 })))
    expect(attacksOn(r.events, near.id)).toBe(10)
    expect(attacksOn(r.events, far.id)).toBe(0)
  })

  it('снаряд не проходит сквозь стену: падает перед ней', () => {
    const s = shooter('bow', 'arrow', 1)
    const target = dummy(s, 24, 20)
    setTile(s.levels[1]!, 22, 20, TILE.wall)
    // Цель за стеной игроку не видна, поэтому стреляем в видимую клетку у стены по той же линии.
    const r = applyCommand(s, { type: 'fire', x: 21, y: 20 })
    expect(attacksOn(r.events, target.id)).toBe(0)
    expect(r.events).toContainEqual({ type: 'projectileLanded', projectileDefId: 'arrow', wall: true })
    expect(onFloor(r.state, 'arrow', 21, 20)).toBe(1)
  })

  it('отказы: нет оружия дальнего боя, нет боеприпасов, цель дальше дальности', () => {
    const reason = (s: GameState, x: number, y: number): unknown =>
      applyCommand(s, { type: 'fire', x, y }).events.find((e) => e.type === 'commandRejected')
    expect(reason(shooter('dagger'), 23, 20)).toEqual({ type: 'commandRejected', reason: 'noRangedWeapon' })
    expect(reason(shooter('bow'), 23, 20)).toEqual({ type: 'commandRejected', reason: 'noAmmo' })
    expect(reason(shooter('sling', 'stone'), 27, 20)).toEqual({ type: 'commandRejected', reason: 'outOfRange' })
  })

  it('боеприпас нельзя «применить»', () => {
    const s = shooter('bow', 'arrow', 5)
    const arrows = player(s).inventory.find((id) => s.items[id]!.defId === 'arrow')!
    const r = applyCommand(s, { type: 'use', itemId: arrows })
    expect(r.events).toEqual([{ type: 'commandRejected', reason: 'notUsable' }])
  })

  it('метательное копьё летит само и падает у цели, в руку берётся следующее', () => {
    const s = shooter('javelin')
    const p = player(s)
    giveItem(s, p, createItem(s, 'javelin', { kind: 'carried', owner: p.id }))
    dummy(s, 23, 20)
    const r = applyCommand(s, { type: 'fire', x: 23, y: 20 })
    expect(onFloor(r.state, 'javelin', 23, 20)).toBe(1)
    expect(carried(r.state, 'javelin')).toBe(1)
    const held = r.state.items[player(r.state).equipment.weapon!]
    expect(held?.defId).toBe('javelin')
    const again = run(r.state, [
      { type: 'fire', x: 23, y: 20 },
      { type: 'fire', x: 23, y: 20 },
    ])
    expect(onFloor(again.state, 'javelin', 23, 20)).toBe(2)
    expect(again.events.at(-1)).toEqual({ type: 'commandRejected', reason: 'noRangedWeapon' })
  })
})

/** Стрелок-монстр с оружием и запасом. */
function archer(s: GameState, x: number, y: number, kind = 'orc_archer', weapon = 'bow', ammo = 'arrow'): Creature {
  const c = spawnMonster(s, kind, 1, x, y, [weapon])
  giveItem(s, c, createItem(s, ammo, { kind: 'carried', owner: c.id }, 20))
  return c
}

function waitTurns(s: GameState, n: number): { state: GameState; events: GameEvent[] } {
  return run(s, Array.from({ length: n }, () => ({ type: 'wait' as const })))
}

const shotsBy = (events: GameEvent[], id: string): number =>
  events.filter((e) => e.type === 'shotFired' && e.attacker.id === id).length

describe('дальний бой: трофеи', () => {
  it('игрок подбирает пращу и камни убитого пращника и стреляет из пращи', () => {
    let s = arenaGame()
    const slinger = archer(s, 20, 20, 'goblin_slinger', 'sling', 'stone')
    // Пращник погибает на клетке игрока; его снаряжение падает под ноги.
    const p = player(s)
    p.x = 21
    killCreature({ state: s, events: [] }, slinger, p, 'hp')
    p.x = 20
    s = applyCommand(s, { type: 'pickup' }).state
    const sling = player(s).inventory.find((id) => s.items[id]!.defId === 'sling')!
    s = applyCommand(s, { type: 'equip', itemId: sling }).state
    const target = dummy(s, 24, 20)
    const r = applyCommand(s, { type: 'fire', x: 24, y: 20 })
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'shotFired', weaponDefId: 'sling', projectileDefId: 'stone' }))
    expect(attacksOn(r.events, target.id)).toBe(1)
    expect(carried(r.state, 'stone')).toBe(19)
  })
})

describe('дальний бой: ИИ стрелка', () => {
  it('стреляет, когда есть линия огня', () => {
    const s = arenaGame()
    const a = archer(s, 25, 20)
    const r = waitTurns(s, 3)
    expect(shotsBy(r.events, a.id)).toBe(3)
    expect(attacksOn(r.events, s.playerId)).toBe(3)
  })

  it('не стреляет через союзника, а ищет линию огня', () => {
    let s = arenaGame()
    const a = archer(s, 26, 20)
    const ally = dummy(s, 23, 20, 'orc_warrior')
    let shots = 0
    for (let i = 0; i < 12; i++) {
      const r = waitTurns(s, 1)
      expect(attacksOn(r.events, ally.id)).toBe(0)
      shots += shotsBy(r.events, a.id)
      s = r.state
    }
    expect(shots).toBeGreaterThan(0)
  })

  it('отходит от игрока, стоящего рядом', () => {
    const s = arenaGame()
    const a = archer(s, 21, 20)
    const r = waitTurns(s, 1)
    const after = r.state.creatures[a.id]!
    expect(Math.max(Math.abs(after.x - 20), Math.abs(after.y - 20))).toBeGreaterThan(1)
    expect(attacksOn(r.events, s.playerId)).toBe(0)
  })

  it('зажатый в угол бьёт в ближнем бою', () => {
    const s = arenaGame()
    const p = player(s)
    p.x = 2
    p.y = 2
    const a = archer(s, 1, 1)
    const r = waitTurns(s, 1)
    expect(r.state.creatures[a.id]).toMatchObject({ x: 1, y: 1 })
    expect(shotsBy(r.events, a.id)).toBe(0)
    expect(attacksOn(r.events, s.playerId)).toBe(1)
  })

  it('без боеприпасов идёт в ближний бой', () => {
    const s = arenaGame()
    const a = spawnMonster(s, 'orc_archer', 1, 25, 20, ['bow'])
    const r = waitTurns(s, 6)
    expect(shotsBy(r.events, a.id)).toBe(0)
    expect(attacksOn(r.events, s.playerId)).toBeGreaterThan(0)
  })
})

