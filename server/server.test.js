import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lanAddresses, startServer } from './index.js'
import { createHub } from './hub.js'

let running
afterEach(async () => {
  await running?.close()
  running = null
})

function site() {
  const dir = mkdtempSync(join(tmpdir(), 'site-'))
  writeFileSync(join(dir, 'index.html'), '<h1>app</h1>')
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'assets', 'a.js'), 'console.log(1)')
  return dir
}
const boot = async () => (running = await startServer({ port: 0, distDir: site(), hub: createHub({ tickHz: 50, hideSeconds: 0.05 }) }))

/** Node's built-in WebSocket client, wrapped to collect messages. */
async function connect(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`)
  const got = []
  const waiters = []
  ws.onmessage = e => {
    const m = JSON.parse(e.data)
    got.push(m)
    waiters.forEach(w => w())
  }
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })
  const until = (pred, ms = 3000) =>
    new Promise((res, rej) => {
      const check = () => {
        const hit = got.find(pred)
        if (hit) res(hit)
      }
      waiters.push(check)
      check()
      setTimeout(() => rej(new Error('timed out waiting for message')), ms)
    })
  return { ws, got, until, send: m => ws.send(JSON.stringify(m)) }
}

describe('http', () => {
  it('serves files, falls back to the app for unknown paths, and lists LAN addresses', async () => {
    const { port } = await boot()
    expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toBe('<h1>app</h1>')
    const js = await fetch(`http://127.0.0.1:${port}/assets/a.js`)
    expect(js.headers.get('content-type')).toMatch(/javascript/)
    expect(await (await fetch(`http://127.0.0.1:${port}/play/hideseek`)).text()).toBe('<h1>app</h1>')
    const info = await (await fetch(`http://127.0.0.1:${port}/api/info`)).json()
    expect(info.port).toBe(port)
    expect(Array.isArray(info.ips)).toBe(true)
  })

  it('does not serve files outside the site folder', async () => {
    const { port } = await boot()
    const res = await fetch(`http://127.0.0.1:${port}/..%2f..%2fpackage.json`)
    expect([403, 200]).toContain(res.status)
    expect(await res.text()).not.toContain('"name": "rea"')
  })

  it('finds the non-internal IPv4 addresses', () => {
    expect(lanAddresses({
      lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
      wlan: [{ family: 'IPv6', internal: false, address: 'fe80::1' }, { family: 'IPv4', internal: false, address: '192.168.1.5' }],
    })).toEqual(['192.168.1.5'])
  })
})

describe('over a real WebSocket', () => {
  it('plays a whole game between two clients', async () => {
    const { port } = await boot()
    const a = await connect(port)
    const b = await connect(port)
    a.send({ t: 'create', name: 'Ann' })
    const { code } = await a.until(m => m.t === 'joined')
    b.send({ t: 'join', code, name: 'Bob' })
    await a.until(m => m.t === 'room' && m.players.length === 2)
    a.send({ t: 'settings', duration: 60 })
    a.send({ t: 'start' })
    const startA = await a.until(m => m.t === 'start')
    await b.until(m => m.t === 'start')
    const state = await b.until(m => m.t === 'state')
    expect(state.me).toHaveProperty('role')
    // The mafia leaves, so the villager wins.
    const mafia = startA.mafiaId === startA.you ? a : b
    const other = mafia === a ? b : a
    mafia.ws.close()
    const over = await other.until(m => m.t === 'over')
    expect(over.winner).toBe('villagers')
    other.ws.close()
  })

  it('handles large messages and rapid junk without dying', async () => {
    const { port } = await boot()
    const a = await connect(port)
    a.ws.send('x'.repeat(30000)) // over the frame limit: the server drops this connection, not itself
    await new Promise(r => setTimeout(r, 100))
    const b = await connect(port)
    b.send({ t: 'create', name: 'still works' })
    await b.until(m => m.t === 'joined')
    b.ws.close()
  })
})
