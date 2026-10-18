import { reject, type ActionResult, type Ctx } from '../context'
import type { Creature } from '../state'

/** Атака игрока движением в клетку с монстром (этап 4). */
export function playerAttack(_ctx: Ctx, _target: Creature): ActionResult {
  return reject('blocked')
}
