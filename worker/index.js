// Cloudflare Worker entry. Static files are served by the assets binding. Only two paths come here:
//   /signal/<CODE>  handed to that room's Durable Object (see signalRoom.js)
//   /turn           short-lived relay (TURN) credentials, for players whose network blocks direct connections
import { SignalRoom } from './signalRoom.js'

export { SignalRoom }

/**
 * Asks Cloudflare Realtime TURN for ICE servers. Needs the secrets TURN_KEY_ID and TURN_KEY_API_TOKEN; without them
 * this answers 404 and players simply use direct (STUN) connections.
 */
export async function turnCredentials(env, fetchImpl = fetch) {
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return new Response('TURN is not set up', { status: 404 })
  const res = await fetchImpl(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl: 6 * 3600 }),
  })
  if (!res.ok) return new Response('TURN unavailable', { status: 502 })
  const { iceServers } = await res.json()
  return new Response(JSON.stringify({ iceServers }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/turn') return turnCredentials(env)
    const match = url.pathname.match(/^\/signal\/([A-Za-z]{4})$/)
    if (!match) return env.ASSETS.fetch(request)
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 })
    const stub = env.SIGNAL.get(env.SIGNAL.idFromName(match[1].toUpperCase()))
    return stub.fetch(request)
  },
}
