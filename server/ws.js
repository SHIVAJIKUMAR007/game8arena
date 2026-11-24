// A small WebSocket server layer (RFC 6455) with no dependencies: handshake, masked client frames, fragments,
// ping/pong keep-alive and close. Only what the room server needs: text messages in, text messages out.
import { createHash } from 'node:crypto'

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
const MAX_PAYLOAD = 16 * 1024
const PING_MS = 20000

function frame(opcode, payload) {
  const len = payload.length
  let head
  if (len < 126) head = Buffer.from([0x80 | opcode, len])
  else if (len < 65536) {
    head = Buffer.alloc(4)
    head[0] = 0x80 | opcode
    head[1] = 126
    head.writeUInt16BE(len, 2)
  } else {
    head = Buffer.alloc(10)
    head[0] = 0x80 | opcode
    head[1] = 127
    head.writeBigUInt64BE(BigInt(len), 2)
  }
  return Buffer.concat([head, payload])
}

/**
 * Turns an upgraded socket into { on('message' | 'close', fn), send(text), close() }.
 * Exported so tests can drive it with a fake socket.
 */
export function createConnection(socket) {
  const handlers = { message: [], close: [] }
  let buf = Buffer.alloc(0)
  let parts = []
  let partsSize = 0
  let partOp = 0
  let closed = false
  let alive = true

  const finish = () => {
    if (closed) return
    closed = true
    clearInterval(ping)
    handlers.close.forEach(fn => fn())
  }
  const fail = () => {
    try { socket.destroy() } catch { /* already gone */ }
    finish()
  }
  const write = data => {
    if (closed) return
    try { socket.write(data) } catch { fail() }
  }

  const conn = {
    on(event, fn) { handlers[event].push(fn) },
    send(text) { write(frame(0x1, Buffer.from(text))) },
    close() {
      if (closed) return
      write(frame(0x8, Buffer.alloc(0)))
      try { socket.end() } catch { /* already gone */ }
      finish()
    },
  }

  const ping = setInterval(() => {
    if (!alive) return fail()
    alive = false
    write(frame(0x9, Buffer.alloc(0)))
  }, PING_MS)
  ping.unref?.()

  function onFrame(op, fin, payload) {
    if (op === 0x8) return conn.close()
    if (op === 0x9) return write(frame(0xa, payload))
    if (op === 0xa) {
      alive = true
      return
    }
    if (op !== 0x0) {
      parts = []
      partsSize = 0
      partOp = op
    }
    partsSize += payload.length
    if (partsSize > MAX_PAYLOAD) return fail()
    parts.push(payload)
    if (!fin) return
    const data = Buffer.concat(parts)
    parts = []
    partsSize = 0
    if (partOp === 0x1) handlers.message.forEach(fn => fn(data.toString('utf8')))
  }

  function parse() {
    while (buf.length >= 2) {
      const fin = (buf[0] & 0x80) !== 0
      const op = buf[0] & 0x0f
      const masked = (buf[1] & 0x80) !== 0
      let len = buf[1] & 0x7f
      let off = 2
      if (len === 126) {
        if (buf.length < 4) return
        len = buf.readUInt16BE(2)
        off = 4
      } else if (len === 127) {
        if (buf.length < 10) return
        const big = buf.readBigUInt64BE(2)
        if (big > BigInt(MAX_PAYLOAD)) return fail()
        len = Number(big)
        off = 10
      }
      if (!masked || len > MAX_PAYLOAD) return fail() // clients must mask, and nothing here needs big messages
      if (buf.length < off + 4 + len) return
      const mask = buf.subarray(off, off + 4)
      const payload = Buffer.from(buf.subarray(off + 4, off + 4 + len))
      for (let i = 0; i < len; i++) payload[i] ^= mask[i & 3]
      buf = buf.subarray(off + 4 + len)
      onFrame(op, fin, payload)
      if (closed) return
    }
  }

  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk])
    parse()
  })
  socket.on('close', finish)
  socket.on('error', fail)
  return conn
}

/** Handles `Upgrade: websocket` requests on an http server and calls onConnection(conn, req) for each. */
export function attachWebSocket(server, onConnection) {
  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key']
    if (String(req.headers.upgrade).toLowerCase() !== 'websocket' || !key) {
      socket.destroy()
      return
    }
    const accept = createHash('sha1').update(key + GUID).digest('base64')
    socket.write(
      ['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`, '', ''].join('\r\n'),
    )
    socket.setNoDelay(true)
    onConnection(createConnection(socket), req)
  })
}
