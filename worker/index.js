// Cloudflare Worker entry. Static files are served by the assets binding; only /signal/<CODE> comes here, where it is
// handed to that room's Durable Object (see signalRoom.js).
import { SignalRoom } from './signalRoom.js'

export { SignalRoom }

export default {
  async fetch(request, env) {
    const match = new URL(request.url).pathname.match(/^\/signal\/([A-Za-z]{4})$/)
    if (!match) return env.ASSETS.fetch(request)
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 })
    const stub = env.SIGNAL.get(env.SIGNAL.idFromName(match[1].toUpperCase()))
    return stub.fetch(request)
  },
}
