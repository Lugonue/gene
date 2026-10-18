import type { ActionResult, Ctx } from '../context'
import { player, type Creature } from '../state'
import { actionCost } from '../time'
import { resolveAttack } from '../combat/attack'

/** Атака игрока движением в клетку с монстром. */
export function playerAttack(ctx: Ctx, target: Creature): ActionResult {
  const p = player(ctx.state)
  resolveAttack(ctx, p, target)
  return { ok: true, cost: actionCost(p, 'attack') }
}
