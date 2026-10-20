import type { GameEvent } from './events'
import type { GameState } from './state'
import type { MoveFrame, ProjectileTrail } from './protocol'

/** Изменяемый контекст обработки одной команды: копия состояния + накопленные события. */
export interface Ctx {
  state: GameState
  events: GameEvent[]
  /** Кадры перемещения многоходового действия (для анимации на клиенте). */
  frames?: MoveFrame[]
  /** Полёты снарядов, видимые игроку (для анимации на клиенте). */
  projectiles?: ProjectileTrail[]
}

export type ActionResult = { ok: true; cost: number } | { ok: false; reason: import('./events').RejectReason }

export function reject(reason: import('./events').RejectReason): ActionResult {
  return { ok: false, reason }
}
