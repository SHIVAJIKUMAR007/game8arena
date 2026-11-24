// Matchmaking for browser-hosted rooms. One Durable Object per room code. It only relays the small WebRTC set-up
// messages (offer, answer, ICE candidates) between the host's tab and each joining friend. No game traffic passes
// through it: once the data channel is open the players talk directly.
//
//   host  -> DO   { t: 'signal', to: guestId, data }          DO -> host   { t: 'ready' | 'taken' | 'guest' (id) | 'gone' (id) | 'signal' (from, data) }
//   guest -> DO   { t: 'signal', data }                       DO -> guest  { t: 'hello' (id) | 'nohost' | 'full' | 'signal' (data) }
export const MAX_GUESTS = 12
export const MAX_MESSAGE = 16 * 1024

const json = msg => JSON.stringify(msg)

export class SignalRoom {
  /** @param {{ getWebSockets(tag?: string): any[], getTags(ws: any): string[], acceptWebSocket(ws: any, tags: string[]): void, setWebSocketAutoResponse?: (pair: any) => void }} ctx */
  constructor(ctx) {
    this.ctx = ctx
    // The client's "ping" keep-alive is answered without waking the object.
    if (typeof WebSocketRequestResponsePair !== 'undefined') ctx.setWebSocketAutoResponse?.(new WebSocketRequestResponsePair('ping', 'pong'))
  }

  host() {
    return this.ctx.getWebSockets('host')[0]
  }

  guests() {
    return this.ctx.getWebSockets().filter(ws => this.ctx.getTags(ws).some(t => t.startsWith('g:')))
  }

  guestById(id) {
    return this.ctx.getWebSockets(`g:${id}`)[0]
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 })
    const role = new URL(request.url).searchParams.get('role')
    const [client, server] = Object.values(new WebSocketPair())
    this.admit(server, role)
    return new Response(null, { status: 101, webSocket: client })
  }

  /** Decides what a new socket is: the host, a guest, or a refused connection that is told why and closed. */
  admit(ws, role) {
    const refuse = t => {
      this.ctx.acceptWebSocket(ws, ['refused'])
      ws.send(json({ t }))
      ws.close(1008, t)
    }
    const host = this.host()
    if (role === 'host') {
      if (host) return refuse('taken')
      this.ctx.acceptWebSocket(ws, ['host'])
      ws.send(json({ t: 'ready' }))
      return undefined
    }
    if (!host) return refuse('nohost')
    if (this.guests().length >= MAX_GUESTS) return refuse('full')
    const id = crypto.randomUUID().slice(0, 8)
    this.ctx.acceptWebSocket(ws, [`g:${id}`])
    ws.send(json({ t: 'hello', id }))
    host.send(json({ t: 'guest', id }))
    return undefined
  }

  webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE) return
    let msg
    try { msg = JSON.parse(message) } catch { return }
    if (!msg || msg.t !== 'signal' || typeof msg.data !== 'object') return
    const tags = this.ctx.getTags(ws)
    if (tags.includes('host')) {
      const guest = this.guestById(String(msg.to))
      guest?.send(json({ t: 'signal', data: msg.data }))
    } else {
      const id = tags.find(t => t.startsWith('g:'))?.slice(2)
      if (id) this.host()?.send(json({ t: 'signal', from: id, data: msg.data }))
    }
  }

  webSocketClose(ws) {
    const tags = this.ctx.getTags(ws)
    if (tags.includes('host')) {
      for (const g of this.guests()) {
        g.send(json({ t: 'nohost' }))
        g.close(1001, 'host left')
      }
    } else {
      const id = tags.find(t => t.startsWith('g:'))?.slice(2)
      if (id) this.host()?.send(json({ t: 'gone', id }))
    }
  }

  webSocketError(ws) {
    this.webSocketClose(ws)
  }
}
