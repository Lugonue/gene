// Протокол клиент ↔ сервер (WebSocket, JSON).
import type { Command } from './state'
import type { PlayerView } from './view'
import type { SceneMoment } from './scene'

export type LogKind = 'narrative' | 'system' | 'warning'

export interface LogMessage {
  text: string
  /** narrative — события мира; system — сообщения ядра/диагностики (HUD); warning — отказы, ошибки. */
  kind: LogKind
  turn: number
}

/**
 * Кадр анимации многоходового действия: позиция игрока после шага и клетки памяти карты,
 * изменившиеся на этом шаге (cells[i] — индекс y*width+x, tiles[i] — символ).
 */
export interface MoveFrame {
  x: number
  y: number
  cells: number[]
  tiles: string
}

/** Полёт снаряда, видимый игроку: клетки пути (индексы y*width+x) и что летит — предмет или заклинание. */
export interface ProjectileTrail {
  cells: number[]
  itemDefId?: string
  spellId?: string
}

export interface GameSummary {
  status: 'dead' | 'won'
  name: string
  depth: number
  maxDepth: number
  turns: number
  /** Название того, кто убил (им. п.), если смерть. */
  killedBy?: string
  lastMessages: LogMessage[]
}

export type ClientMsg =
  | { type: 'hello'; token?: string }
  | { type: 'newGame'; name: string; bodyPlan: string; startWeapon: string }
  | { type: 'command'; seq: number; cmd: Command }

export type ServerMsg =
  | { type: 'welcome'; token: string; hasActiveGame: boolean; lastSummary?: GameSummary }
  | {
      type: 'view'
      seq: number
      view: PlayerView
      messages: LogMessage[]
      fresh?: boolean
      frames?: MoveFrame[]
      projectiles?: ProjectileTrail[]
      /** Яркие моменты хода для окна-сцены (сцену выбирает клиент). */
      moments?: SceneMoment[]
    }
  | { type: 'gameOver'; summary: GameSummary }
  | { type: 'error'; message: string; seq?: number }
