// Автоисследование: следующий шаг к ближайшей неизвестной клетке. Путь — только по памяти карты.
import { DIRS, TILE, cellIndex, type Dir, type LevelState, type Pos } from '../state'

const DIR_LIST = Object.entries(DIRS) as [Dir, Pos][]

function known(level: LevelState, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return true
  return level.memory[cellIndex(level, { x, y })] !== ' '
}

function walkable(level: LevelState, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return false
  const m = level.memory[cellIndex(level, { x, y })]
  return m !== ' ' && m !== TILE.wall
}

function bordersUnknown(level: LevelState, x: number, y: number): boolean {
  return DIR_LIST.some(([, d]) => !known(level, x + d.x, y + d.y))
}

/**
 * Направление первого шага к ближайшей (по числу шагов) запомненной проходимой клетке,
 * граничащей с неизвестной. undefined — исследовать нечего.
 */
export function exploreStep(level: LevelState, from: Pos): Dir | undefined {
  const w = level.width
  const start = from.y * w + from.x
  /** Для каждой посещённой клетки — направление первого шага из стартовой. */
  const firstStep = new Map<number, Dir | null>([[start, null]])
  const queue = [start]
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi]!
    const cx = cur % w
    const cy = Math.floor(cur / w)
    if (cur !== start && bordersUnknown(level, cx, cy)) return firstStep.get(cur) ?? undefined
    for (const [dir, d] of DIR_LIST) {
      const nx = cx + d.x
      const ny = cy + d.y
      const ni = ny * w + nx
      if (firstStep.has(ni) || !walkable(level, nx, ny)) continue
      firstStep.set(ni, firstStep.get(cur) ?? dir)
      queue.push(ni)
    }
  }
  return undefined
}
