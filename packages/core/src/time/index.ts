// МОДУЛЬ-ЗАГЛУШКА: модель времени (см. README.md рядом).
// Энергетическая модель в стиле DCSS: у каждого существа есть момент следующего хода nextActAt (aut).
// Ходит существо с наименьшим nextActAt; после действия nextActAt увеличивается на стоимость действия.
import { speciesOf, type Creature, type GameState } from '../state'
import { SLOW_COST_MUL, SLOW_DURATION, moveCostMultiplier } from '../combat/formulas'

export type ActionKind = 'move' | 'attack' | 'wait' | 'item' | 'stairs'

/** Базовая стоимость любого действия в заглушке. */
export const BASE_ACTION_COST = 10
/** Нормальная скорость существа. */
export const NORMAL_SPEED = 10

export function creatureSpeed(c: Creature): number {
  if (c.kind === 'player') return NORMAL_SPEED
  return speciesOf(c)?.speed ?? NORMAL_SPEED
}

/** Стоимость действия (aut) с учётом скорости, ран (модификатор от ног — только для движения) и замедления. */
export function actionCost(c: Creature, action: ActionKind): number {
  let cost = (BASE_ACTION_COST * NORMAL_SPEED) / creatureSpeed(c)
  if (action === 'move') cost *= moveCostMultiplier(c)
  if (isSlowed(c)) cost *= SLOW_COST_MUL
  return Math.max(1, Math.round(cost))
}

// Замедление холодом: действия дороже в SLOW_COST_MUL раз в течение SLOW_DURATION aut (числа — в модуле формул).
export function isSlowed(c: Creature): boolean {
  return c.slowedUntil !== undefined && c.nextActAt < c.slowedUntil
}

/** Замедлить с момента now (повторный холод продлевает). Возвращает true, если существо не было замедлено. */
export function applySlow(c: Creature, now: number): boolean {
  const fresh = !isSlowed(c)
  c.slowedUntil = Math.max(c.slowedUntil ?? 0, Math.max(now, c.nextActAt) + SLOW_DURATION)
  return fresh
}

/** Снять истёкшее замедление. Возвращает true, если оно только что прошло. */
export function expireSlow(c: Creature): boolean {
  if (c.slowedUntil === undefined || isSlowed(c)) return false
  delete c.slowedUntil
  return true
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
