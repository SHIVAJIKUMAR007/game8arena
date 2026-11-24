import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHub } from '../../../server/hub.js'
import { SignalRoom } from '../../../worker/signalRoom.js'
import { signalBase, transportMode } from './net'
import { CONNECT_TIMEOUT_MS, createP2PSocket } from './p2p'

// A tiny in-memory internet: one SignalRoom per code behind fake WebSockets, and fake RTCPeerConnections whose data
// channels link straight to their partner once the offer/answer has been exchanged.

const tick = () => new Promise(r => setTimeout(r, 0))
const settle = async () => { for (let i = 0; i < 8; i++) await tick() }

function internet({ down = false } = {}) {
  const rooms = new Map()
  const roomFor = code => {
    if (!rooms.has(code)) {
      const sockets = []
      rooms.set(code, new SignalRoom({
        acceptWebSocket: (ws, tags) => { ws.tags = tags; ws.live = true; sockets.push(ws) },
        getWebSockets: tag => sockets.filter(s => s.live && (!tag || s.tags.includes(tag))),
        getTags: ws => ws.tags,
      }))
    }
    return rooms.get(code)
  }

  class FakeWebSocket {
    constructor(url) {
      this.readyState = 0
      const [, code, role] = url.match(/\/signal\/([A-Z]{4})\?role=(\w+)/)
      this.sent = []
      // The Durable Object's side of this socket
      this.server = {
        send: t => queueMicrotask(() => this.live && this.onmessage?.({ data: t })),
        close: () => { this.server.live = false; this.readyState = 3; queueMicrotask(() => this.onclose?.()) },
      }
      queueMicrotask(() => {
        if (down) { this.readyState = 3; this.onclose?.(); return }
        this.readyState = 1
        this.live = true
        roomFor(code).admit(this.server, role)
        this.server.live = this.server.live ?? this.live
      })
      this.room = roomFor(code)
    }
    send(t) { if (t !== 'ping') this.room.webSocketMessage(this.server, t) }
    close() {
      if (this.readyState === 3) return
      this.readyState = 3
      this.live = false
      this.server.live = false
      this.room.webSocketClose(this.server)
      queueMicrotask(() => this.onclose?.())
    }
  }

  const offers = new Map()
  let nextPc = 1
  class FakePC {
    constructor() {
      this.id = nextPc++
      this.connectionState = 'new'
      this.channels = []
    }
    createDataChannel() {
      this.local = makeChannel()
      return this.local
    }
    async createOffer() { return { type: 'offer', pc: this.id } }
    async createAnswer() { return { type: 'answer', pc: this.id } }
    async setLocalDescription(d) {
      this.localDescription = d
      if (d.type === 'offer') offers.set(d.pc, this)
    }
    async setRemoteDescription(d) {
      this.remote = d
      if (d.type === 'offer') {
        // the host side learns about the guest's channel and opens it
        const guest = offers.get(d.pc)
        const mine = makeChannel()
        link(guest.local, mine)
        queueMicrotask(() => {
          this.ondatachannel?.({ channel: mine })
          mine.readyState = 'open'
          mine.onopen?.()
          guest.local.readyState = 'open'
          guest.local.onopen?.()
        })
        this.partner = guest
        guest.partner = this
      }
    }
    async addIceCandidate() {}
    close() {
      if (this.closed) return
      this.closed = true
      this.local?.close()
      this.partner?.local?.close()
    }
  }
  function makeChannel() {
    return {
      readyState: 'connecting',
      send(text) { queueMicrotask(() => this.peer?.readyState === 'open' && this.peer.onmessage?.({ data: text })) },
      close() {
        if (this.readyState === 'closed') return
        this.readyState = 'closed'
        queueMicrotask(() => { this.onclose?.(); if (this.peer?.readyState === 'open') this.peer.close() })
      },
    }
  }
  function link(a, b) { a.peer = b; b.peer = a }

  return { WebSocketImpl: FakeWebSocket, RTCPeerConnectionImpl: FakePC, loadHub: async () => ({ createHub: () => createHub({ tickHz: 5 }) }) }
}

function client(net) {
  const s = createP2PSocket({ signalBase: 'wss://test', ...net })
  const got = []
  s.onmessage = e => got.push(JSON.parse(e.data))
  s.closed = false
  s.onclose = () => { s.closed = true }
  const say = msg => s.send(JSON.stringify(msg))
  return { s, got, say, last: t => got.filter(m => m.t === t).at(-1) }
}

const open = []
afterEach(() => { open.splice(0).forEach(c => c.s.close()); vi.useRealTimers() })
const make = net => { const c = client(net); open.push(c); return c }

