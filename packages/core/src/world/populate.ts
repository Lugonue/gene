// Расстановка монстров и предметов на новом уровне.
import { FLOOR_ITEMS_PER_LEVEL, FLOOR_ITEM_WEIGHTS, MONSTERS, MONSTERS_PER_LEVEL } from '@gene/data'
import { pick, randInt, shuffle, weightedIndex } from '../rng'
import { DIRS, TILE, creatureAt, tileAt, type GameState, type Pos } from '../state'
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

  // Финальный монстр 3-го уровня — в комнате портала.
  if (gen.portal) {
    const portalRoom = gen.roomCells[gen.roomCells.length - 1] ?? []
    const spots = portalRoom.filter(free)
    const boss = Object.values(MONSTERS).find((m) => m.boss)
    if (boss && spots.length > 0) {
      const spot = pick(rng, spots)
      spawnMonster(state, boss.id, depth, spot.x, spot.y)
    }
  }

  const pool = Object.values(MONSTERS).filter((m) => !m.boss && m.spawnWeight > 0 && depth >= m.depth[0] && depth <= m.depth[1])
  const target = randInt(rng, MONSTERS_PER_LEVEL[0], MONSTERS_PER_LEVEL[1])
  let placed = 0
  while (placed < target && candidates.length > 0) {
    const def = pool[weightedIndex(rng, pool.map((m) => m.spawnWeight))]
    if (!def) break
    const spot = candidates.pop()!
    if (!free(spot)) continue
    spawnMonster(state, def.id, depth, spot.x, spot.y)
    placed++
    // Стая: остальные особи — на соседних клетках.
    if (def.packSize) {
      const extra = randInt(rng, def.packSize[0], def.packSize[1]) - 1
      for (let i = 0; i < extra && placed < target + 2; i++) {
        const near = Object.values(DIRS)
          .map((d) => ({ x: spot.x + d.x, y: spot.y + d.y }))
          .filter(free)
        if (near.length === 0) break
        const p = pick(rng, near)
        spawnMonster(state, def.id, depth, p.x, p.y)
        placed++
      }
    }
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
