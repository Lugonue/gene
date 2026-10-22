// Расстановка монстров и предметов на новом уровне.
import { FLOOR_ITEMS_PER_LEVEL, FLOOR_ITEM_WEIGHTS } from '@gene/data'
import { pick, randInt, shuffle, weightedIndex, type RngState } from '../rng'
import { DIRS, TILE, creatureAt, tileAt, type GameState, type Pos } from '../state'
import { spawnMonster } from '../monsters'
import { createItem } from '../items'
import type { GeneratedLevel } from './mapgen'
import { planSquads } from './squads'
import { LEADER_ROOM_MIN_SQUAD } from '../combat/formulas'

export function populateLevel(state: GameState, gen: GeneratedLevel): void {
  const depth = gen.level.depth
  const level = gen.level
  const rng = state.rng

  const free = (p: Pos): boolean => tileAt(level, p.x, p.y) === TILE.floor && !creatureAt(state, depth, p.x, p.y)

  // Уровень целиком занимает одна фракция. Отряд вожака — в последней комнате (у лестницы вниз или портала),
  // остальные — в случайной комнате, кроме первой (там старт, игрока не атакуют сразу по прибытии), где отряд
  // помещается целиком: урезанный отряд мог бы нарушить ограничения по ролям. Не поместившийся нигде не ставится.
  const rooms = gen.roomCells.slice(1)
  planSquads(rng, depth).forEach((squad, i) => {
    const size = squad.members.length
    let cells: Pos[] = []
    if (squad.leader) cells = leaderCells(rng, rooms, free, size)
    else {
      for (const room of shuffle(rng, [...rooms])) {
        cells = clusterCells(rng, room.filter(free), size)
        if (cells.length === size) break
      }
      if (cells.length < size) return
    }
    cells.forEach((spot, j) => {
      const m = squad.members[j]!
      spawnMonster(state, m.species, depth, spot.x, spot.y, m.gear).squad = `q${depth}-${i}`
    })
  })

  // Предметы на полу.
  const itemIds = Object.keys(FLOOR_ITEM_WEIGHTS)
  const weights = itemIds.map((id) => FLOOR_ITEM_WEIGHTS[id]!)
  const itemSpots = shuffle(rng, gen.roomCells.flat().filter((p) => tileAt(level, p.x, p.y) === TILE.floor))
  const itemCount = randInt(rng, FLOOR_ITEMS_PER_LEVEL[0], FLOOR_ITEMS_PER_LEVEL[1])
  for (let i = 0; i < itemCount && itemSpots.length > 0; i++) {
    const spot = itemSpots.pop()!
    const defId = itemIds[weightedIndex(rng, weights)]!
    createItem(state, defId, { kind: 'floor', depth, x: spot.x, y: spot.y })
  }
}

/**
 * Клетки отряда вожака: на уровне ровно один вожак. Отряд урезается с конца, а первыми в нём стоят вожак
 * и воин или зверь, поэтому годится комната, где помещаются хотя бы эти двое, — последняя, иначе любая другая.
 * Если такой нет нигде, вожак встаёт хоть один там, где больше места.
 */
function leaderCells(rng: RngState, rooms: Pos[][], free: (p: Pos) => boolean, size: number): Pos[] {
  const enough = Math.min(size, LEADER_ROOM_MIN_SQUAD)
  const last = rooms[rooms.length - 1]
  if (!last) return []
  let best = clusterCells(rng, last.filter(free), size)
  if (best.length >= enough) return best
  for (const room of shuffle(rng, rooms.slice(0, -1))) {
    const cells = clusterCells(rng, room.filter(free), size)
    if (cells.length >= enough) return cells
    if (cells.length > best.length) best = cells
  }
  return best
}

/**
 * До n клеток из cells вокруг случайной опорной — в порядке обхода в ширину по соседним клеткам,
 * так что каждая следующая клетка соседствует с одной из уже выбранных.
 */
function clusterCells(rng: RngState, cells: Pos[], n: number): Pos[] {
  if (cells.length === 0 || n <= 0) return []
  const key = (p: Pos): string => `${p.x},${p.y}`
  const open = new Map(cells.map((p) => [key(p), p]))
  const anchor = pick(rng, cells)
  const result: Pos[] = [anchor]
  open.delete(key(anchor))
  for (let i = 0; i < result.length && result.length < n; i++) {
    const at = result[i]!
    for (const d of Object.values(DIRS)) {
      const next = open.get(key({ x: at.x + d.x, y: at.y + d.y }))
      if (!next || result.length >= n) continue
      open.delete(key(next))
      result.push(next)
    }
  }
  return result
}
