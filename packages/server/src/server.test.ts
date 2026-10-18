// Интеграционный тест через настоящий WebSocket: новая игра → ходы → перезапуск сервера → то же состояние.
import { afterAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'
import type { ClientMsg, PlayerView, ServerMsg } from '@gene/core'
import { startServer } from './server'

const dir = mkdtempSync(join(tmpdir(), 'gene-test-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

class Client {
  private queue: ServerMsg[] = []
  private waiters: ((m: ServerMsg) => void)[] = []
  constructor(private ws: WebSocket) {
    ws.on('message', (d) => {
      const msg = JSON.parse(String(d)) as ServerMsg
      const w = this.waiters.shift()
      if (w) w(msg)
      else this.queue.push(msg)
    })
  }
  static connect(port: number): Promise<Client> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`)
      ws.once('open', () => resolve(new Client(ws)))
      ws.once('error', reject)
    })
  }
  send(msg: ClientMsg): void {
    this.ws.send(JSON.stringify(msg))
  }
  next(): Promise<ServerMsg> {
    const m = this.queue.shift()
    if (m) return Promise.resolve(m)
    return new Promise((resolve) => this.waiters.push(resolve))
  }
  close(): Promise<void> {
    return new Promise((resolve) => {
      this.ws.once('close', () => resolve())
      this.ws.close()
    })
  }
}

describe('сервер (WebSocket)', () => {
  it('новая игра, ходы, перезапуск сервера, переподключение по токену', async () => {
    const dbPath = join(dir, 'game.db')
    let server = await startServer({ port: 0, dbPath, makeSeed: () => 777 })

    const health = await fetch(`http://localhost:${server.port}/health`)
    expect(await health.json()).toEqual({ ok: true })

    let c = await Client.connect(server.port)
    c.send({ type: 'hello' })
    const welcome = await c.next()
    expect(welcome.type).toBe('welcome')
    if (welcome.type !== 'welcome') return
    expect(welcome.hasActiveGame).toBe(false)
    const token = welcome.token

    c.send({ type: 'newGame', name: 'Сеть', bodyPlan: 'humanoid_fourarmed', startWeapon: 'dagger' })
    let msg = await c.next()
    expect(msg.type).toBe('view')

    let lastView: PlayerView | undefined
    const dirs = ['e', 'w', 's', 'n'] as const
    for (let seq = 1; seq <= 12; seq++) {
      c.send({ type: 'command', seq, cmd: seq % 3 === 0 ? { type: 'wait' } : { type: 'move', dir: dirs[seq % 4]! } })
      msg = await c.next()
      expect(msg.type === 'view' || msg.type === 'error').toBe(true)
      expect((msg as { seq?: number }).seq).toBe(seq)
      if (msg.type === 'view') lastView = msg.view
    }
    expect(lastView).toBeDefined()
    await c.close()

    // Перезапуск сервера на той же базе.
    await server.close()
    server = await startServer({ port: 0, dbPath })
    c = await Client.connect(server.port)
    c.send({ type: 'hello', token })
    const welcome2 = await c.next()
    expect(welcome2).toMatchObject({ type: 'welcome', token, hasActiveGame: true })
    const restored = await c.next()
    expect(restored.type).toBe('view')
    if (restored.type === 'view') {
      expect(restored.view.turn).toBe(lastView!.turn)
      expect(restored.view.player).toEqual(lastView!.player)
      expect(restored.view.map).toEqual(lastView!.map)
    }
    await c.close()
    await server.close()
  })
})
