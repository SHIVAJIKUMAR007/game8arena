// Rooms and lobbies. A hub takes connections ({ on, send, close }) and speaks one small JSON protocol:
//
//   client -> server   create {name} | join {code, name} | settings {duration?, map?} | start | input {dx,dy,aim,fire}
//                      | lobby (host, after a game) | leave
//   server -> client   joined {code, id} | room {code, hostId, players, settings, phase} | start {...}
//                      | state {...} | over {winner, mafiaId} | error {message}
import { MAX_PLAYERS, createSim } from './hideSeekSim.js'
import { MAPS, MAP_IDS, getMap } from './maps.js'

export const DURATIONS = [60, 120, 180, 300]
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // no I or O: easy to misread
const MAX_MESSAGE = 2048

export function cleanName(raw, fallback) {
  // eslint-disable-next-line no-control-regex
  const name = String(raw ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 14)
  return name || fallback
}

/**
 * @param {{ tickHz?: number, hideSeconds?: number, random?: () => number, maxRooms?: number }} [opts]
 */
export function createHub({ tickHz = 30, hideSeconds = 15, random = Math.random, maxRooms = 50 } = {}) {
  const rooms = new Map()
  let nextId = 1

  const send = (player, msg) => player.conn.send(JSON.stringify(msg))
  const error = (player, message) => send(player, { t: 'error', message })

  function newCode() {
    for (let tries = 0; tries < 200; tries++) {
      let code = ''
      for (let i = 0; i < 4; i++) code += CODE_LETTERS[Math.floor(random() * CODE_LETTERS.length)]
      if (!rooms.has(code)) return code
    }
    return null
  }

  function broadcastRoom(room) {
    const msg = {
      t: 'room', code: room.code, hostId: room.hostId, phase: room.phase, settings: room.settings,
      maps: MAPS.map(m => ({ id: m.id, name: m.name })),
      players: [...room.players.values()].map(p => ({ id: p.id, name: p.name })),
    }
    for (const p of room.players.values()) send(p, msg)
  }

  function stopGame(room) {
    clearInterval(room.timer)
    room.timer = null
  }

  function tick(room) {
    const now = performance.now()
    const dt = Math.min(0.1, (now - room.lastTick) / 1000)
    room.lastTick = now
    const sim = room.sim
    sim.step(dt)
    for (const p of room.players.values()) send(p, { t: 'state', ...sim.snapshotFor(p.id) })
    if (sim.phase === 'over') {
      stopGame(room)
      room.phase = 'over'
      for (const p of room.players.values()) send(p, { t: 'over', winner: sim.winner, mafiaId: sim.mafiaId, survivors: sim.aliveVillagers() })
      broadcastRoom(room)
    }
  }

  function startGame(room) {
    const list = [...room.players.values()]
    const mafia = list[Math.floor(random() * list.length)]
    const map = room.settings.map === 'random' ? MAPS[Math.floor(random() * MAPS.length)] : getMap(room.settings.map)
    room.sim = createSim({
      players: list.map(p => ({ id: p.id, name: p.name })), mafiaId: mafia.id, duration: room.settings.duration, hide: hideSeconds, map, random,
    })
    room.phase = 'game'
    for (const p of list) {
      send(p, {
        t: 'start', you: p.id, mafiaId: mafia.id, map: map.id, mapName: map.name, world: map.world, walls: map.walls, duration: room.settings.duration, hide: hideSeconds,
        players: list.map(q => ({ id: q.id, name: q.name })),
      })
    }
    broadcastRoom(room)
    room.lastTick = performance.now()
    room.timer = setInterval(() => tick(room), 1000 / tickHz)
    room.timer.unref?.()
  }

  function leave(player) {
    const room = player.room
    if (!room) return
    player.room = null
    room.players.delete(player.id)
    if (room.sim) room.sim.removePlayer(player.id)
    if (room.players.size === 0) {
      stopGame(room)
      rooms.delete(room.code)
      return
    }
    if (room.hostId === player.id) room.hostId = room.players.keys().next().value
    if (room.phase === 'game' && room.players.size < 2) {
      room.sim.finish(room.sim.players.get(room.sim.mafiaId).alive ? 'mafia' : 'villagers')
    }
    broadcastRoom(room)
  }

  function enter(player, room) {
    player.room = room
    room.players.set(player.id, player)
    send(player, { t: 'joined', code: room.code, id: player.id })
    broadcastRoom(room)
  }

  function onMessage(player, raw) {
    if (raw.length > MAX_MESSAGE) return
    let msg
    try { msg = JSON.parse(raw) } catch { return }
    if (!msg || typeof msg !== 'object') return
    const room = player.room

    switch (msg.t) {
      case 'create': {
        if (room) return error(player, 'You are already in a room.')
        if (rooms.size >= maxRooms) return error(player, 'The server is full. Try again later.')
        const code = newCode()
        if (!code) return error(player, 'Could not make a room code.')
        player.name = cleanName(msg.name, `Player ${player.id}`)
        const created = { code, hostId: player.id, players: new Map(), settings: { duration: 180, map: 'random' }, phase: 'lobby', sim: null, timer: null, lastTick: 0 }
        rooms.set(code, created)
        enter(player, created)
        break
      }
      case 'join': {
        if (room) return error(player, 'You are already in a room.')
        const target = rooms.get(String(msg.code ?? '').toUpperCase().trim())
        if (!target) return error(player, 'Room not found. Check the code.')
        if (target.phase !== 'lobby') return error(player, 'That game has already started.')
        if (target.players.size >= MAX_PLAYERS) return error(player, `The room is full (${MAX_PLAYERS} players).`)
        player.name = cleanName(msg.name, `Player ${player.id}`)
        const taken = new Set([...target.players.values()].map(p => p.name))
        let name = player.name
        for (let n = 2; taken.has(name); n++) name = `${player.name.slice(0, 11)} ${n}`
        player.name = name
        enter(player, target)
        break
      }
      case 'settings':
        if (!room || room.hostId !== player.id || room.phase !== 'lobby') return
        if (DURATIONS.includes(msg.duration)) room.settings.duration = msg.duration
        if (msg.map === 'random' || MAP_IDS.includes(msg.map)) room.settings.map = msg.map
        broadcastRoom(room)
        break
      case 'start':
        if (!room || room.hostId !== player.id || room.phase !== 'lobby') return
        if (room.players.size < 2) return error(player, 'You need at least 2 players.')
        startGame(room)
        break
      case 'input':
        if (room?.phase === 'game') room.sim.setInput(player.id, msg)
        break
      case 'lobby':
        if (!room || room.hostId !== player.id || room.phase !== 'over') return
        room.phase = 'lobby'
        room.sim = null
        broadcastRoom(room)
        break
      case 'leave':
        leave(player)
        break
      default:
    }
  }

  return {
    rooms,
    handleConnection(conn) {
      const player = { id: String(nextId++), name: '', conn, room: null }
      conn.on('message', raw => onMessage(player, raw))
      conn.on('close', () => leave(player))
      return player
    },
    close() {
      for (const room of rooms.values()) stopGame(room)
      rooms.clear()
    },
  }
}
