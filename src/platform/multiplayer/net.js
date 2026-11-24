// How a multiplayer game reaches its room.
//
//   'p2p'  (default, e.g. on game8arena.com)  the host's browser tab runs the room and friends connect to it over WebRTC.
//                                              A small Cloudflare Worker only introduces them (see worker/signalRoom.js).
//   'ws'   a Node game server (`npm run host`, or `npm run server` next to `npm run dev`). The server hands its own pages
//          a flag, so players who open its Wi-Fi address use it. `?server=192.168.1.20:8787` points a page at one explicitly.
//   `?p2p=1` forces browser hosting while developing; `?signal=localhost:8787` points it at `wrangler dev`.
export const DEV_PORT = 8787

const HOST_RE = /^[\w.-]+(:\d{1,5})?$/

/** @param {{ search?: string }} loc */
export function transportMode(loc = window.location, dev = Boolean(import.meta.env?.DEV), lan = Boolean(globalThis.__G8_LAN__)) {
  const q = new URLSearchParams(loc.search || '')
  const wanted = q.get('server')
  if (wanted && HOST_RE.test(wanted)) return 'ws'
  if (q.get('p2p') === '1') return 'p2p'
  return dev || lan ? 'ws' : 'p2p'
}

/** Where the matchmaking Worker lives, as a ws(s):// base. It is the page's own host unless `?signal=` says otherwise. */
export function signalBase(loc = window.location) {
  const wanted = new URLSearchParams(loc.search || '').get('signal')
  if (wanted && HOST_RE.test(wanted)) return `ws://${wanted}`
  return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}`
}

/** @param {{ search?: string, hostname: string, host: string, protocol: string }} loc */
export function serverUrl(loc = window.location, dev = Boolean(import.meta.env?.DEV)) {
  const wanted = new URLSearchParams(loc.search || '').get('server')
  if (wanted && HOST_RE.test(wanted)) return `ws://${wanted}`
  if (dev) return `ws://${loc.hostname}:${DEV_PORT}`
  return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}`
}

/** Address of the server's info endpoint, to list the Wi-Fi addresses friends can open. */
export function infoUrl(loc = window.location, dev = Boolean(import.meta.env?.DEV)) {
  return `${serverUrl(loc, dev).replace(/^ws/, 'http')}/api/info`
}
