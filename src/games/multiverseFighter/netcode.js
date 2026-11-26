// Online play for Multiverse Fighter, and the only module that knows PeerJS exists. The engine and screens talk to
// a small session object:
//
//   const room = await createRoom({ name, fighter })   // host: claims a 5-letter code on the signaling server
//   const room = await joinRoom('K7QMX', { name, fighter })   // guest: dials the host
//   room.sendInput(seq, mask)        guest -> host, every tick, unreliable channel
//   room.sendSnapshot(snap)          host -> guest, 30Hz, unreliable channel
//   room.sendControl(msg)            both ways, reliable channel (hello, select, ready, start, rematch, leave ...)
//   room.onInput / onSnapshot / onControl / onStatus(fn) -> unsubscribe
//   room.getPing()                   round trip in ms, from ping/pong every 2 seconds
//   room.close()                     tells the peer, then destroys every connection and the Peer
//
// Each pair of players uses two DataConnections: 'ctl' (reliable, ordered) and 'dat' (reliable:false, so unordered).
// Status events: connected, lost, back, left, ping, error. If the link drops, the guest keeps redialling for about
// 12 seconds and the host keeps listening; the same session token proves it is the same guest coming back.
//
// Configuration lives in PEER_CONFIG, filled from Vite env vars (VITE_PEER_HOST, VITE_PEER_PORT, VITE_PEER_PATH,
// VITE_PEER_SECURE, VITE_PEER_KEY, VITE_STUN_URLS, VITE_TURN_URL, VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL). With none
// set it uses the free PeerJS Cloud server. peerjs is imported lazily so it never loads for solo play.

export const PROTOCOL_VERSION = 1
export const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 5
export const PEER_PREFIX = 'mvf-'

const OPEN_TIMEOUT_MS = 10000
const DIAL_TIMEOUT_MS = 12000
const PING_MS = 2000
const DEAD_MS = 6000
const RECONNECT_MS = 12000
const RETRY_MS = 1500

/** Builds PeerJS options from Vite env vars. Exported so tests can pass their own env object. */
export function peerOptions(env = {}) {
  const stun = String(env.VITE_STUN_URLS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302,stun:stun.cloudflare.com:3478')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const iceServers = [{ urls: stun }]
  if (env.VITE_TURN_URL) {
    iceServers.push({ urls: env.VITE_TURN_URL, username: env.VITE_TURN_USERNAME || '', credential: env.VITE_TURN_CREDENTIAL || '' })
  }
  const opts = { debug: 0, config: { iceServers } }
  if (env.VITE_PEER_HOST) {
    const secure = String(env.VITE_PEER_SECURE ?? 'true') !== 'false'
    opts.host = env.VITE_PEER_HOST
    opts.port = Number(env.VITE_PEER_PORT) || (secure ? 443 : 9000)
    opts.path = env.VITE_PEER_PATH || '/'
    opts.secure = secure
  }
  if (env.VITE_PEER_KEY) opts.key = env.VITE_PEER_KEY
  return opts
}

/** The single place to change signaling and ICE servers. */
export const PEER_CONFIG = peerOptions(typeof import.meta !== 'undefined' ? import.meta.env || {} : {})

// ───────────── codes and errors ─────────────
export function randomCode() {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, b => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join('')
}
export const normalizeCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH)
export const isValidCode = c => c.length === ROOM_CODE_LENGTH && [...c].every(ch => ROOM_ALPHABET.includes(ch))

const MESSAGES = {
  'not-found': 'No room with that code. Check the letters and ask the host to keep the room open.',
  'id-taken': 'That room code is already in use. Try again.',
  'server-down': "Can't reach the matchmaking server. Check your connection and try again in a moment.",
  incompatible: "This browser can't make direct connections, so online play is unavailable.",
  webrtc: "Couldn't open a direct connection to the other player. A strict firewall or VPN may be blocking it.",
  timeout: 'The other player did not answer in time. Check the code and try again.',
  full: 'That room already has two players.',
  version: 'The other player is on a different version of the game. Reload both tabs and try again.',
  'bad-code': 'Room codes are 5 characters, letters A to Z (no I or O) and numbers 2 to 9.',
  closed: 'The room was closed.',
  unknown: 'Something went wrong with the connection. Try again.',
}

