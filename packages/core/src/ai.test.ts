import { describe, expect, it } from 'vitest'
import { applyCommand } from './game'
import { spawnMonster } from './monsters'
import { newTestGame } from './testing'
import { TILE, player, type Creature, type GameState } from './state'
import type { GameEvent } from './events'

/** Партия на открытой арене: весь 1-й уровень — пол, монстров нет, игрок неуязвим и стоит в (20, 20). */
function arena(seed = 1): GameState {
  const s = newTestGame(seed)
  for (const id of Object.keys(s.creatures)) if (id !== s.playerId) delete s.creatures[id]
  const level = s.levels[1]!
  const tiles = level.tiles.split('')
  for (let y = 0; y < level.height; y++)
    for (let x = 0; x < level.width; x++) {
      const border = x === 0 || y === 0 || x === level.width - 1 || y === level.height - 1
      tiles[y * level.width + x] = border ? TILE.wall : TILE.floor
    }
  level.tiles = tiles.join('')
  const p = player(s)
  p.x = 20
  p.y = 20
  p.hp = p.maxHp = 1_000_000
  for (const part of p.parts) part.hp = part.maxHp = 1_000_000
  return s
}

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

  it('Орден идёт по следу игрока, пропавшего из виду, а орк теряет след', () => {
    // Монстр видит игрока, затем игрок оказывается далеко за пределами обзора.
    const chase = (kind: string): number => {
      let s = arena()
      const c = spawnMonster(s, kind, 1, 24, 20)
      s = waitTurns(s, 1).state
      const p = player(s)
      p.x = 70
      p.y = 20
      s = waitTurns(s, 12).state
      const m = s.creatures[c.id]!
      return Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y))
    }
    expect(chase('templar')).toBeLessThan(40)
    expect(chase('orc_warrior')).toBeGreaterThan(40)
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
})
