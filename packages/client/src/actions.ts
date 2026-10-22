// Действия интерфейса с предметами (собирают команды и открывают окна выбора цели).
import { ITEMS } from '@gene/data'
import type { ItemView } from '@gene/core'
import { sendCommand } from './net'
import { pushWarning, store } from './store'
import { NO_TARGETS_TEXT, useTargets } from './targets'

/** Эффект применяемого расходника; у боеприпасов его нет — они тратятся при выстреле. */
export function consumableEffect(item: ItemView): string | undefined {
  const def = ITEMS[item.defId]
  return def?.category === 'consumable' && def.effect !== 'ammo' ? def.effect : undefined
}

/** Применить предмет: зелье — сразу, бинт и ремкомплект — через выбор цели. */
export function useItem(item: ItemView): void {
  const effect = consumableEffect(item)
  if (!effect) return
  if (effect === 'healPotion') {
    store.modal = null
    sendCommand({ type: 'use', itemId: item.id })
    return
  }
  const mode = effect === 'bandage' ? 'bandage' : 'repair'
  // Применить не к чему — окно не открывается, ход не тратится.
  if (store.view && useTargets(store.view, item.id, mode).length === 0) {
    store.modal = null
    pushWarning(NO_TARGETS_TEXT[mode])
    return
  }
  store.usingItemId = item.id
  store.modal = mode === 'bandage' ? 'bandageTarget' : 'repairTarget'
}

export function toggleEquip(item: ItemView): void {
  store.modal = null
  if (item.equippedSlot) sendCommand({ type: 'unequip', slot: item.equippedSlot })
  else sendCommand({ type: 'equip', itemId: item.id })
}

export function dropItem(item: ItemView): void {
  store.modal = null
  sendCommand({ type: 'drop', itemId: item.id })
}

export function disassembleItem(item: ItemView): void {
  store.modal = null
  sendCommand({ type: 'disassemble', itemId: item.id })
}

export const STATUS_LABEL = { unknown: 'не изучен', partial: 'частично изучен', known: 'изучен' } as const
