// Реактивное состояние клиента. Игровое состояние только отображается — менять его может лишь сервер.
import { reactive } from 'vue'
import type { GameSummary, LogMessage, PlayerView, SceneMoment } from '@gene/core'

export type Screen = 'connecting' | 'create' | 'game' | 'over'

export interface LogEntry extends LogMessage {
  id: number
  fresh: boolean
  /** Сколько раз подряд пришло это сообщение. */
  count: number
}

export type ModalName =
  | null
  | 'inventory'
  | 'equipment'
  | 'skills'
  | 'help'
  | 'use'
  | 'drop'
  | 'disassemble'
  | 'bandageTarget'
  | 'repairTarget'

export const store = reactive({
  connected: false,
  screen: 'connecting' as Screen,
  token: null as string | null,
  view: null as PlayerView | null,
  log: [] as LogEntry[],
  summary: null as GameSummary | null,
  /** seq команды, ожидающей ответа (ввод заблокирован). */
  pending: null as number | null,
  /** Последнее сообщение об ошибке/отказе (показывается в логе как warning). */
  lastError: null as string | null,
  modal: null as ModalName,
  /** Предмет, выбранный для применения (ждёт выбора цели). */
  usingItemId: null as string | null,
  /** Осмотр клетки: координаты на карте. */
  inspect: null as { x: number; y: number } | null,
  /** Режим осмотра с клавиатуры (x). */
  lookMode: false,
  /** Кадр анимации многоходового действия (пока идёт — карта рисуется по нему, без монстров и предметов). */
  anim: null as AnimFrame | null,
  /** Прицел (f): клетка под курсором. */
  aim: null as { x: number; y: number } | null,
  /** Снаряд в полёте (анимация выстрела поверх обычной карты). */
  projectile: null as { x: number; y: number; glyph: string; color: string } | null,
  /** Окно-сцена включено (клавиша c, помнится в localStorage). */
  sceneEnabled: true,
  /** Текущая сцена; seq растёт с каждой новой сценой, чтобы перезапускать анимацию. */
  scene: null as { moment: SceneMoment; seq: number } | null,
})

export interface AnimFrame {
  /** Символы клеток (как map.tiles) и видимость ('2' — рядом с игроком, '1' — запомнена, '0' — неизвестна). */
  tiles: string
  vis: string
  x: number
  y: number
}

let nextLogId = 1
export const LOG_LIMIT = 100

export function pushLog(messages: LogMessage[], replace = false): void {
  for (const e of store.log) e.fresh = false
  if (replace) store.log = []
  for (const m of messages) {
    // Повтор предыдущего сообщения не дублируется, а увеличивает счётчик «×N».
    const last = store.log[store.log.length - 1]
    if (last && last.text === m.text && last.kind === m.kind) {
      last.count++
      last.turn = m.turn
      last.fresh = !replace
      continue
    }
    store.log.push({ ...m, id: nextLogId++, fresh: !replace, count: 1 })
  }
  if (store.log.length > LOG_LIMIT) store.log.splice(0, store.log.length - LOG_LIMIT)
}

export function pushWarning(text: string): void {
  const turn = store.view?.turn ?? 0
  pushLog([{ text, kind: 'warning', turn }])
}
