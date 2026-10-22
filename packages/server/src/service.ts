// Логика сессий без сети: принимает сообщения клиента, ведёт партии, пишет в хранилище.
import { randomInt, randomUUID } from 'node:crypto'
import {
  applyCommand,
  buildView,
  createGame,
  sceneMoments,
  turnFlashes,
  validateNewGame,
  type ClientMsg,
  type Command,
  type GameState,
  type GameSummary,
  type LogMessage,
  type ServerMsg,
} from '@gene/core'
import { INTRO_LINES, MONSTERS } from '@gene/data'
import { rejectText, renderEvents } from '@gene/messages'
import type { Store } from './store'

export interface Conn {
  send(msg: ServerMsg): void
  close(): void
}

export interface ServiceOptions {
  snapshotEvery?: number
  unloadAfterMs?: number
  logSize?: number
  /** Для тестов: детерминированные сиды и токены. */
  makeSeed?: () => number
  makeToken?: () => string
}

interface LoadedGame {
  gameId: number
  token: string
  state: GameState
  log: LogMessage[]
  sinceSnapshot: number
  conn?: Conn
  unloadTimer?: ReturnType<typeof setTimeout>
}

const COMMAND_TYPES = new Set([
  'move',
  'wait',
  'rest',
  'explore',
  'run',
  'pickup',
  'drop',
  'equip',
  'unequip',
  'use',
  'disassemble',
  'fire',
  'stairsDown',
  'stairsUp',
])

export class GameService {
  private readonly games = new Map<string, LoadedGame>()
  private readonly connTokens = new Map<Conn, string>()
  private readonly tokenConns = new Map<string, Conn>()
  private readonly snapshotEvery: number
  private readonly unloadAfterMs: number
  private readonly logSize: number
  private readonly makeSeed: () => number
  private readonly makeToken: () => string

  constructor(
    private readonly store: Store,
    opts: ServiceOptions = {},
  ) {
    this.snapshotEvery = opts.snapshotEvery ?? 50
    this.unloadAfterMs = opts.unloadAfterMs ?? 5 * 60_000
    this.logSize = opts.logSize ?? 100
    this.makeSeed = opts.makeSeed ?? (() => randomInt(0, 2 ** 31))
    this.makeToken = opts.makeToken ?? (() => randomUUID())
  }

  /** Сколько партий сейчас в памяти (для тестов). */
  get loadedCount(): number {
    return this.games.size
  }

