// МОДУЛЬ-ЗАГЛУШКА: модель времени (см. README.md рядом).
// Энергетическая модель в стиле DCSS: у каждого существа есть момент следующего хода nextActAt (aut).
// Ходит существо с наименьшим nextActAt; после действия nextActAt увеличивается на стоимость действия.
import { MONSTERS } from '@gene/data'
import type { Creature, GameState } from '../state'
import { moveCostMultiplier } from '../combat/formulas'

export type ActionKind = 'move' | 'attack' | 'wait' | 'item' | 'stairs'

/** Базовая стоимость любого действия в заглушке. */
export const BASE_ACTION_COST = 10
/** Нормальная скорость существа. */
export const NORMAL_SPEED = 10

export function creatureSpeed(c: Creature): number {
  if (c.kind === 'player') return NORMAL_SPEED
  return MONSTERS[c.kind]?.speed ?? NORMAL_SPEED
}

/** Стоимость действия (aut) с учётом скорости и ран (модификатор от ног — только для движения). */
export function actionCost(c: Creature, action: ActionKind): number {
  let cost = (BASE_ACTION_COST * NORMAL_SPEED) / creatureSpeed(c)
  if (action === 'move') cost *= moveCostMultiplier(c)
  return Math.max(1, Math.round(cost))
}

export function spendTime(c: Creature, cost: number): void {
  c.nextActAt += cost
}

/**
 * Следующее существо, которое ходит на уровне depth. При равенстве времени игрок ходит первым,
 * затем остальные в порядке создания.
 */
export function nextActor(state: GameState, depth: number): Creature | undefined {
  let best: Creature | undefined
  for (const c of Object.values(state.creatures)) {
    if (c.depth !== depth) continue
    if (!best || c.nextActAt < best.nextActAt) best = c
    else if (c.nextActAt === best.nextActAt && c.kind === 'player') best = c
  }
  return best
}

/** Существа уровня, на который пришёл игрок, «просыпаются» не раньше текущего момента. */
export function syncLevelTime(state: GameState, depth: number): void {
  for (const c of Object.values(state.creatures)) {
    if (c.depth === depth && c.kind !== 'player' && c.nextActAt < state.now) c.nextActAt = state.now
  }
}
