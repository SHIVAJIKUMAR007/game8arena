import { describe, expect, it } from 'vitest'
import { MAX_GUESTS, SignalRoom } from './signalRoom.js'

/** A fake Durable Object context that remembers sockets and their tags. */
function setup() {
  const sockets = []
  const ctx = {
    acceptWebSocket: (ws, tags) => { ws.tags = tags; ws.open = true; sockets.push(ws) },
    getWebSockets: tag => sockets.filter(s => s.open && (!tag || s.tags.includes(tag))),
    getTags: ws => ws.tags,
  }
  const make = () => {
    const ws = { sent: [], open: false, send: t => ws.sent.push(JSON.parse(t)), close: () => { ws.open = false } }
    return ws
  }
  return { room: new SignalRoom(ctx), make }
}

describe('SignalRoom', () => {
  it('accepts one host and refuses a second one', () => {
    const { room, make } = setup()
    const a = make(), b = make()
    room.admit(a, 'host')
    room.admit(b, 'host')
    expect(a.sent).toEqual([{ t: 'ready' }])
    expect(b.sent).toEqual([{ t: 'taken' }])
    expect(b.open).toBe(false)
  })

  it('tells a guest when there is no host, and introduces guests to the host', () => {
    const { room, make } = setup()
    const lost = make()
    room.admit(lost, 'guest')
    expect(lost.sent).toEqual([{ t: 'nohost' }])
    const host = make(), guest = make()
    room.admit(host, 'host')
    room.admit(guest, 'guest')
    const hello = guest.sent[0]
    expect(hello.t).toBe('hello')
    expect(host.sent[1]).toEqual({ t: 'guest', id: hello.id })
  })

  it('relays set-up messages both ways and only to the right peer', () => {
    const { room, make } = setup()
    const host = make(), g1 = make(), g2 = make()
    room.admit(host, 'host')
    room.admit(g1, 'guest')
    room.admit(g2, 'guest')
    const id1 = g1.sent[0].id
    room.webSocketMessage(g1, JSON.stringify({ t: 'signal', data: { sdp: 'offer' } }))
    expect(host.sent.at(-1)).toEqual({ t: 'signal', from: id1, data: { sdp: 'offer' } })
    room.webSocketMessage(host, JSON.stringify({ t: 'signal', to: id1, data: { sdp: 'answer' } }))
    expect(g1.sent.at(-1)).toEqual({ t: 'signal', data: { sdp: 'answer' } })
    expect(g2.sent).toHaveLength(1) // only its hello
  })

  it('ignores malformed or oversized messages', () => {
    const { room, make } = setup()
    const host = make(), g = make()
    room.admit(host, 'host')
    room.admit(g, 'guest')
    const before = host.sent.length
    room.webSocketMessage(g, 'not json')
    room.webSocketMessage(g, JSON.stringify({ t: 'other' }))
    room.webSocketMessage(g, JSON.stringify({ t: 'signal', data: 'x'.repeat(20000) }))
    room.webSocketMessage(g, new ArrayBuffer(4))
    expect(host.sent).toHaveLength(before)
  })

  it('tells the host when a guest leaves and sends guests away when the host leaves', () => {
    const { room, make } = setup()
    const host = make(), g = make()
    room.admit(host, 'host')
    room.admit(g, 'guest')
    const id = g.sent[0].id
    g.open = false
    room.webSocketClose(g)
    expect(host.sent.at(-1)).toEqual({ t: 'gone', id })
    const g2 = make()
    room.admit(g2, 'guest')
    room.webSocketClose(host)
    expect(g2.sent.at(-1)).toEqual({ t: 'nohost' })
    expect(g2.open).toBe(false)
  })

  it('limits how many guests one room takes', () => {
    const { room, make } = setup()
    room.admit(make(), 'host')
    for (let i = 0; i < MAX_GUESTS; i++) room.admit(make(), 'guest')
    const extra = make()
    room.admit(extra, 'guest')
    expect(extra.sent).toEqual([{ t: 'full' }])
  })
})