export function netError(code, detail) {
  return Object.assign(new Error(MESSAGES[code] || MESSAGES.unknown), { code, detail })
}

/** Maps a PeerJS error (or anything thrown) to a friendly error with a stable `code`. */
export function describeError(err) {
  if (err?.code && MESSAGES[err.code] && !err.type) return err
  switch (err?.type) {
    case 'peer-unavailable': return netError('not-found', err)
    case 'unavailable-id': return netError('id-taken', err)
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
    case 'network': return netError('server-down', err)
    case 'browser-incompatible': return netError('incompatible', err)
    case 'webrtc': return netError('webrtc', err)
    default: return netError('unknown', err)
  }
}

// ───────────── peer plumbing ─────────────
async function loadPeer(factory) {
  if (factory) return factory
  const mod = await import('peerjs')
  return mod.default || mod.Peer
}

function openPeer(Peer, id, cfg) {
  return new Promise((resolve, reject) => {
    let peer
    try {
      peer = id ? new Peer(id, cfg) : new Peer(cfg)
    } catch (e) {
      reject(describeError(e))
      return
    }
    const kill = () => {
      try { peer.destroy() } catch { /* already gone */ }
    }
    const timer = setTimeout(() => {
      kill()
      reject(netError('server-down'))
    }, OPEN_TIMEOUT_MS)
    const onErr = err => {
      clearTimeout(timer)
      kill()
      reject(describeError(err))
    }
    peer.on('error', onErr)
    peer.on('open', () => {
      clearTimeout(timer)
      peer.off?.('error', onErr)
      resolve(peer)
    })
  })
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
const token = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)