describe('browser-hosted rooms', () => {
  it('a host makes a room and a friend joins it through the matchmaking relay', async () => {
    const net = internet()
    const host = make(net)
    await settle()
    host.say({ t: 'create', name: 'Ann', game: 'undercover' })
    await settle()
    const joined = host.last('joined')
    expect(joined.code).toMatch(/^[A-Z]{4}$/)
    expect(host.last('room').players.map(p => p.name)).toEqual(['Ann'])

    const friend = make(net)
    await settle()
    friend.say({ t: 'join', code: joined.code.toLowerCase(), name: 'Bob', game: 'undercover' })
    await settle()
    expect(friend.last('joined').code).toBe(joined.code)
    expect(friend.last('room').players.map(p => p.name)).toEqual(['Ann', 'Bob'])
    expect(host.last('room').players.map(p => p.name)).toEqual(['Ann', 'Bob'])
    expect(friend.last('room').hostId).toBe(host.last('joined').id)
  })

  it('shows an error for an unknown code and lets the player try another one', async () => {
    const net = internet()
    const friend = make(net)
    await settle()
    friend.say({ t: 'join', code: 'ZZZZ', name: 'Bob', game: 'hideseek' })
    await settle()
    expect(friend.last('error').message).toMatch(/Room not found/)
    friend.say({ t: 'join', code: 'ab', name: 'Bob', game: 'hideseek' })
    await settle()
    expect(friend.got.filter(m => m.t === 'error')).toHaveLength(2)
  })

  it('reports a room for another game as an error from the host', async () => {
    const net = internet()
    const host = make(net), friend = make(net)
    await settle()
    host.say({ t: 'create', name: 'Ann', game: 'hideseek' })
    await settle()
    friend.say({ t: 'join', code: host.last('joined').code, name: 'Bob', game: 'undercover' })
    await settle()
    expect(friend.last('error').message).toMatch(/Mafia Hunt/)
  })

  it('ends the room for guests when the host leaves', async () => {
    const net = internet()
    const host = make(net), friend = make(net)
    await settle()
    host.say({ t: 'create', name: 'Ann', game: 'hideseek' })
    await settle()
    friend.say({ t: 'join', code: host.last('joined').code, name: 'Bob', game: 'hideseek' })
    await settle()
    host.say({ t: 'leave' })
    await settle()
    expect(friend.s.closed).toBe(true)
    // the old code no longer leads anywhere
    const late = make(net)
    await settle()
    late.say({ t: 'join', code: host.last('joined').code, name: 'Cy', game: 'hideseek' })
    await settle()
    expect(late.last('error').message).toMatch(/Room not found/)
  })

  it('removes a guest from the room when they leave, and the host can host again afterwards', async () => {
    const net = internet()
    const host = make(net), friend = make(net)
    await settle()
    host.say({ t: 'create', name: 'Ann', game: 'hideseek' })
    await settle()
    friend.say({ t: 'join', code: host.last('joined').code, name: 'Bob', game: 'hideseek' })
    await settle()
    friend.say({ t: 'leave' })
    await settle()
    expect(host.last('room').players.map(p => p.name)).toEqual(['Ann'])
    host.say({ t: 'leave' })
    host.say({ t: 'create', name: 'Ann', game: 'hideseek' })
    await settle()
    expect(host.got.filter(m => m.t === 'joined')).toHaveLength(2)
  })

  it('tells the host when the matchmaking service cannot be reached', async () => {
    const host = make(internet({ down: true }))
    await settle()
    host.say({ t: 'create', name: 'Ann', game: 'hideseek' })
    await settle()
    expect(host.last('error').message).toMatch(/matchmaking/)
    expect(host.last('joined')).toBeUndefined()
  })

  it('gives up on a guest that never connects', async () => {
    vi.useFakeTimers()
    const net = internet()
    // A host exists, but its peer connection never answers
    const stuck = net.RTCPeerConnectionImpl
    net.RTCPeerConnectionImpl = class extends stuck {
      async setRemoteDescription() {}
    }
    const host = make(net), friend = make(net)
    await vi.advanceTimersByTimeAsync(10)
    host.say({ t: 'create', name: 'Ann', game: 'hideseek' })
    await vi.advanceTimersByTimeAsync(10)
    friend.say({ t: 'join', code: host.last('joined').code, name: 'Bob', game: 'hideseek' })
    await vi.advanceTimersByTimeAsync(CONNECT_TIMEOUT_MS + 100)
    expect(friend.last('error').message).toMatch(/Could not connect/)
  })
})

describe('choosing how to reach a room', () => {
  const loc = (search = '') => ({ search, host: 'game8arena.com', protocol: 'https:' })
  it('uses browser hosting on the live site and a Node server in development, on a LAN host, or when pointed at one', () => {
    expect(transportMode(loc(), false, false)).toBe('p2p')
    expect(transportMode(loc(), true, false)).toBe('ws')
    expect(transportMode(loc(), false, true)).toBe('ws')
    expect(transportMode(loc('?server=10.0.0.5:8787'), false, false)).toBe('ws')
    expect(transportMode(loc('?p2p=1'), true, false)).toBe('p2p')
    expect(transportMode(loc('?server=evil.com/x'), false, false)).toBe('p2p')
  })

  it('finds the matchmaking Worker on the page host unless told otherwise', () => {
    expect(signalBase(loc())).toBe('wss://game8arena.com')
    expect(signalBase(loc('?signal=localhost:8787'))).toBe('ws://localhost:8787')
    expect(signalBase(loc('?signal=bad/host'))).toBe('wss://game8arena.com')
  })
})
