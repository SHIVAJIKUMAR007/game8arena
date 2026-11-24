// Browser-hosted rooms. createP2PSocket() returns an object shaped like a WebSocket, so useRoomSocket does not care
// where the room lives:
//
//   send({t:'create'})  this tab becomes the host: it runs the room hub (server/hub.js) in memory, claims the room code
//                       with the matchmaking Worker, and accepts friends over WebRTC data channels.
//   send({t:'join'})    this tab connects to the host of that code (set-up relayed by the Worker, then direct).
//
// The hub speaks the same JSON protocol it speaks over a real WebSocket, so the games do not change.
export const ICE_SERVERS = [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }]
export const CONNECT_TIMEOUT_MS = 15000
const CLAIM_TIMEOUT_MS = 8000
const CLAIM_ATTEMPTS = 5
const KEEPALIVE_MS = 25000
const REJOIN_MS = 3000
const REJOIN_TRIES = 5

const defaults = () => ({
  signalBase: '',
  WebSocketImpl: globalThis.WebSocket,
  RTCPeerConnectionImpl: globalThis.RTCPeerConnection,
  loadHub: () => import('../../../server/hub.js'),
})

const parse = text => {
  try {
    const v = JSON.parse(text)
    return v && typeof v === 'object' ? v : null
  } catch {
    return null
  }
}

/** A hub connection ({ on, send, close }) backed by whatever `write` and `end` do. Call `receive`/`drop` to feed it. */
function makeConn(write, end) {
  const handlers = { message: [], close: [] }
  let closed = false
  return {
    conn: {
      on: (event, fn) => handlers[event].push(fn),
      send: text => !closed && write(text),
      close: () => {
        if (closed) return
        end?.()
        drop()
      },
    },
    receive: text => !closed && handlers.message.forEach(fn => fn(text)),
    drop,
  }
  function drop() {
    if (closed) return
    closed = true
    handlers.close.forEach(fn => fn())
  }
}

/**
 * @param {Partial<ReturnType<typeof defaults>>} [deps] replaceable pieces, for tests
 */
