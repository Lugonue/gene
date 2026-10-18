import type { GameEvent } from './events'
import type { GameState } from './state'

/** Изменяемый контекст обработки одной команды: копия состояния + накопленные события. */
export interface Ctx {
  state: GameState
  events: GameEvent[]
}

export type ActionResult = { ok: true; cost: number } | { ok: false; reason: import('./events').RejectReason }

export function reject(reason: import('./events').RejectReason): ActionResult {
  return { ok: false, reason }
}
