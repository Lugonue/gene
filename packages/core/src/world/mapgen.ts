// Генерация уровня: ROT.Map.Digger (комнаты и коридоры).
// ROT.RNG — глобальный синглтон, поэтому перед генерацией засеваем его производным сидом из нашего ГПСЧ.
import * as ROT from 'rot-js'
import { chance, deriveSeed, type RngState } from '../rng'
import { MAP_HEIGHT, MAP_WIDTH, MAX_DEPTH, TILE, type LevelState, type Pos } from '../state'

export interface GeneratedLevel {
  level: LevelState
  /** Клетки пола комнат (кандидаты для расстановки монстров и предметов). */
  roomCells: Pos[][]
  upStairs?: Pos
  downStairs?: Pos
  portal?: Pos
  /** Где появляется игрок при старте на 1-м уровне. */
  start: Pos
}

export function generateLevel(rng: RngState, depth: number): GeneratedLevel {
  const width = MAP_WIDTH
  const height = MAP_HEIGHT
  let tiles: string[] = []
  let digger: InstanceType<typeof ROT.Map.Digger> | undefined
  // Нужны хотя бы 2 комнаты: лестницы вверх и вниз (портал) не должны совпадать.
  for (let attempt = 0; attempt < 50; attempt++) {
    tiles = new Array(width * height).fill(TILE.wall)
    ROT.RNG.setSeed(deriveSeed(rng))
    digger = new ROT.Map.Digger(width, height, { dugPercentage: 0.3, roomWidth: [4, 11], roomHeight: [3, 7] })
    digger.create((x, y, wall) => {
      if (!wall) tiles[y * width + x] = TILE.floor
    })
    if (digger.getRooms().length >= 2) break
  }
  if (!digger) throw new Error('mapgen: генерация не удалась')

  const rooms = digger.getRooms()
  const roomCells: Pos[][] = rooms.map((room) => {
    const cells: Pos[] = []
    for (let y = room.getTop(); y <= room.getBottom(); y++)
      for (let x = room.getLeft(); x <= room.getRight(); x++) cells.push({ x, y })
    return cells
  })

  // Двери: на части входов в комнаты.
  for (const room of rooms) {
    room.getDoors((x, y) => {
      if (tiles[y * width + x] === TILE.floor && chance(rng, 0.6)) tiles[y * width + x] = TILE.doorClosed
    })
  }

  const center = (i: number): Pos => {
    const room = rooms[i]
    if (!room) throw new Error('mapgen: нет комнат')
    const [cx, cy] = room.getCenter()
    return { x: cx ?? room.getLeft(), y: cy ?? room.getTop() }
  }

  const first = center(0)
  const last = center(rooms.length - 1)
  const result: GeneratedLevel = { level: { depth, width, height, tiles: '', memory: ' '.repeat(width * height) }, roomCells, start: first }

  if (depth > 1) {
    tiles[first.y * width + first.x] = TILE.stairsUp
    result.upStairs = first
  }
  if (depth < MAX_DEPTH) {
    tiles[last.y * width + last.x] = TILE.stairsDown
    result.downStairs = last
  } else {
    tiles[last.y * width + last.x] = TILE.portal
    result.portal = last
  }

  result.level.tiles = tiles.join('')
  return result
}
