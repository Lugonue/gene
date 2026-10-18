import type { Ctx } from './context'
import type { Creature } from './state'
import { actionCost, spendTime } from './time'

/** Ход монстра (полноценный ИИ — этап 4). */
export function monsterTurn(_ctx: Ctx, c: Creature): void {
  spendTime(c, actionCost(c, 'wait'))
}
