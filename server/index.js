// LAN game server: serves the built site (dist/) and the multiplayer WebSocket on one port.
//   npm run host      builds the site and starts this
// Everyone on the same Wi-Fi opens http://<this computer's address>:8787 and joins by room code.
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHub } from './hub.js'
import { attachWebSocket } from './ws.js'

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json',
}

/** This computer's addresses on the local network, e.g. ['192.168.1.20']. */
export function lanAddresses(interfaces = networkInterfaces()) {
  const out = []
  for (const list of Object.values(interfaces)) {
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push(i.address)
  }
  return out
}

/**
 * @param {{ port?: number, distDir?: string, hub?: ReturnType<typeof createHub> }} [opts]
 * @returns {Promise<{ server: import('node:http').Server, port: number, hub: object, close: () => Promise<void> }>}
 */
export function startServer({ port = 8787, distDir = resolve(fileURLToPath(new URL('../dist', import.meta.url))), hub = createHub() } = {}) {
  const root = resolve(distDir)
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    if (url.pathname === '/api/info') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      res.end(JSON.stringify({ ips: lanAddresses(), port: server.address()?.port ?? port }))
      return
    }
    let file = resolve(join(root, normalize(decodeURIComponent(url.pathname))))
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end('Forbidden')
      return
    }
    if (!existsSync(file) || statSync(file).isDirectory()) {
      const dirIndex = join(file, 'index.html')
      file = existsSync(dirIndex) ? dirIndex : join(root, 'index.html') // single-page app: unknown paths get the app
    }
    if (!existsSync(file)) {
      res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('The site is not built yet. Run: npm run build:spa')
      return
    }
    const type = TYPES[extname(file)] || 'application/octet-stream'
    res.writeHead(200, { 'content-type': type })
    // Pages served from here talk to this server (not to a browser host): tell the app so.
    res.end(extname(file) === '.html' ? readFileSync(file, 'utf8').replace('<head>', `<head><script>window.__G8_LAN__=true</script>`) : readFileSync(file))
  })
  attachWebSocket(server, conn => hub.handleConnection(conn))
  return new Promise((resolveStart, reject) => {
    server.once('error', reject)
    server.listen(port, '0.0.0.0', () => {
      resolveStart({
        server, hub, port: server.address().port,
        close: () => new Promise(done => {
          hub.close()
          server.closeAllConnections?.()
          server.close(() => done())
        }),
      })
    })
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const wanted = Number(process.env.PORT) || 8787
  startServer({ port: wanted }).then(({ port }) => {
    console.log('\nFamily game server is running.\n')
    console.log(`  On this computer:   http://localhost:${port}`)
    for (const ip of lanAddresses()) console.log(`  On your Wi-Fi:      http://${ip}:${port}   <- open this on the other devices`)
    console.log('\nOpen the address, choose "Mafia Hunt", create a room and share the 4-letter code. Ctrl+C stops the server.\n')
  }).catch(e => {
    console.error(e.code === 'EADDRINUSE' ? `Port ${wanted} is busy. Try: PORT=8800 npm run host` : e)
    process.exit(1)
  })
}