  handle(conn: Conn, raw: unknown): void {
    const msg = raw as ClientMsg
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
      conn.send({ type: 'error', message: 'Некорректное сообщение' })
      return
    }
    switch (msg.type) {
      case 'hello':
        return this.hello(conn, msg.token)
      case 'newGame':
        return this.newGame(conn, msg)
      case 'command':
        return this.command(conn, msg.seq, msg.cmd)
      default:
        conn.send({ type: 'error', message: 'Неизвестный тип сообщения' })
    }
  }

  disconnect(conn: Conn): void {
    const token = this.connTokens.get(conn)
    this.connTokens.delete(conn)
    if (!token || this.tokenConns.get(token) !== conn) return
    this.tokenConns.delete(token)
    const game = this.games.get(token)
    if (!game) return
    game.conn = undefined
    this.snapshot(game)
    game.unloadTimer = setTimeout(() => {
      if (!game.conn) this.games.delete(token)
    }, this.unloadAfterMs)
    game.unloadTimer.unref?.()
  }

  /** Сохранить все загруженные партии (при остановке сервера). */
  shutdown(): void {
    for (const game of this.games.values()) {
      if (game.unloadTimer) clearTimeout(game.unloadTimer)
      this.snapshot(game)
    }
    this.games.clear()
  }

  // ---------------------------------------------------------------------------

  private hello(conn: Conn, token: string | undefined): void {
    if (typeof token !== 'string' || !this.store.hasPlayer(token)) {
      token = this.makeToken()
      this.store.ensurePlayer(token)
    }
    // Одна сессия — одна вкладка: новая вытесняет старую.
    const old = this.tokenConns.get(token)
    if (old && old !== conn) {
      old.send({ type: 'error', message: 'Партия открыта в другой вкладке.' })
      this.connTokens.delete(old)
      old.close()
    }
    this.connTokens.set(conn, token)
    this.tokenConns.set(token, conn)

    const game = this.load(token)
    if (game) {
      game.conn = conn
      if (game.unloadTimer) clearTimeout(game.unloadTimer)
      game.unloadTimer = undefined
    }
    conn.send({ type: 'welcome', token, hasActiveGame: !!game })
    if (game) conn.send({ type: 'view', seq: 0, view: buildView(game.state), messages: game.log, fresh: true })
  }

  private newGame(conn: Conn, msg: Extract<ClientMsg, { type: 'newGame' }>): void {
    const token = this.connTokens.get(conn)
    if (!token) return conn.send({ type: 'error', message: 'Сначала hello' })
    if (this.load(token)) return conn.send({ type: 'error', message: 'Уже есть активная партия' })
    const opts = { name: msg.name, bodyPlan: msg.bodyPlan, startWeapon: msg.startWeapon }
    const err = validateNewGame(opts)
    if (err) return conn.send({ type: 'error', message: err })

    const seed = this.makeSeed()
    const state = createGame(seed, opts)
    const log: LogMessage[] = INTRO_LINES.map((l) => ({ text: l.text, kind: l.kind, turn: 0 }))
    const gameId = this.store.createGame(token, seed, state, log)
    const game: LoadedGame = { gameId, token, state, log, sinceSnapshot: 0, conn }
    this.games.set(token, game)
    conn.send({ type: 'view', seq: 0, view: buildView(state), messages: log, fresh: true })
  }

  private command(conn: Conn, seq: number, cmd: Command): void {
    const token = this.connTokens.get(conn)
    const game = token ? this.games.get(token) : undefined
    if (!game || game.conn !== conn) return conn.send({ type: 'error', message: 'Нет активной партии', seq })
    if (!cmd || typeof cmd !== 'object' || !COMMAND_TYPES.has((cmd as { type?: string }).type ?? ''))
      return conn.send({ type: 'error', message: 'Некорректная команда', seq })

    const r = applyCommand(game.state, cmd)
    const rejected = r.events.find((e) => e.type === 'commandRejected')
    if (rejected && rejected.type === 'commandRejected')
      return conn.send({ type: 'error', message: rejectText(rejected.reason), seq })

    game.state = r.state
    this.store.appendCommand(game.gameId, game.sinceSnapshot, cmd)
    game.sinceSnapshot++
    const messages = renderEvents(r.events, game.state.playerId, { turn: game.state.turn, seed: game.state.seed })
    this.appendLog(game, messages)

    const over = game.state.status !== 'active'
    if (over || game.sinceSnapshot >= this.snapshotEvery) this.snapshot(game)
    const moments = sceneMoments(r.events, game.state.playerId)
    conn.send({
      type: 'view',
      seq,
      view: buildView(game.state),
      messages,
      ...(r.frames ? { frames: r.frames } : {}),
      ...(r.projectiles ? { projectiles: r.projectiles } : {}),
      ...(moments.length > 0 ? { moments } : {}),
      ...(turnFlashes(r.events) ? { criticalFlash: true as const } : {}),
    })
    if (over) {
      conn.send({ type: 'gameOver', summary: summarize(game.state, game.log) })
      this.games.delete(game.token)
    }
  }

  /** Партия из памяти или из хранилища (снапшот + повтор лога команд). */
  private load(token: string): LoadedGame | undefined {
    const inMemory = this.games.get(token)
    if (inMemory) return inMemory
    const row = this.store.activeGame(token)
    if (!row) return undefined
    let state = row.snapshot
    const log = row.log
    const cmds = this.store.commands(row.id)
    const game: LoadedGame = { gameId: row.id, token, state, log, sinceSnapshot: cmds.length }
    for (const cmd of cmds) {
      const r = applyCommand(state, cmd)
      state = r.state
      this.appendLog(game, renderEvents(r.events, state.playerId, { turn: state.turn, seed: state.seed }))
    }
    game.state = state
    this.games.set(token, game)
    return game
  }

  private appendLog(game: LoadedGame, messages: LogMessage[]): void {
    game.log.push(...messages)
    if (game.log.length > this.logSize) game.log.splice(0, game.log.length - this.logSize)
  }

  private snapshot(game: LoadedGame): void {
    this.store.saveSnapshot(game.gameId, game.state, game.log)
    game.sinceSnapshot = 0
  }
}

export function summarize(state: GameState, log: LogMessage[]): GameSummary {
  const p = state.creatures[state.playerId]
  const summary: GameSummary = {
    status: state.status === 'won' ? 'won' : 'dead',
    name: p?.name ?? '',
    depth: state.depth,
    maxDepth: state.maxDepthReached,
    turns: state.turn,
    lastMessages: log.slice(-10),
  }
  if (state.killedBy) summary.killedBy = MONSTERS[state.killedBy]?.name.nom ?? state.killedBy
  return summary
}
