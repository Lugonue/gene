// Протокол клиент ↔ сервер (WebSocket, JSON).
import type { Command } from './state'
import type { PlayerView } from './view'

export type LogKind = 'narrative' | 'system' | 'warning'

export interface LogMessage {
  text: string
  /** narrative — события мира; system — сообщения ядра/диагностики (HUD); warning — отказы, ошибки. */
  kind: LogKind
  turn: number
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
  | { type: 'view'; seq: number; view: PlayerView; messages: LogMessage[]; fresh?: boolean }
  | { type: 'gameOver'; summary: GameSummary }
  | { type: 'error'; message: string; seq?: number }
