import * as ROT from 'rot-js'
import { TILE, cellIndex, tileAt, type LevelState } from '../state'

export function blocksSight(t: string): boolean {
  return t === TILE.wall || t === TILE.doorClosed
}

export function isPassable(t: string): boolean {
  return t !== TILE.wall
}

/** Множество видимых клеток (индексы y*width+x). */
export function computeFov(level: LevelState, x: number, y: number, radius: number): Set<number> {
  const visible = new Set<number>()
  const fov = new ROT.FOV.PreciseShadowcasting((cx, cy) => {
    if (cx === x && cy === y) return true
    return !blocksSight(tileAt(level, cx, cy))
  })
  fov.compute(x, y, Math.max(1, radius), (cx, cy) => {
    if (cx >= 0 && cy >= 0 && cx < level.width && cy < level.height) visible.add(cellIndex(level, { x: cx, y: cy }))
  })
  return visible
}

export function rememberVisible(level: LevelState, visible: Set<number>): void {
  const mem = level.memory.split('')
  for (const i of visible) mem[i] = level.tiles[i] as string
  level.memory = mem.join('')
}
