import { createServer } from 'node:http'

const port = Number(process.env.GENE_PORT ?? 3000)

createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }
  res.writeHead(404)
  res.end()
}).listen(port, () => console.log(`gene server: http://localhost:${port}`))
