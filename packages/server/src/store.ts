// Хранилище партий в SQLite (better-sqlite3). Узкий интерфейс Store, чтобы драйвер можно было заменить.
import Database from 'better-sqlite3'
import type { Command, GameState, GameStatus, LogMessage } from '@gene/core'

export interface GameRow {
  id: number
  token: string
  status: GameStatus
  seed: number
  snapshot: GameState
  snapshotTurn: number
  log: LogMessage[]
}

export interface Store {
  ensurePlayer(token: string): void
  hasPlayer(token: string): boolean
  createGame(token: string, seed: number, snapshot: GameState, log: LogMessage[]): number
  activeGame(token: string): GameRow | undefined
  /** Команды после последнего снапшота, по порядку. */
  commands(gameId: number): Command[]
  appendCommand(gameId: number, n: number, cmd: Command): void
  /** Новый снапшот; лог команд до него очищается. */
  saveSnapshot(gameId: number, state: GameState, log: LogMessage[]): void
  close(): void
}

export function openStore(path: string): Store {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      token TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL REFERENCES players(token),
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      seed INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL,
      snapshot_turn INTEGER NOT NULL,
      log_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS games_token ON games(token, status);
    CREATE TABLE IF NOT EXISTS commands (
      game_id INTEGER NOT NULL REFERENCES games(id),
      n INTEGER NOT NULL,
      cmd_json TEXT NOT NULL,
      PRIMARY KEY (game_id, n)
    );
  `)

  const q = {
    insertPlayer: db.prepare('INSERT OR IGNORE INTO players (token, created_at) VALUES (?, ?)'),
    getPlayer: db.prepare('SELECT token FROM players WHERE token = ?'),
    insertGame: db.prepare(
      `INSERT INTO games (token, status, created_at, updated_at, seed, snapshot_json, snapshot_turn, log_json)
       VALUES (?, 'active', ?, ?, ?, ?, ?, ?)`,
    ),
    activeGame: db.prepare(
      `SELECT id, token, status, seed, snapshot_json, snapshot_turn, log_json FROM games
       WHERE token = ? AND status = 'active' ORDER BY id DESC LIMIT 1`,
    ),
    commands: db.prepare('SELECT cmd_json FROM commands WHERE game_id = ? ORDER BY n'),
    appendCommand: db.prepare('INSERT INTO commands (game_id, n, cmd_json) VALUES (?, ?, ?)'),
    updateSnapshot: db.prepare(
      `UPDATE games SET snapshot_json = ?, snapshot_turn = ?, status = ?, log_json = ?, updated_at = ? WHERE id = ?`,
    ),
    clearCommands: db.prepare('DELETE FROM commands WHERE game_id = ?'),
  }

  const saveSnapshotTx = db.transaction((gameId: number, state: GameState, log: LogMessage[]) => {
    q.updateSnapshot.run(JSON.stringify(state), state.turn, state.status, JSON.stringify(log), Date.now(), gameId)
    q.clearCommands.run(gameId)
  })

  return {
    ensurePlayer(token) {
      q.insertPlayer.run(token, Date.now())
    },
    hasPlayer(token) {
      return q.getPlayer.get(token) !== undefined
    },
    createGame(token, seed, snapshot, log) {
      const now = Date.now()
      const r = q.insertGame.run(token, now, now, seed, JSON.stringify(snapshot), snapshot.turn, JSON.stringify(log))
      return Number(r.lastInsertRowid)
    },
    activeGame(token) {
      const row = q.activeGame.get(token) as
        | {
            id: number
            token: string
            status: GameStatus
            seed: number
            snapshot_json: string
            snapshot_turn: number
            log_json: string
          }
        | undefined
      if (!row) return undefined
      return {
        id: row.id,
        token: row.token,
        status: row.status,
        seed: row.seed,
        snapshot: JSON.parse(row.snapshot_json) as GameState,
        snapshotTurn: row.snapshot_turn,
        log: JSON.parse(row.log_json) as LogMessage[],
      }
    },
    commands(gameId) {
      return (q.commands.all(gameId) as { cmd_json: string }[]).map((r) => JSON.parse(r.cmd_json) as Command)
    },
    appendCommand(gameId, n, cmd) {
      q.appendCommand.run(gameId, n, JSON.stringify(cmd))
    },
    saveSnapshot(gameId, state, log) {
      saveSnapshotTx(gameId, state, log)
    },
    close() {
      db.close()
    },
  }
}
