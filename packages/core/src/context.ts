import type { GameEvent } from './events'
import type { GameState } from './state'
import type { MoveFrame } from './protocol'

/** Изменяемый контекст обработки одной команды: копия состояния + накопленные события. */
export interface Ctx {
  state: GameState
  events: GameEvent[]
  /** Кадры перемещения многоходового действия (для анимации на клиенте). */
  frames?: MoveFrame[]
}

export type ActionResult = { ok: true; cost: number } | { ok: false; reason: import('./events').RejectReason }

export function reject(reason: import('./events').RejectReason): ActionResult {
  return { ok: false, reason }
}
