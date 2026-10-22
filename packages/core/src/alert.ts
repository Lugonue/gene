// Ступени тревоги по целостности (опасное и критическое состояние). Пороги — в combat/formulas.
import type { Ctx } from './context'
import type { Creature } from './state'
import type { GameEvent } from './events'
import { alertIndex, nextAlertStage, type AlertStage } from './combat/formulas'

/** Текущая ступень тревоги существа (у монстров и в старых сохранениях — 'none'). */
export function alertStage(c: Creature): AlertStage {
  return c.alert ?? 'none'
}

/** Событие — вход в более тяжёлую ступень (а не выход из неё). */
export function isAlertRaised(e: { from: AlertStage; to: AlertStage }): boolean {
  return alertIndex(e.to) > alertIndex(e.from)
}

/** Был ли за ход удар по игроку со вспышкой (вход в критическое состояние или удар уже в нём). */
export function turnFlashes(events: GameEvent[]): boolean {
  return events.some((e) => e.type === 'attackHit' && e.criticalFlash === true)
}

/**
 * Пересчитать ступень игрока после изменения целостности (урон, регенерация, лечение).
 * Смена ступени — событие alertChanged. Возвращает новую ступень (у монстров — всегда 'none').
 */
export function updateAlert(ctx: Ctx, c: Creature): AlertStage {
  if (c.kind !== 'player') return 'none'
  const from = alertStage(c)
  const to = nextAlertStage(from, c.hp, c.maxHp)
  if (to === from) return to
  if (to === 'none') delete c.alert
  else c.alert = to
  const integrity = Math.max(0, Math.round((c.hp / c.maxHp) * 100))
  ctx.events.push({ type: 'alertChanged', from, to, integrity })
  return to
}
