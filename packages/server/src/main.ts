import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer } from './server'

// И в dev (src/main.ts), и в prod (dist/main.js) каталог пакета — на уровень выше.
const here = dirname(fileURLToPath(import.meta.url))
const pkgDir = resolve(here, '..')

const server = await startServer({
  port: Number(process.env.GENE_PORT ?? 3000),
  dbPath: process.env.GENE_DB ?? resolve(pkgDir, 'gene.db'),
  clientDir: process.env.GENE_CLIENT_DIR ?? resolve(pkgDir, '../client/dist'),
})
console.log(`gene server: http://localhost:${server.port} (WebSocket: /ws)`)

const stop = (): void => {
  void server.close().then(() => process.exit(0))
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
