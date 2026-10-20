import { reject, type ActionResult, type Ctx } from '../context'
import { player } from '../state'
import { actionCost } from '../time'
import { distance, fire, readyToShoot } from '../combat/ranged'
import { playerVisibleCells } from '../view'

/** Выстрел или бросок игрока в видимую клетку (x, y) в пределах дальности. */
export function fireAction(ctx: Ctx, x: unknown, y: unknown): ActionResult {
  const { state } = ctx
  const p = player(state)
  const level = state.levels[p.depth]!
  if (!Number.isInteger(x) || !Number.isInteger(y)) return reject('invalid')
  const target = { x: x as number, y: y as number }
  if (target.x < 0 || target.y < 0 || target.x >= level.width || target.y >= level.height) return reject('invalid')
  if (target.x === p.x && target.y === p.y) return reject('wrongTarget')
  const ready = readyToShoot(state, p)
  if (typeof ready === 'string') return reject(ready)
  if (distance(p, target) > ready.range) return reject('outOfRange')
  if (!playerVisibleCells(state).has(target.y * level.width + target.x)) return reject('wrongTarget')
  fire(ctx, p, target, ready)
  return { ok: true, cost: actionCost(p, 'attack') }
}
