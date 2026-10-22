// WebSocket-соединение с сервером: токен в localStorage, переподключение, блокировка ввода до ответа.
import type { ClientMsg, Command, ServerMsg } from '@gene/core'
import { pushLog, pushWarning, store } from './store'
import { playFrames, playProjectiles, skipAnimation } from './anim'
import { nextScene } from './scene'

const TOKEN_KEY = 'gene.token'

let ws: WebSocket | null = null
let seq = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let evicted = false

function readToken(): string | undefined {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? undefined
  } catch {
    return undefined
  }
}

function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* приватный режим — токен живёт до закрытия вкладки */
  }
}

function send(msg: ClientMsg): void {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

export function connect(): void {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  ws = new WebSocket(`${proto}://${location.host}/ws`)
  ws.onopen = () => {
    store.connected = true
    const token = store.token ?? readToken()
    send(token ? { type: 'hello', token } : { type: 'hello' })
  }
  ws.onmessage = (ev) => handle(JSON.parse(String(ev.data)) as ServerMsg)
  ws.onclose = () => {
    store.connected = false
    store.pending = null
    ws = null
    if (evicted) return
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connect, 1500)
  }
}

function handle(msg: ServerMsg): void {
  switch (msg.type) {
    case 'welcome':
      store.token = msg.token
      saveToken(msg.token)
      if (!msg.hasActiveGame && store.screen !== 'over') store.screen = 'create'
      break
    case 'view': {
      skipAnimation()
      const apply = (): void => {
        store.view = msg.view
        pushLog(msg.messages, msg.fresh === true)
        store.scene = nextScene(store.scene, msg.moments, msg.fresh === true)
        if (msg.fresh) store.screen = 'game'
      }
      if (store.pending !== null && msg.seq === store.pending) store.pending = null
      if (msg.frames && msg.frames.length > 1 && store.view) playFrames(msg.frames, apply)
      else if (msg.projectiles && store.view) playProjectiles(msg.projectiles, apply)
      else apply()
      break
    }
    case 'gameOver':
      skipAnimation()
      store.summary = msg.summary
      store.screen = 'over'
      store.modal = null
      break
    case 'error':
      if (msg.seq !== undefined && msg.seq === store.pending) store.pending = null
      if (/другой вкладке/.test(msg.message)) evicted = true
      pushWarning(msg.message)
      break
  }
}

export function sendCommand(cmd: Command): void {
  if (store.pending !== null || !store.connected || store.screen !== 'game') return
  seq++
  store.pending = seq
  send({ type: 'command', seq, cmd })
}

export function newGame(name: string, bodyPlan: string, startWeapon: string): void {
  store.summary = null
  send({ type: 'newGame', name, bodyPlan, startWeapon })
}

export function backToCreate(): void {
  store.summary = null
  store.view = null
  store.log = []
  store.screen = 'create'
}
