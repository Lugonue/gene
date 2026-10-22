// Замеченные объекты: предметы, лестницы и портал, впервые попавшие в поле зрения игрока,
// и виды монстров для бестиария.
import { player, TILE, type GameState } from '../state'

export type FeatureKind = 'stairsDown' | 'stairsUp' | 'portal'

const FEATURES: Record<string, FeatureKind> = {
  [TILE.stairsDown]: 'stairsDown',
  [TILE.stairsUp]: 'stairsUp',
  [TILE.portal]: 'portal',
}

export interface Noticed {
  itemDefIds: string[]
  features: FeatureKind[]
}

/**
 * Отметить объекты в поле зрения как замеченные и вернуть впервые замеченные.
 * Виды монстров в поле зрения записываются в бестиарий (Knowledge.species).
 * Вызывать до обновления памяти карты: лестница считается новой, если её клетки ещё нет в памяти.
 * Клетка под игроком не в счёт (прибытие по лестнице).
 */
export function noticeObjects(state: GameState, visible: Set<number>): Noticed {
  const p = player(state)
  const level = state.levels[p.depth]!
  const noticed = (state.noticedItems ??= {})
  const out: Noticed = { itemDefIds: [], features: [] }

  const here = p.y * level.width + p.x
  for (const i of visible) {
    if (i === here || level.memory[i] !== ' ') continue
    const f = FEATURES[level.tiles[i] as string]
    if (f) out.features.push(f)
  }

  for (const id of p.inventory) noticed[id] = true
  for (const it of Object.values(state.items)) {
    if (it.loc.kind !== 'floor' || it.loc.depth !== p.depth || noticed[it.id]) continue
    if (!visible.has(it.loc.y * level.width + it.loc.x)) continue
    noticed[it.id] = true
    out.itemDefIds.push(it.defId)
  }

  const species = (state.knowledge.species ??= [])
  for (const c of Object.values(state.creatures)) {
    if (c.kind === 'player' || c.depth !== p.depth || species.includes(c.kind)) continue
    if (visible.has(c.y * level.width + c.x)) species.push(c.kind)
  }
  return out
}
