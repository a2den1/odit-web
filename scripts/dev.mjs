// Local stand-in for Vercel: serves the static site with clean URLs and runs
// api/*.js the way Vercel does. Reads .env.local if present.
//   node scripts/dev.mjs [port]
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const port = Number(process.argv[2] || process.env.PORT || 5321)

const envFile = path.join(root, '.env.local')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon',
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  let p = decodeURIComponent(url.pathname)

  const api = p.match(/^\/api\/([a-z0-9-]+)$/)
  if (api) {
    const file = path.join(root, 'api', api[1] + '.js')
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('no such api') }
    try {
      await require(file)(req, res)
    } catch (e) {
      console.error(e)
      if (!res.headersSent) { res.statusCode = 500; res.end('api error') }
    }
    return
  }

  if (p.endsWith('/')) p += 'index.html'
  let file = path.join(root, p)
  if (!file.startsWith(root)) { res.statusCode = 403; return res.end() }
  if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html'
  else if (!path.extname(file) && fs.existsSync(path.join(file, 'index.html'))) file = path.join(file, 'index.html')
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end('not found') }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream')
    res.setHeader('Cache-Control', 'no-store')
    res.end(buf)
  })
}).listen(port, () => console.log(`ODIT site on http://localhost:${port}`))
