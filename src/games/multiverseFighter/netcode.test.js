import { afterEach, describe, expect, it, vi } from 'vitest'
import { PEER_PREFIX, PROTOCOL_VERSION, ROOM_ALPHABET, createRoom, describeError, isValidCode, joinRoom, normalizeCode, peerOptions, randomCode } from './netcode'

// A tiny in-memory stand-in for PeerJS: peers register by id, connect() pairs two connections and delivers JSON
// copies of whatever is sent, asynchronously, the way a real data channel would.
function fakeNetwork() {
  const peers = new Map()
  let n = 0
  class Conn {
    constructor(label, peer) {
      this.label = label
      this.peer = peer
      this.open = false
      this.h = {}
      this.other = null
    }
    on(ev, fn) {
      ;(this.h[ev] ||= []).push(fn)
      return this
    }
    emit(ev, ...a) {
      for (const f of this.h[ev] || []) f(...a)
    }
    send(msg) {
      if (!this.open) throw new Error('closed')
      const copy = JSON.parse(JSON.stringify(msg))
      setTimeout(() => this.other?.open && this.other.emit('data', copy), 0)
    }
    close() {
      if (!this.open) return
      this.open = false
      this.emit('close')
      if (this.other?.open) {
        this.other.open = false
        this.other.emit('close')
      }
    }
  }
  class Peer {
    constructor(id, opts) {
      if (typeof id === 'object') id = undefined
      void opts
      this.id = id ?? `guest-${++n}`
      this.h = {}
      this.conns = []
      this.destroyed = false
      this.disconnected = false
      setTimeout(() => {
        if (peers.has(this.id)) this.emit('error', { type: 'unavailable-id' })
        else {
          peers.set(this.id, this)
          this.emit('open', this.id)
        }
      }, 0)
    }
    on(ev, fn) {
      ;(this.h[ev] ||= []).push(fn)
      return this
    }
    off(ev, fn) {
      this.h[ev] = (this.h[ev] || []).filter(f => f !== fn)
    }
    emit(ev, ...a) {
      for (const f of [...(this.h[ev] || [])]) f(...a)
    }
    connect(id, opts) {
      const a = new Conn(opts.label, id)
      const remote = peers.get(id)
      this.conns.push(a)
      if (!remote) {
        setTimeout(() => this.emit('error', { type: 'peer-unavailable' }), 0)
        return a
      }
      const b = new Conn(opts.label, this.id)
      a.other = b
      b.other = a
      remote.conns.push(b)
      setTimeout(() => {
        a.open = true
        b.open = true
        remote.emit('connection', b)
        a.emit('open')
        b.emit('open')
      }, 0)
      return a
    }
    destroy() {
      this.destroyed = true
      peers.delete(this.id)
      this.conns.forEach(c => c.close())
    }
    reconnect() {}
  }
  return { peers, Peer }
}

const wait = (ms = 40) => new Promise(r => setTimeout(r, ms))
const sessions = []
afterEach(async () => {
  sessions.splice(0).forEach(s => s.close())
  await wait(120)
})
const track = s => (sessions.push(s), s)

describe('room codes', () => {
  it('are 5 characters from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const c = randomCode()
      expect(c).toHaveLength(5)
      expect([...c].every(ch => ROOM_ALPHABET.includes(ch))).toBe(true)
      expect(isValidCode(c)).toBe(true)
    }
    expect(ROOM_ALPHABET).not.toMatch(/[IO01]/)
  })
  it('are cleaned up from what people type', () => {
    expect(normalizeCode(' k7q-mx9 ')).toBe('K7QMX')
    expect(isValidCode('K7QM')).toBe(false)
    expect(isValidCode('K7QMI')).toBe(false)
  })
})

describe('peer configuration', () => {
  it('uses the public PeerJS cloud and STUN by default', () => {
    const o = peerOptions({})
    expect(o.host).toBeUndefined()
    expect(o.config.iceServers[0].urls.length).toBeGreaterThan(0)
  })
  it('is overridden by VITE_ env vars', () => {
    const o = peerOptions({ VITE_PEER_HOST: 'peers.example.com', VITE_PEER_PORT: '9001', VITE_PEER_PATH: '/mv', VITE_PEER_SECURE: 'false', VITE_TURN_URL: 'turn:t.example.com', VITE_TURN_USERNAME: 'u', VITE_TURN_CREDENTIAL: 'p', VITE_STUN_URLS: 'stun:s.example.com' })
    expect(o).toMatchObject({ host: 'peers.example.com', port: 9001, path: '/mv', secure: false })
    expect(o.config.iceServers).toEqual([{ urls: ['stun:s.example.com'] }, { urls: 'turn:t.example.com', username: 'u', credential: 'p' }])
  })
})