function makeSession({ peer, role, code, name, fighter, guestOf }) {
  const subs = { input: new Set(), snap: new Set(), ctl: new Set(), status: new Set() }
  const emit = (set, v) => {
    for (const fn of [...set]) {
      try { fn(v) } catch { /* a bad subscriber must not break the link */ }
    }
  }
  const status = (type, extra) => emit(subs.status, { type, ...extra })

  const mine = token()
  let ctl = null
  let dat = null
  let strayDat = null
  let closed = false
  let remoteLeft = false
  let lost = false
  let ever = false
  let guestToken = null
  let pingMs = null
  let lastRecv = now()
  let dialing = null
  let redial = null
  let redialUntil = 0
  const remote = { name: '', fighter: '' }

  const hello = ok => ({ t: 'hello', v: PROTOCOL_VERSION, token: mine, name, fighter, ok })
  const sendOn = (conn, msg) => {
    if (!conn || !conn.open) return false
    try {
      conn.send(msg)
      return true
    } catch {
      return false
    }
  }

  function markLost() {
    if (closed || remoteLeft || lost || !ever) return
    lost = true
    status('lost')
    if (role === 'guest') startRedial()
  }

  function markBack() {
    if (!lost) return
    lost = false
    clearInterval(redial)
    redial = null
    lastRecv = now()
    status('back')
  }

  function dropConns() {
    for (const c of [ctl, dat]) {
      try { c?.close() } catch { /* ignore */ }
    }
  }

  function onData(conn, msg) {
    if (closed || !msg || typeof msg !== 'object') return
    lastRecv = now()
    if (conn.label === 'dat') {
      if (conn !== dat) return
      if (role === 'host' && msg.t === 'in') emit(subs.input, { seq: msg.seq, mask: msg.mask })
      else if (role === 'guest' && msg.t === 's') emit(subs.snap, msg)
      return
    }
    switch (msg.t) {
      case 'hello':
        onHello(conn, msg)
        break
      case 'reject':
        dialing?.fail(netError(msg.reason === 'version' ? 'version' : 'full'))
        break
      case 'ping':
        sendOn(ctl, { t: 'pong', ts: msg.ts })
        break
      case 'pong':
        pingMs = Math.max(0, Math.round(now() - msg.ts))
        status('ping', { ms: pingMs })
        break
      case 'leave':
        remoteLeft = true
        status('left')
        break
      default:
        emit(subs.ctl, msg)
    }
  }

  function attach(conn) {
    conn.on('data', msg => onData(conn, msg))
    conn.on('close', () => {
      if (conn === ctl || conn === dat) markLost()
    })
    conn.on('error', () => {
      if (conn === ctl || conn === dat) markLost()
    })
  }

  // Host: a guest says hello. Accept it, or turn it away.
  function onHello(conn, msg) {
    if (role === 'host') {
      if (msg.v !== PROTOCOL_VERSION) {
        sendOn(conn, { t: 'reject', reason: 'version' })
        return
      }
      const same = guestToken === msg.token
      if (guestToken && !same) {
        sendOn(conn, { t: 'reject', reason: 'full' })
        return
      }
      guestToken = msg.token
      remote.name = String(msg.name || 'Player').slice(0, 20)
      remote.fighter = msg.fighter || ''
      const old = [ctl, dat]
      ctl = conn
      dat = strayDat && strayDat.peer === conn.peer ? strayDat : dat
      strayDat = null
      old.forEach(c => {
        if (c && c !== ctl && c !== dat) {
          try { c.close() } catch { /* ignore */ }
        }
      })
      sendOn(conn, hello(true))
      if (!ever) {
        ever = true
        status('connected', { remote: { ...remote } })
      } else markBack()
    } else if (dialing) {
      if (msg.v !== PROTOCOL_VERSION) dialing.fail(netError('version'))
      else {
        remote.name = String(msg.name || 'Host').slice(0, 20)
        remote.fighter = msg.fighter || ''
        dialing.done()
      }
    }
  }

  // Guest: open both channels and say hello.
  function dial() {
    return new Promise((resolve, reject) => {
      const hostId = PEER_PREFIX + code
      let finished = false
      let c
      let d
      const clear = () => clearTimeout(timer)
      const timer = setTimeout(() => fail(netError('timeout')), DIAL_TIMEOUT_MS)
      const fail = e => {
        if (finished) return
        finished = true
        clear()
        dialing = null
        for (const x of [c, d]) {
          try { x?.close() } catch { /* ignore */ }
        }
        reject(e)
      }
      dialing = {
        fail,
        done() {
          if (finished) return
          finished = true
          clear()
          dialing = null
          resolve()
        },
      }
      try {
        c = peer.connect(hostId, { label: 'ctl', reliable: true, serialization: 'json' })
        d = peer.connect(hostId, { label: 'dat', reliable: false, serialization: 'json' })
      } catch (e) {
        fail(describeError(e))
        return
      }
      const old = [ctl, dat]
      ctl = c
      dat = d
      old.forEach(x => {
        if (x && x !== c && x !== d) {
          try { x.close() } catch { /* ignore */ }
        }
      })
      attach(c)
      attach(d)
      let opened = 0
      const sayHello = () => {
        if (++opened === 2) sendOn(c, { ...hello(), token: guestOf })
      }
      c.on('open', sayHello)
      d.on('open', sayHello)
      c.on('error', () => fail(netError('webrtc')))
    })
  }

  function startRedial() {
    if (role !== 'guest' || redial) return
    redialUntil = now() + RECONNECT_MS
    redial = setInterval(async () => {
      if (closed || !lost) return
      if (now() > redialUntil) {
        clearInterval(redial)
        redial = null
        return
      }
      if (dialing) return
      try {
        if (peer.disconnected && !peer.destroyed) peer.reconnect()
        await dial()
        ever = true
        markBack()
      } catch { /* try again on the next tick */ }
    }, RETRY_MS)
  }

  const pinger = setInterval(() => {
    if (closed) return
    sendOn(ctl, { t: 'ping', ts: now() })
    if (ever && !lost && now() - lastRecv > DEAD_MS) {
      dropConns()
      markLost()
    }
  }, PING_MS)

  peer.on('error', err => {
    const e = describeError(err)
    if (dialing && e.code === 'not-found') dialing.fail(e)
    else if (!closed) status('error', { code: e.code, message: e.message })
  })
  peer.on('disconnected', () => {
    if (closed) return
    setTimeout(() => {
      if (!closed && peer.disconnected && !peer.destroyed) {
        try { peer.reconnect() } catch { /* ignore */ }
      }
    }, 1000)
  })
  if (role === 'host') {
    peer.on('connection', conn => {
      if (closed) {
        conn.close()
        return
      }
      attach(conn)
      if (conn.label === 'dat') {
        if (ctl && ctl.peer === conn.peer && (!dat || !dat.open)) dat = conn
        else strayDat = conn
      }
    })
  }

  const unsub = (set, fn) => {
    set.add(fn)
    return () => set.delete(fn)
  }

  return {
    role,
    code,
    remote,
    sendInput: (seq, mask) => (role === 'guest' ? sendOn(dat, { t: 'in', seq, mask }) : false),
    sendSnapshot: snap => (role === 'host' ? sendOn(dat, { t: 's', ...snap }) : false),
    sendControl: msg => sendOn(ctl, msg),
    onInput: fn => unsub(subs.input, fn),
    onSnapshot: fn => unsub(subs.snap, fn),
    onControl: fn => unsub(subs.ctl, fn),
    onStatus: fn => unsub(subs.status, fn),
    getPing: () => pingMs,
    isOpen: () => !closed && !lost && Boolean(ctl?.open),
    dial,
    markConnected() {
      ever = true
    },
    close() {
      if (closed) return
      closed = true
      clearInterval(pinger)
      clearInterval(redial)
      dialing?.fail(netError('closed'))
      sendOn(ctl, { t: 'leave' })
      const conns = [ctl, dat, strayDat]
      const p = peer
      const teardown = () => {
        for (const c of conns) {
          try { c?.close() } catch { /* ignore */ }
        }
        try { p.destroy() } catch { /* ignore */ }
      }
      // Give the leave message a moment to leave the browser before the channels are torn down.
      if (conns.some(c => c?.open)) setTimeout(teardown, 80)
      else teardown()
      Object.values(subs).forEach(s => s.clear())
    },
  }
}

