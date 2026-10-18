// Модуль сообщений: события core → русский текст. Полные шаблоны — этап 5.
import type { GameEvent, LogMessage } from '@gene/core'

export interface RenderOptions {
  /** Номер хода — попадает в LogMessage и в сид выбора вариантов шаблона. */
  turn?: number
  seed?: number
}

export function renderEvents(events: GameEvent[], _viewerId: string, opts: RenderOptions = {}): LogMessage[] {
  const turn = opts.turn ?? 0
  const out: LogMessage[] = []
  for (const e of events) {
    switch (e.type) {
      case 'doorOpened':
        out.push({ text: 'Ты открываешь дверь.', kind: 'narrative', turn })
        break
      case 'levelChanged':
        out.push({
          text: e.dir === 'down' ? `Ты спускаешься на уровень ${e.depth}.` : `Ты поднимаешься на уровень ${e.depth}.`,
          kind: 'narrative',
          turn,
        })
        break
      case 'gameWon':
        out.push({ text: '[ЯДРО] Портал активирован. Возврат во временную линию…', kind: 'system', turn })
        break
    }
  }
  return out
}

export function rejectText(reason: string): string {
  return `Нельзя: ${reason}`
}
