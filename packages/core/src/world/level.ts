import { TILE, type GameState, type Pos } from '../state'
import { generateLevel } from './mapgen'
import { populateLevel } from './populate'

/** Генерирует уровень при первом посещении. Возвращает позицию прибытия. */
export function ensureLevel(state: GameState, depth: number): void {
  if (state.levels[depth]) return
  const gen = generateLevel(state.rng, depth)
  state.levels[depth] = gen.level
  populateLevel(state, gen)
}

export function findTile(state: GameState, depth: number, tile: string): Pos | undefined {
  const level = state.levels[depth]
  if (!level) return undefined
  const i = level.tiles.indexOf(tile)
  if (i < 0) return undefined
  return { x: i % level.width, y: Math.floor(i / level.width) }
}

/** Где оказывается игрок при переходе: спускаясь — на лестнице вверх, поднимаясь — на лестнице вниз. */
export function arrivalPoint(state: GameState, depth: number, dir: 'down' | 'up'): Pos {
  const target = dir === 'down' ? TILE.stairsUp : TILE.stairsDown
  const p = findTile(state, depth, target)
  if (!p) throw new Error(`на уровне ${depth} нет лестницы ${target}`)
  return p
}
