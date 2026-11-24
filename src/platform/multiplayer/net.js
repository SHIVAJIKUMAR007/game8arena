// Where the game server is. When the page itself was served by the server (npm run host) it is the same address.
// While developing with `npm run dev`, run `npm run server` as well and the game finds it on port 8787.
// `?server=192.168.1.20:8787` points the page at a server explicitly.
export const DEV_PORT = 8787

/** @param {{ search?: string, hostname: string, host: string, protocol: string }} loc */
export function serverUrl(loc = window.location, dev = Boolean(import.meta.env?.DEV)) {
  const wanted = new URLSearchParams(loc.search || '').get('server')
  if (wanted && /^[\w.-]+(:\d{1,5})?$/.test(wanted)) return `ws://${wanted}`
  if (dev) return `ws://${loc.hostname}:${DEV_PORT}`
  return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}`
}

/** Address of the server's info endpoint, to list the Wi-Fi addresses friends can open. */
export function infoUrl(loc = window.location, dev = Boolean(import.meta.env?.DEV)) {
  return `${serverUrl(loc, dev).replace(/^ws/, 'http')}/api/info`
}
