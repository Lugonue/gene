// Цели применения бинта и ремкомплекта: только те, к которым предмет применим.
import { REJECT_TEXT } from '@gene/data'
import type { Command, PlayerView } from '@gene/core'
import { EFF_COLORS, WOUND_COLORS } from './colors'

export type TargetMode = 'bandage' | 'repair'

export interface Target {
  key: string
  label: string
  detail: string
  color: string
  cmd: Command
}

/** Что пишется в журнал, когда применить предмет не к чему. */
export const NO_TARGETS_TEXT: Record<TargetMode, string> = {
  bandage: REJECT_TEXT.fullHealth,
  repair: REJECT_TEXT.nothingToRepair,
}


/** Цели: бинт — повреждённые органические части; ремкомплект — повреждённая бионика и предметы с неполной прочностью. Флаги повреждения — из ядра. */
export function targetsFor(view: PlayerView, itemId: string, mode: TargetMode): Target[] {
  const list: Target[] = []
  const material = mode === 'bandage' ? 'organic' : 'bionic'
  for (const part of view.player.parts.filter((p) => p.material === material && p.damaged)) {
    list.push({
      key: String(list.length + 1),
      label: `${part.material === 'bionic' ? '[Б]' : '[О]'} ${part.name}`,
      detail: `${part.label} ${part.hp}/${part.maxHp}`,
      color: WOUND_COLORS[part.wound],
      cmd: { type: 'use', itemId, targetPartId: part.id },
    })
  }
  if (mode === 'repair') {
    for (const it of view.inventory.filter((i) => i.category !== 'consumable' && i.damaged)) {
      list.push({
        key: it.letter ?? '',
        label: `${it.name}${it.equippedSlot ? ' (надет)' : ''}`,
        detail: it.durabilityText ?? '',
        color: EFF_COLORS[it.effTier ?? 4]!,
        cmd: { type: 'use', itemId, targetItemId: it.id },
      })
    }
  }
  return list
}
