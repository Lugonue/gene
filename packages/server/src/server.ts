// HTTP (раздача собранного клиента и health-check) + WebSocket на /ws.
import { createServer, type Server } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import { WebSocketServer, type WebSocket } from 'ws'
import type { ServerMsg } from '@gene/core'
import { GameService, type Conn, type ServiceOptions } from './service'
import { openStore, type Store } from './store'

export interface ServerOptions extends ServiceOptions {
  port?: number
  dbPath?: string
  /** Каталог собранного клиента (prod). Если не существует — раздаётся только /health. */
  clientDir?: string
}

export interface RunningServer {
  port: number
  service: GameService
  store: Store
  http: Server
  close(): Promise<void>
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
}

export function startServer(opts: ServerOptions = {}): Promise<RunningServer> {
  const store = openStore(opts.dbPath ?? 'gene.db')
  const service = new GameService(store, opts)
  const clientDir = opts.clientDir ? resolve(opts.clientDir) : undefined

  const http = createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0] ?? '/'
    if (url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
      return
    }
    if (clientDir && existsSync(clientDir)) {
      const rel = normalize(url === '/' ? '/index.html' : url).replace(/^([/\\])+/, '')
      let file = join(clientDir, rel)
      if (!file.startsWith(clientDir) || !existsSync(file) || statSync(file).isDirectory())
        file = join(clientDir, 'index.html')
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
      res.end(readFileSync(file))
      return
    }
    res.writeHead(404)
    res.end('not found')
  })

  const wss = new WebSocketServer({ server: http, path: '/ws' })
  wss.on('connection', (ws: WebSocket) => {
    const conn: Conn = {
      send(msg: ServerMsg) {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg))
      },
      close() {
        ws.close()
      },
    }
    ws.on('message', (data) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(String(data))
      } catch {
        conn.send({ type: 'error', message: 'Некорректный JSON' })
        return
      }
      try {
        service.handle(conn, parsed)
      } catch (err) {
        console.error('ошибка обработки сообщения', err)
        conn.send({ type: 'error', message: 'Внутренняя ошибка сервера' })
      }
    })
    ws.on('close', () => service.disconnect(conn))
  })

  return new Promise((resolvePromise) => {
    http.listen(opts.port ?? 3000, () => {
      const port = (http.address() as AddressInfo).port
      resolvePromise({
        port,
        service,
        store,
        http,
        close: () =>
          new Promise<void>((done) => {
            for (const client of wss.clients) client.terminate()
            wss.close()
            http.close(() => {
              service.shutdown()
              store.close()
              done()
            })
          }),
      })
    })
  })
}