describe('friendly errors', () => {
  it.each([
    ['peer-unavailable', 'not-found'],
    ['unavailable-id', 'id-taken'],
    ['server-error', 'server-down'],
    ['socket-error', 'server-down'],
    ['network', 'server-down'],
    ['browser-incompatible', 'incompatible'],
    ['webrtc', 'webrtc'],
    ['something-new', 'unknown'],
  ])('maps %s to %s with a readable message', (type, code) => {
    const e = describeError({ type })
    expect(e.code).toBe(code)
    expect(e.message.length).toBeGreaterThan(20)
    expect(e.message).not.toMatch(/undefined|\[object/)
  })
})

describe('a room between two players', () => {
  const setup = async () => {
    const net = fakeNetwork()
    const host = track(await createRoom({ name: 'Host', fighter: 'thor', peerFactory: net.Peer }))
    const events = []
    host.onStatus(s => events.push(s))
    const guest = track(await joinRoom(host.code, { name: 'Guest', fighter: 'hulk', peerFactory: net.Peer }))
    await wait()
    return { net, host, guest, events }
  }

  it('registers the host under a prefixed code and connects a guest with a hello exchange', async () => {
    const { net, host, guest, events } = await setup()
    expect(net.peers.has(PEER_PREFIX + host.code)).toBe(true)
    expect(events.find(e => e.type === 'connected').remote.fighter).toBe('hulk')
    expect(guest.remote.fighter).toBe('thor')
    expect(host.role).toBe('host')
    expect(guest.role).toBe('guest')
  })

  it('sends input guest to host, snapshots host to guest, and control both ways', async () => {
    const { host, guest } = await setup()
    const input = vi.fn()
    const snap = vi.fn()
    const hostCtl = vi.fn()
    const guestCtl = vi.fn()
    host.onInput(input)
    guest.onSnapshot(snap)
    host.onControl(hostCtl)
    guest.onControl(guestCtl)
    guest.sendInput(7, 18)
    host.sendSnapshot({ fr: 3, f: [] })
    guest.sendControl({ t: 'ready', v: true })
    host.sendControl({ t: 'start', seed: 5, chars: ['a', 'b'] })
    await wait()
    expect(input).toHaveBeenCalledWith({ seq: 7, mask: 18 })
    expect(snap).toHaveBeenCalledWith(expect.objectContaining({ fr: 3 }))
    expect(hostCtl).toHaveBeenCalledWith({ t: 'ready', v: true })
    expect(guestCtl).toHaveBeenCalledWith({ t: 'start', seed: 5, chars: ['a', 'b'] })
  })

  it('does not let a guest send snapshots or a host send input', async () => {
    const { host, guest } = await setup()
    expect(guest.sendSnapshot({ fr: 1 })).toBe(false)
    expect(host.sendInput(1, 1)).toBe(false)
  })

  it('stops delivering to an unsubscribed listener', async () => {
    const { host, guest } = await setup()
    const fn = vi.fn()
    const off = host.onControl(fn)
    off()
    guest.sendControl({ t: 'ready', v: true })
    await wait()
    expect(fn).not.toHaveBeenCalled()
  })

  it('tells the host when the guest leaves, then tears everything down', async () => {
    const { net, host, guest, events } = await setup()
    guest.close()
    await wait(150)
    expect(events.some(e => e.type === 'left')).toBe(true)
    host.close()
    await wait(150)
    expect(net.peers.size).toBe(0)
    expect(() => host.close()).not.toThrow()
  })

  it('turns a second guest away from a full room', async () => {
    const { net, host } = await setup()
    await expect(joinRoom(host.code, { peerFactory: net.Peer })).rejects.toMatchObject({ code: 'full' })
  })

  it('rejects a guest on another protocol version', async () => {
    const { net, host } = await setup()
    const stranger = new net.Peer(undefined, {})
    await wait()
    const conn = stranger.connect(PEER_PREFIX + host.code, { label: 'ctl' })
    const replies = []
    conn.on('data', m => replies.push(m))
    await wait()
    conn.send({ t: 'hello', v: PROTOCOL_VERSION + 1, token: 'zzz' })
    await vi.waitFor(() => expect(replies).toContainEqual({ t: 'reject', reason: 'version' }))
    stranger.destroy()
  })

  it('reports a missing room with a friendly message', async () => {
    const net = fakeNetwork()
    await expect(joinRoom('ZZZZZ', { peerFactory: net.Peer })).rejects.toMatchObject({ code: 'not-found' })
  })

  it('rejects a malformed code before touching the network', async () => {
    await expect(joinRoom('hi', { peerFactory: class { constructor() { throw new Error('should not be called') } } })).rejects.toMatchObject({ code: 'bad-code' })
  })

  it('retries when a generated room code is already taken', async () => {
    const net = fakeNetwork()
    const first = track(await createRoom({ peerFactory: net.Peer }))
    const second = track(await createRoom({ peerFactory: net.Peer }))
    expect(second.code).not.toBe(first.code)
  })
})
