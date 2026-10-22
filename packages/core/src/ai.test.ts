import { describe, expect, it } from 'vitest'
import { applyCommand } from './game'
import { spawnMonster } from './monsters'
import { arenaGame as arena } from './testing'
import { TILE, distance, player, setTile, type Creature, type GameState } from './state'
import { SEARCH_RADIUS } from './combat/formulas'
import type { GameEvent } from './events'

function waitTurns(s: GameState, n: number): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  for (let i = 0; i < n; i++) {
    const r = applyCommand(s, { type: 'wait' })
    s = r.state
    events.push(...r.events)
  }
  return { state: s, events }
}

function wounded(s: GameState, kind: string, hpShare: number, x: number, y: number): Creature {
  const c = spawnMonster(s, kind, 1, x, y)
  c.hp = Math.ceil(c.maxHp * hpShare)
  return c
}

const fled = (events: GameEvent[]): boolean => events.some((e) => e.type === 'monsterFlees')

describe('черты поведения фракций', () => {
  it('гоблины трусливы: отступают, потеряв меньше половины здоровья, а храмовник — нет', () => {
    const goblin = arena()
    wounded(goblin, 'goblin_brute', 0.4, 21, 20)
    expect(fled(waitTurns(goblin, 30).events)).toBe(true)

    const templar = arena()
    wounded(templar, 'templar', 0.4, 21, 20)
    expect(fled(waitTurns(templar, 30).events)).toBe(false)
  })

  it('орки не отступают даже при смерти на пороге и с искалеченными ногами', () => {
    const s = arena()
    const orc = wounded(s, 'orc_warrior', 0.05, 21, 20)
    for (const part of orc.parts) if (part.defId.endsWith('leg')) part.wound = 'crippled'
    expect(fled(waitTurns(s, 40).events)).toBe(false)
  })

  it('Орден не узнаёт позицию игрока вне поля зрения: идёт туда, где видел, а не к игроку', () => {
    // Монстр видит игрока, затем игрок оказывается далеко за пределами обзора.
    let s = arena()
    const c = spawnMonster(s, 'templar', 1, 24, 20)
    s = waitTurns(s, 1).state
    const p = player(s)
    p.x = 70
    p.y = 20
    s = waitTurns(s, 20).state
    const m = s.creatures[c.id]!
    expect(Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y))).toBeGreaterThan(40)
  })

  it('Орден, потеряв игрока, осматривается у места, где видел его, и находит спрятавшегося рядом', () => {
    let s = arena()
    const c = spawnMonster(s, 'templar', 1, 27, 20)
    s = waitTurns(s, 1).state
    // Игрок уходит за пределы обзора и монстра, и места, где его видели.
    const p = player(s)
    p.x = 20
    p.y = 32
    let found = false
    for (let i = 0; i < 40 && !found; i++) {
      s = waitTurns(s, 1).state
      const m = s.creatures[c.id]!
      found = Math.max(Math.abs(m.x - 20), Math.abs(m.y - 32)) <= 1
    }
    expect(found).toBe(true)
  })

  it('Орден осматривает только клетки, видимые с места, где видел игрока, а не обходит стену к клеткам за ней', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      let s = arena(seed)
      // Стена под местом, где видели игрока; проход в ней далеко справа.
      const level = s.levels[1]!
      for (let x = 1; x <= 70; x++) setTile(level, x, 22, TILE.wall)
      const c = spawnMonster(s, 'templar', 1, 25, 20)
      s = waitTurns(s, 1).state
      const p = player(s)
      p.x = 5
      p.y = 40
      // Поиск длится TRACK_TIME (около 18 ходов) — проверяем, пока монстр ищет.
      for (let i = 0; i < 18; i++) {
        s = waitTurns(s, 1).state
        const m = s.creatures[c.id]!
        expect(distance(m, { x: 20, y: 20 })).toBeLessThanOrEqual(SEARCH_RADIUS)
      }
    }
  })

  it('кобольды отступают к союзнику, а не просто прочь от игрока', () => {
    let s = arena()
    const kobold = wounded(s, 'scaled_guard', 0.05, 21, 20)
    // Союзник далеко, за пределами обзора игрока.
    const ally = spawnMonster(s, 'javelineer', 1, 21, 34)
    const r = waitTurns(s, 30)
    s = r.state
    expect(fled(r.events)).toBe(true)
    const k = s.creatures[kobold.id]!
    const a = s.creatures[ally.id]!
    expect(Math.max(Math.abs(k.x - a.x), Math.abs(k.y - a.y))).toBeLessThanOrEqual(2)
  })

  it('кобольд бежит к живому вожаку, даже если другой союзник ближе', () => {
    let s = arena()
    const kobold = wounded(s, 'scaled_guard', 0.05, 21, 20)
    spawnMonster(s, 'javelineer', 1, 21, 30)
    const leader = spawnMonster(s, 'dragonborn', 1, 45, 20)
    const r = waitTurns(s, 40)
    s = r.state
    expect(fled(r.events)).toBe(true)
    const k = s.creatures[kobold.id]!
    const l = s.creatures[leader.id]!
    expect(Math.max(Math.abs(k.x - l.x), Math.abs(k.y - l.y))).toBeLessThanOrEqual(2)
  })

  it('без вожака кобольд бежит к ближайшему союзнику, который сам не убегает', () => {
    let s = arena()
    const kobold = wounded(s, 'scaled_guard', 0.05, 21, 20)
    // Ближний союзник сам бежит — к нему кобольд не идёт.
    const runner = wounded(s, 'scaled_guard', 0.05, 21, 30)
    runner.ai = { mode: 'flee' }
    const ally = spawnMonster(s, 'javelineer', 1, 45, 20)
    const r = waitTurns(s, 40)
    s = r.state
    const k = s.creatures[kobold.id]!
    const a = s.creatures[ally.id]!
    expect(Math.max(Math.abs(k.x - a.x), Math.abs(k.y - a.y))).toBeLessThanOrEqual(2)
  })
})
