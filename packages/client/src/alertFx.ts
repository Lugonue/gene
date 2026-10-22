// Отображение ступени тревоги: виньетка по краю карты, плашка и цвет полосы целостности в HUD, вспышка.
import type { AlertStage } from '@gene/core'

export interface AlertLook {
  /** Мягкая пульсирующая красная виньетка по краю карты. */
  vignette: boolean
  /** Мигающая плашка «КРИТИЧЕСКОЕ СОСТОЯНИЕ». */
  banner: boolean
  /** Полоса целостности: обычная, жёлтая или красная мигающая. */
  bar: 'ok' | 'danger' | 'critical'
}

export function alertLook(alert: AlertStage): AlertLook {
  if (alert === 'critical') return { vignette: true, banner: true, bar: 'critical' }
  if (alert === 'danger') return { vignette: false, banner: false, bar: 'danger' }
  return { vignette: false, banner: false, bar: 'ok' }
}

/**
 * Номер вспышки после хода: растёт, когда ход принёс флаг вспышки (смена номера перезапускает анимацию).
 * Полный вид после переподключения вспышку не запускает.
 */
export function nextFlash(flashSeq: number, msg: { criticalFlash?: true; fresh?: boolean }): number {
  return msg.criticalFlash && !msg.fresh ? flashSeq + 1 : flashSeq
}
