import { afterEach, describe, expect, it } from 'vitest'
import { applyCommand, createGame, type Command, type ServerMsg } from '@gene/core'
import { GameService, type Conn } from './service'
import { openStore, type Store } from './store'

class FakeConn implements Conn {
  msgs: ServerMsg[] = []
  closed = false
  send(msg: ServerMsg): void {
    this.msgs.push(msg)
  }
  close(): void {
    this.closed = true
  }
  last<T extends ServerMsg['type']>(type: T): Extract<ServerMsg, { type: T }> {
    const m = [...this.msgs].reverse().find((x) => x.type === type)
    if (!m) throw new Error(`нет сообщения ${type}`)
    return m as Extract<ServerMsg, { type: T }>
  }
}

const NEW_GAME = { type: 'newGame', name: 'Тест', bodyPlan: 'humanoid', startWeapon: 'mace' } as const
const SEED = 4242

const stores: Store[] = []
function memStore(): Store {
  const s = openStore(':memory:')
  stores.push(s)
  return s
}
afterEach(() => {
  while (stores.length) stores.pop()!.close()
})

function commands(n: number): Command[] {
  const dirs = ['e', 's', 'w', 'n', 'se', 'ne', 'sw', 'nw'] as const
  return Array.from({ length: n }, (_, i): Command => (i % 5 === 4 ? { type: 'wait' } : { type: 'move', dir: dirs[i % 8]! }))
}

/** Отправить команду и вернуть ответ (view или error). */
function send(service: GameService, conn: FakeConn, seq: number, cmd: Command): ServerMsg {
  service.handle(conn, { type: 'command', seq, cmd })
  return conn.msgs[conn.msgs.length - 1]!
}

describe('GameService', () => {
  it('hello без токена выдаёт новый токен, без активной партии', () => {
    const service = new GameService(memStore(), { makeToken: () => 'tok-1' })
    const c = new FakeConn()
    service.handle(c, { type: 'hello' })
    expect(c.msgs[0]).toEqual({ type: 'welcome', token: 'tok-1', hasActiveGame: false })
  })

  it('снапшот + лог команд дают то же состояние, что непрерывная игра', () => {
    const store = memStore()
    const service = new GameService(store, { makeSeed: () => SEED, makeToken: () => 'tok', snapshotEvery: 7 })
    const c = new FakeConn()
    service.handle(c, { type: 'hello' })
    service.handle(c, NEW_GAME)

    const cmds = commands(40)
    let seq = 1
    const accepted: Command[] = []
    for (const cmd of cmds) {
      const r = send(service, c, seq++, cmd)
      if (r.type === 'view') accepted.push(cmd)
    }
    expect(accepted.length).toBeGreaterThan(10)

    // Непрерывная игра из того же сида.
    let continuous = createGame(SEED, { name: 'Тест', bodyPlan: 'humanoid', startWeapon: 'mace' })
    for (const cmd of accepted) continuous = applyCommand(continuous, cmd).state

    // «Перезапуск сервера»: новый сервис поверх того же хранилища грузит снапшот и доигрывает лог.
    const row = store.activeGame('tok')!
    expect(store.commands(row.id).length).toBe(accepted.length % 7)
    const service2 = new GameService(store)
    const c2 = new FakeConn()
    service2.handle(c2, { type: 'hello', token: 'tok' })
    expect(c2.msgs[0]).toMatchObject({ type: 'welcome', token: 'tok', hasActiveGame: true })
    const view = c2.last('view').view
    expect(view.turn).toBe(continuous.turn)
    expect(view.player.x).toBe(continuous.creatures.p!.x)
    // И точное совпадение полного состояния.
    // @ts-expect-error доступ к приватному полю для проверки
    expect(JSON.stringify(service2.games.get('tok').state)).toBe(JSON.stringify(continuous))
  })

  it('невалидная команда не меняет состояние и не тратит ход', () => {
    const service = new GameService(memStore(), { makeSeed: () => SEED })
    const c = new FakeConn()
    service.handle(c, { type: 'hello' })
    service.handle(c, NEW_GAME)
    const before = c.last('view').view
    const r1 = send(service, c, 1, { type: 'fly' } as unknown as Command)
    expect(r1).toMatchObject({ type: 'error', seq: 1 })
    const r2 = send(service, c, 2, { type: 'stairsUp' })
    expect(r2).toMatchObject({ type: 'error', seq: 2 })
    const r3 = send(service, c, 3, { type: 'wait' })
    expect(r3.type).toBe('view')
    if (r3.type === 'view') expect(r3.view.turn).toBe(before.turn + 1)
  })

  it('новая вкладка вытесняет старую', () => {
    const service = new GameService(memStore(), { makeToken: () => 'tok' })
    const a = new FakeConn()
    service.handle(a, { type: 'hello' })
    service.handle(a, NEW_GAME)
    const b = new FakeConn()
    service.handle(b, { type: 'hello', token: 'tok' })
    expect(a.closed).toBe(true)
    expect(a.last('error').message).toMatch(/другой вкладке/)
    expect(b.last('welcome').hasActiveGame).toBe(true)
    // Старое соединение больше не управляет партией.
    expect(send(service, a, 1, { type: 'wait' }).type).toBe('error')
    expect(send(service, b, 1, { type: 'wait' }).type).toBe('view')
  })

  it('после отключения партия сохраняется и выгружается из памяти по таймеру', async () => {
    const store = memStore()
    const service = new GameService(store, { makeToken: () => 'tok', unloadAfterMs: 20 })
    const c = new FakeConn()
    service.handle(c, { type: 'hello' })
    service.handle(c, NEW_GAME)
    send(service, c, 1, { type: 'wait' })
    service.disconnect(c)
    expect(store.commands(store.activeGame('tok')!.id)).toEqual([])
    expect(store.activeGame('tok')!.snapshot.turn).toBe(1)
    await new Promise((r) => setTimeout(r, 50))
    expect(service.loadedCount).toBe(0)
  })

  it('вторая партия при активной не создаётся', () => {
    const service = new GameService(memStore())
    const c = new FakeConn()
    service.handle(c, { type: 'hello' })
    service.handle(c, NEW_GAME)
    service.handle(c, NEW_GAME)
    expect(c.last('error').message).toMatch(/активная/)
  })
})
