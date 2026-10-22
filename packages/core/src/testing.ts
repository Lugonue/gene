// Вспомогательные функции для тестов (в игровой логике не используются).
import * as ROT from 'rot-js'
import { applyCommand } from './game'
import { createGame, type NewGameOptions } from './create'
import type { GameEvent } from './events'
import { DIRS, TILE, cellIndex, player, tileAt, type Command, type Dir, type GameState, type Pos } from './state'
import { isPassable } from './world/fov'
import { findTile } from './world/level'

export const DEFAULT_OPTS: NewGameOptions = { name: 'Тест-7', bodyPlan: 'humanoid', startWeapon: 'short_sword' }

export function newTestGame(seed = 12345, opts: Partial<NewGameOptions> = {}): GameState {
  return createGame(seed, { ...DEFAULT_OPTS, ...opts })
}

export function run(state: GameState, cmds: Command[]): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  for (const cmd of cmds) {
    const r = applyCommand(state, cmd)
    state = r.state
    events.push(...r.events)
  }
  return { state, events }
}

function dirFor(dx: number, dy: number): Dir {
  for (const [d, v] of Object.entries(DIRS)) if (v.x === dx && v.y === dy) return d as Dir
  throw new Error(`нет направления ${dx},${dy}`)
}

/** Путь (команды move) от игрока до клетки по известной карте уровня (по всем клеткам, без учёта тумана). */
export function pathTo(state: GameState, target: Pos): Command[] {
  const p = player(state)
  const level = state.levels[p.depth]!
  const astar = new ROT.Path.AStar(target.x, target.y, (x, y) => isPassable(tileAt(level, x, y)), { topology: 8 })
  const path: Pos[] = []
  astar.compute(p.x, p.y, (x, y) => path.push({ x, y }))
  const cmds: Command[] = []
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!
    const b = path[i]!
    cmds.push({ type: 'move', dir: dirFor(b.x - a.x, b.y - a.y) })
  }
  return cmds
}

/**
 * Идти к клетке, повторяя команды движения (двери открываются движением, поэтому шаг в дверь
 * повторяется). Монстры на пути атакуются. Ограничение по числу шагов.
 */
export function walkTo(state: GameState, target: Pos, maxSteps = 2000): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  for (let i = 0; i < maxSteps && state.status === 'active'; i++) {
    const p = player(state)
    if (p.x === target.x && p.y === target.y) break
    const cmds = pathTo(state, target)
    const next = cmds[0]
    if (!next) break
    const r = applyCommand(state, next)
    events.push(...r.events)
    if (r.events.some((e) => e.type === 'commandRejected')) break
    state = r.state
  }
  return { state, events }
}

export function stairsPos(state: GameState, tile: string): Pos {
  const pos = findTile(state, player(state).depth, tile)
  if (!pos) throw new Error(`нет клетки ${tile}`)
  return pos
}

/** Партия на открытой арене: весь 1-й уровень — пол, монстров нет (и бестиарий пуст), игрок неуязвим и стоит в (20, 20). */
export function arenaGame(seed = 1): GameState {
  const s = newTestGame(seed)
  for (const id of Object.keys(s.creatures)) if (id !== s.playerId) delete s.creatures[id]
  s.knowledge.species = []
  const level = s.levels[1]!
  const tiles = level.tiles.split('')
  for (let y = 0; y < level.height; y++)
    for (let x = 0; x < level.width; x++) {
      const border = x === 0 || y === 0 || x === level.width - 1 || y === level.height - 1
      tiles[cellIndex(level, { x, y })] = border ? TILE.wall : TILE.floor
    }
  level.tiles = tiles.join('')
  const p = player(s)
  p.x = 20
  p.y = 20
  p.hp = p.maxHp = 1_000_000
  for (const part of p.parts) part.hp = part.maxHp = 1_000_000
  return s
}