// ───────────── public API ─────────────
/**
 * Opens a room as the host. Resolves once the code is registered; listen for the 'connected' status for the guest.
 * @param {{ name?: string, fighter?: string, peerFactory?: Function, peerConfig?: object }} [o]
 */
export async function createRoom({ name = 'Player', fighter = '', peerFactory, peerConfig = PEER_CONFIG } = {}) {
  const Peer = await loadPeer(peerFactory)
  let lastErr = null
  for (let i = 0; i < 6; i++) {
    const code = randomCode()
    try {
      const peer = await openPeer(Peer, PEER_PREFIX + code, peerConfig)
      return makeSession({ peer, role: 'host', code, name, fighter })
    } catch (e) {
      lastErr = e
      if (e.code !== 'id-taken') throw e
    }
  }
  throw lastErr || netError('id-taken')
}

/**
 * Joins a room as the guest. Resolves once the host has answered hello; rejects with a friendly error otherwise.
 * @param {string} rawCode
 * @param {{ name?: string, fighter?: string, peerFactory?: Function, peerConfig?: object }} [o]
 */
export async function joinRoom(rawCode, { name = 'Player', fighter = '', peerFactory, peerConfig = PEER_CONFIG } = {}) {
  const code = normalizeCode(rawCode)
  if (!isValidCode(code)) throw netError('bad-code')
  const Peer = await loadPeer(peerFactory)
  const peer = await openPeer(Peer, undefined, peerConfig)
  const session = makeSession({ peer, role: 'guest', code, name, fighter, guestOf: token() })
  try {
    await session.dial()
  } catch (e) {
    session.close()
    throw describeError(e)
  }
  session.markConnected()
  return session
}
