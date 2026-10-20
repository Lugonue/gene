// Расстановка монстров и предметов на новом уровне.
import { FLOOR_ITEMS_PER_LEVEL, FLOOR_ITEM_WEIGHTS, MONSTERS, MONSTERS_PER_LEVEL, factionForDepth } from '@gene/data'
import { pick, randInt, shuffle, weightedIndex } from '../rng'
import { TILE, creatureAt, tileAt, type GameState, type Pos } from '../state'
import { spawnMonster } from '../monsters'
import { createItem } from '../items'
import type { GeneratedLevel } from './mapgen'

export function populateLevel(state: GameState, gen: GeneratedLevel): void {
  const depth = gen.level.depth
  const level = gen.level
  const rng = state.rng

  const free = (p: Pos): boolean => tileAt(level, p.x, p.y) === TILE.floor && !creatureAt(state, depth, p.x, p.y)

  // Первая комната (старт/лестница вверх) остаётся без монстров, чтобы игрока не атаковали сразу по прибытии.
  const candidates = shuffle(rng, gen.roomCells.slice(1).flat().filter(free))

  // Уровень целиком занимает одна фракция. Её вожак — в последней комнате (у лестницы вниз или портала).
  const faction = factionForDepth(depth)
  const species = Object.values(MONSTERS).filter((m) => m.faction === faction?.id)
  const leader = species.find((m) => m.role === 'leader')
  const lastRoom = (gen.roomCells[gen.roomCells.length - 1] ?? []).filter(free)
  if (leader && lastRoom.length > 0) {
    const spot = pick(rng, lastRoom)
    spawnMonster(state, leader.id, depth, spot.x, spot.y)
  }

  const pool = species.filter((m) => m.role !== 'leader' && m.spawnWeight > 0)
  const target = randInt(rng, MONSTERS_PER_LEVEL[0], MONSTERS_PER_LEVEL[1])
  let placed = 0
  while (placed < target && candidates.length > 0 && pool.length > 0) {
    const def = pool[weightedIndex(rng, pool.map((m) => m.spawnWeight))]!
    const spot = candidates.pop()!
    if (!free(spot)) continue
    spawnMonster(state, def.id, depth, spot.x, spot.y)
    placed++
  }

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
