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
 * Ступень игрока после изменения целостности — единственное место, где она решается.
 * undefined — не игрок или погиб (при гибели о ступени не сообщают и вспышку не дают).
 */
export function alertAfter(c: Creature): AlertStage | undefined {
  if (c.kind !== 'player' || c.hp <= 0) return undefined
  return nextAlertStage(alertStage(c), c.hp, c.maxHp)
}

/** Записать ступень, решённую alertAfter; смена — событие alertChanged. */
export function setAlert(ctx: Ctx, c: Creature, to: AlertStage): void {
  const from = alertStage(c)
  if (to === from) return
  if (to === 'none') delete c.alert
  else c.alert = to
  const integrity = Math.max(0, Math.round((c.hp / c.maxHp) * 100))
  ctx.events.push({ type: 'alertChanged', from, to, integrity })
}

/** Пересчитать ступень игрока после изменения целостности (урон, регенерация, лечение). */
export function updateAlert(ctx: Ctx, c: Creature): void {
  const to = alertAfter(c)
  if (to !== undefined) setAlert(ctx, c, to)
}