export function createP2PSocket(deps = {}) {
  const d = { ...defaults(), ...deps }
  /** @type {{ send(text: string): void, stop(): void } | null} */
  let session = null
  let joined = false

  const sock = {
    readyState: 0,
    onopen: null,
    onclose: null,
    onmessage: null,
    send(text) {
      if (sock.readyState !== 1) return
      const msg = parse(text)
      if (!msg) return
      if (!session) {
        joined = false
        if (msg.t === 'create') session = hostSession(msg)
        else if (msg.t === 'join') session = guestSession(msg)
        return
      }
      session.send(text)
      if (msg.t === 'leave') endSession()
    },
    close() {
      endSession()
      sock.readyState = 3
    },
  }
  Promise.resolve().then(() => {
    if (sock.readyState !== 0) return
    sock.readyState = 1
    sock.onopen?.()
  })

  function emit(msg) {
    if (msg.t === 'joined') joined = true
    sock.onmessage?.({ data: JSON.stringify(msg) })
    // A refused create or join leaves nothing to talk to: start fresh so the next try picks a new host.
    if (msg.t === 'error' && !joined) endSession()
  }

  function endSession() {
    const s = session
    session = null
    joined = false
    s?.stop()
  }

  /** The other side is gone for good (host left, or connection dropped). Same as a WebSocket closing. */
  function lost() {
    endSession()
    sock.readyState = 3
    sock.onclose?.()
  }

  // ---- host ----

  function hostSession(first) {
    let stopped = false
    let ready = false
    const queue = [JSON.stringify(first)]
    let hub = null
    let own = null
    let signal = null
    let keepAlive = null
    let code = ''
    const peers = new Map() // guest id -> { pc, channel, pending, remoteSet, conn }

    const flush = () => {
      if (!ready || !own) return
      while (queue.length) own.receive(queue.shift())
    }

    function stop() {
      stopped = true
      clearInterval(keepAlive)
      try { signal?.close() } catch { /* already closed */ }
      for (const p of peers.values()) try { p.pc.close() } catch { /* already closed */ }
      peers.clear()
      hub?.close()
    }

    function claim(candidate) {
      return new Promise(resolve => {
        let ws
        let settled = false
        const done = result => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve(result)
        }
        const timer = setTimeout(() => {
          done('unreachable')
          try { ws?.close() } catch { /* already closed */ }
        }, CLAIM_TIMEOUT_MS)
        try {
          ws = new d.WebSocketImpl(`${d.signalBase}/signal/${candidate}?role=host`)
        } catch {
          done('unreachable')
          return
        }
        ws.onmessage = e => {
          const m = parse(e.data)
          if (!m) return
          if (m.t === 'ready') {
            signal = ws
            done('ok')
          } else if (m.t === 'taken') done('taken')
          else handleSignal(m)
        }
        ws.onclose = () => {
          if (!settled) done('unreachable')
          else if (signal === ws && !stopped) rejoin()
        }
        ws.onerror = () => {}
      })
    }

    /** The matchmaking connection dropped while the room lives on: take the code back so new friends can still find it. */
    async function rejoin() {
      signal = null
      for (let i = 0; i < REJOIN_TRIES && !stopped; i++) {
        await new Promise(r => setTimeout(r, REJOIN_MS))
        if (stopped) return
        if ((await claim(code)) === 'ok') return
      }
    }

    function sendSignal(id, data) {
      if (signal?.readyState === 1) signal.send(JSON.stringify({ t: 'signal', to: id, data }))
    }

    function handleSignal(m) {
      if (m.t === 'guest') addPeer(String(m.id))
      else if (m.t === 'gone') {
        const p = peers.get(String(m.id))
        if (p && !p.channel) {
          p.pc.close()
          peers.delete(String(m.id))
        }
      } else if (m.t === 'signal') onPeerSignal(String(m.from), m.data)
    }

    function addPeer(id) {
      const pc = new d.RTCPeerConnectionImpl({ iceServers: ICE_SERVERS })
      const peer = { pc, channel: null, pending: [], remoteSet: false, link: null }
      peers.set(id, peer)
      pc.onicecandidate = e => e.candidate && sendSignal(id, { candidate: e.candidate })
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') peer.link?.drop()
      }
      pc.ondatachannel = e => {
        const channel = e.channel
        peer.channel = channel
        const link = makeConn(text => channel.readyState === 'open' && channel.send(text), () => channel.close())
        peer.link = link
        channel.onopen = () => hub?.handleConnection(link.conn)
        if (channel.readyState === 'open') channel.onopen()
        channel.onmessage = ev => typeof ev.data === 'string' && link.receive(ev.data)
        channel.onclose = () => {
          link.drop()
          peers.delete(id)
          try { pc.close() } catch { /* already closed */ }
        }
      }
    }

    async function onPeerSignal(id, data) {
      const peer = peers.get(id)
      if (!peer || !data) return
      const { pc } = peer
      try {
        if (data.sdp) {
          await pc.setRemoteDescription(data.sdp)
          peer.remoteSet = true
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          sendSignal(id, { sdp: pc.localDescription })
          for (const c of peer.pending.splice(0)) await pc.addIceCandidate(c)
        } else if (data.candidate) {
          if (peer.remoteSet) await pc.addIceCandidate(data.candidate)
          else peer.pending.push(data.candidate)
        }
      } catch {
        peer.link?.drop()
      }
    }

    async function start() {
      let mod
      try {
        mod = await d.loadHub()
      } catch {
        if (!stopped) emit({ t: 'error', message: 'Could not start the game room. Reload the page and try again.' })
        return
      }
      if (stopped) return
      hub = mod.createHub()
      let held = null // messages from the hub while the code is still being claimed
      const link = makeConn(text => (held ? held.push(text) : emit(JSON.parse(text))))
      own = link
      hub.handleConnection(link.conn)

      for (let attempt = 0; attempt < CLAIM_ATTEMPTS && !stopped; attempt++) {
        held = []
        link.receive(queue.shift())
        const joinedMsg = held.map(parse).find(m => m?.t === 'joined')
        if (!joinedMsg) {
          // The hub refused to make a room (or said something else): pass it on as it is.
          const out = held
          held = null
          out.forEach(t => emit(JSON.parse(t)))
          return
        }
        code = joinedMsg.code
        const result = await claim(code)
        if (stopped) return
        if (result === 'ok') {
          const out = held
          held = null
          out.forEach(t => emit(JSON.parse(t)))
          ready = true
          keepAlive = setInterval(() => {
            if (signal?.readyState === 1) signal.send('ping')
          }, KEEPALIVE_MS)
          flush()
          return
        }
        link.receive(JSON.stringify({ t: 'leave' }))
        if (result === 'unreachable') {
          held = null
          emit({ t: 'error', message: 'Could not reach the matchmaking service. Check your internet connection and try again.' })
          return
        }
        queue.unshift(JSON.stringify(first)) // that code was taken by another host: make a new room with a new code
      }
      held = null
      if (!stopped) emit({ t: 'error', message: 'Could not make a room code. Try again.' })
    }
    start()

    return {
      send(text) {
        queue.push(text)
        flush()
      },
      stop,
    }
  }

  // ---- guest ----

  function guestSession(first) {
    const code = String(first.code ?? '').toUpperCase().trim()
    let stopped = false
    let open = false
    let remoteSet = false
    const pending = []
    const queue = [JSON.stringify({ ...first, code })]
    let ws = null
    let pc = null
    let channel = null
    let timer = null

    function stop() {
      stopped = true
      clearTimeout(timer)
      try { ws?.close() } catch { /* already closed */ }
      try { pc?.close() } catch { /* already closed */ }
    }

    const fail = message => {
      if (stopped) return
      emit({ t: 'error', message })
    }

    if (!/^[A-Z]{4}$/.test(code)) {
      Promise.resolve().then(() => fail('Room not found. Check the code.'))
      return { send() {}, stop }
    }

    try {
      ws = new d.WebSocketImpl(`${d.signalBase}/signal/${code}?role=guest`)
      pc = new d.RTCPeerConnectionImpl({ iceServers: ICE_SERVERS })
    } catch {
      Promise.resolve().then(() => fail('This browser cannot join online rooms.'))
      return { send() {}, stop }
    }
    timer = setTimeout(() => fail('Could not connect to the host. Check the code, or try the same Wi-Fi as the host.'), CONNECT_TIMEOUT_MS)

    channel = pc.createDataChannel('g8')
    channel.onopen = () => {
      open = true
      clearTimeout(timer)
      try { ws.close() } catch { /* already closed */ }
      while (queue.length) channel.send(queue.shift())
    }
    channel.onmessage = e => {
      if (typeof e.data !== 'string') return
      const m = parse(e.data)
      if (m) emit(m)
    }
    channel.onclose = () => {
      if (!stopped) lost()
    }
    pc.onicecandidate = e => e.candidate && ws.readyState === 1 && ws.send(JSON.stringify({ t: 'signal', data: { candidate: e.candidate } }))
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') (open ? lost : () => fail('Could not connect to the host. Try the same Wi-Fi as the host.'))()
    }

    ws.onmessage = async e => {
      const m = parse(e.data)
      if (!m || stopped) return
      try {
        if (m.t === 'nohost') fail('Room not found. Check the code.')
        else if (m.t === 'full') fail('That room is full.')
        else if (m.t === 'hello') {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          ws.send(JSON.stringify({ t: 'signal', data: { sdp: pc.localDescription } }))
        } else if (m.t === 'signal' && m.data?.sdp) {
          await pc.setRemoteDescription(m.data.sdp)
          remoteSet = true
          for (const c of pending.splice(0)) await pc.addIceCandidate(c)
        } else if (m.t === 'signal' && m.data?.candidate) {
          if (remoteSet) await pc.addIceCandidate(m.data.candidate)
          else pending.push(m.data.candidate)
        }
      } catch {
        fail('Could not connect to the host.')
      }
    }
    ws.onclose = () => {
      if (!open && !stopped) fail('Could not reach the matchmaking service. Check your internet connection and try again.')
    }
    ws.onerror = () => {}

    return {
      send(text) {
        if (open && channel.readyState === 'open') channel.send(text)
        else queue.push(text)
      },
      stop,
    }
  }

  return sock
}
