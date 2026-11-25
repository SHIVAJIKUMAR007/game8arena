// Rooms and lobbies for every game. A hub takes connections ({ on, send, close }) and speaks one small JSON protocol:
//
//   client -> server   create {name, game} | join {code, name, game} | settings {...} | start | lobby (host, after a game) | leave
//                      hideseek:   input {dx,dy,aim,fire}
//                      undercover: uc {a: 'ready' | 'clue' | 'vote' | 'guess', ...}
//                      tictactoe:  ttt {a: 'move', cell: 0-8}
//                      bingo:      bingo {a: 'board', cells: [25 numbers]} | {a: 'edit'} (lobby) | {a: 'call', n} (game)
//                      tambola:    tb {a: 'mark', n, ticket} | {a: 'claim'}  (cut a called number on one ticket, or claim the current prize)
//                      lobby (host, after a game) may carry {keep: true} to keep the Bingo boards
//   server -> client   joined {code, id, game} | room {code, game, hostId, players, settings, phase, ...} | error {message}
//                      hideseek:   start {...} | state {...} | over {winner, mafiaId}
//                      undercover: ustate {...}  (a private view for each player)
//                      tictactoe:  tstate {...}  (the board, from each player's side)
//                      bingo:      bstate {...}  (every board and the announced numbers)
//                      tambola:    tmstate {...} (your own tickets and marks, who is in or out, the prizes)
import { MAX_PLAYERS as HIDE_MAX, createSim } from './hideSeekSim.js'
import { MAPS, MAP_IDS, getMap } from './maps.js'
import {
  CLUE_SECONDS, END_RULES, MAX_PLAYERS as UNDERCOVER_MAX, MIN_PLAYERS as UNDERCOVER_MIN, createUndercover, defaultSettings, validateSettings,
} from './undercover.js'
import {
  MAX_PLAYERS as BINGO_MAX, MIN_PLAYERS as BINGO_MIN, TURN_SECONDS, createBingo, defaultSettings as bingoSettings, isValidBoard,
} from './bingo.js'
import {
  CALL_SECONDS, MARK_SECONDS, MAX_PLAYERS as TAMBOLA_MAX, MIN_PLAYERS as TAMBOLA_MIN, TICKET_COUNTS, createTambola, defaultSettings as tambolaSettings,
  normalizeSettings as tambolaNormalize,
} from './tambola.js'
import {
  BEST_OF, FIRST_MOVES, MAX_PLAYERS as TTT_MAX, MIN_PLAYERS as TTT_MIN, createTicTacToe, defaultSettings as tttSettings,
} from './tictactoe.js'

export const DURATIONS = [60, 120, 180, 300]
export const GAME_TYPES = ['hideseek', 'undercover', 'tictactoe', 'bingo', 'tambola']
const GAME_NAMES = { hideseek: 'Mafia Hunt', undercover: 'Undercover', tictactoe: 'Tic Tac Toe', bingo: 'Bingo Royale', tambola: 'Tambola' }
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // no I or O: easy to misread
const MAX_MESSAGE = 2048

export function cleanName(raw, fallback) {
  // eslint-disable-next-line no-control-regex
  const name = String(raw ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 14)
  return name || fallback
}

/**
 * @param {{ tickHz?: number, hideSeconds?: number, random?: () => number, maxRooms?: number, now?: () => number }} [opts]
 */
export function createHub({ tickHz = 30, hideSeconds = 15, random = Math.random, maxRooms = 50, now = () => Date.now() } = {}) {
  const rooms = new Map()
  let nextId = 1

  const send = (player, msg) => player.conn.send(JSON.stringify(msg))
  const error = (player, message) => send(player, { t: 'error', message })
  const CAPACITY = { undercover: UNDERCOVER_MAX, tictactoe: TTT_MAX, bingo: BINGO_MAX, tambola: TAMBOLA_MAX }
  const MINIMUM = { undercover: UNDERCOVER_MIN, tictactoe: TTT_MIN, bingo: BINGO_MIN, tambola: TAMBOLA_MIN }
  const capacity = type => CAPACITY[type] ?? HIDE_MAX
  const minimum = type => MINIMUM[type] ?? 2

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
      t: 'room', code: room.code, game: room.type, hostId: room.hostId, phase: room.phase, settings: room.settings,
      players: [...room.players.values()].map(p => (room.type === 'bingo' ? { id: p.id, name: p.name, ready: room.boards.has(p.id) } : { id: p.id, name: p.name })),
    }
    if (room.type === 'hideseek') msg.maps = MAPS.map(m => ({ id: m.id, name: m.name }))
    else if (room.type === 'tictactoe') msg.limits = { bestOf: BEST_OF, first: FIRST_MOVES }
    else if (room.type === 'bingo') msg.limits = { turnSeconds: TURN_SECONDS }
    else if (room.type === 'tambola') msg.limits = { callSeconds: CALL_SECONDS, markSeconds: MARK_SECONDS, tickets: TICKET_COUNTS }
    else msg.limits = { min: UNDERCOVER_MIN, max: UNDERCOVER_MAX, clueSeconds: CLUE_SECONDS, endRules: END_RULES }
    for (const p of room.players.values()) send(p, msg)
  }

  function stopGame(room) {
    clearInterval(room.timer)
    room.timer = null
  }

  // ---- hide and seek ----

  function tickHide(room) {
    const t = performance.now()
    const dt = Math.min(0.1, (t - room.lastTick) / 1000)
    room.lastTick = t
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

  function startHide(room) {
    const list = [...room.players.values()]
    const mafia = list[Math.floor(random() * list.length)]
    const map = room.settings.map === 'random' ? MAPS[Math.floor(random() * MAPS.length)] : getMap(room.settings.map)
    room.sim = createSim({
      players: list.map(p => ({ id: p.id, name: p.name })), mafiaId: mafia.id, duration: room.settings.duration, hide: hideSeconds, map, random,
    })
    room.phase = 'game'
    for (const p of list) {
      send(p, {
        t: 'start', you: p.id, mafiaId: mafia.id, map: map.id, mapName: map.name, world: map.world, walls: map.walls, duration: room.settings.duration,
        hide: hideSeconds, players: list.map(q => ({ id: q.id, name: q.name })),
      })
    }
    broadcastRoom(room)
    room.lastTick = performance.now()
    room.timer = setInterval(() => tickHide(room), 1000 / tickHz)
    room.timer.unref?.()
  }

  // ---- undercover ----

  /** Sends every player their own view, if anything changed, and wraps up when the game is over. */
  function flushUndercover(room) {
    const ug = room.ug
    if (!ug.dirty) return
    ug.clearDirty()
    const t = now()
    for (const p of room.players.values()) send(p, ug.view(p.id, t))
    if (ug.phase === 'over' && room.phase === 'game') {
      stopGame(room)
      room.phase = 'over'
      broadcastRoom(room)
    }
  }

  function startUndercover(room, host) {
    const list = [...room.players.values()]
    const check = validateSettings(list.length, room.settings)
    if (!check.ok) return error(host, check.error)
    room.ug = createUndercover({ players: list.map(p => ({ id: p.id, name: p.name })), settings: { ...room.settings }, random, now: now() })
    room.phase = 'game'
    broadcastRoom(room)
    flushUndercover(room)
    room.timer = setInterval(() => {
      room.ug.tick(now())
      flushUndercover(room)
    }, 250)
    room.timer.unref?.()
    return undefined
  }

  // ---- tic tac toe ----

  function flushTicTacToe(room) {
    const tt = room.tt
    if (!tt.dirty) return
    tt.clearDirty()
    for (const p of room.players.values()) send(p, tt.view(p.id, now()))
    if (tt.phase === 'over' && room.phase === 'game') {
      stopGame(room)
      room.phase = 'over'
      broadcastRoom(room)
    }
  }

  function startTicTacToe(room) {
    room.tt = createTicTacToe({ players: [...room.players.values()].map(p => ({ id: p.id, name: p.name })), settings: { ...room.settings }, random, now: now() })
    room.phase = 'game'
    broadcastRoom(room)
    flushTicTacToe(room)
    room.timer = setInterval(() => {
      room.tt.tick(now())
      flushTicTacToe(room)
    }, 250)
    room.timer.unref?.()
  }

  // ---- bingo ----

  function flushBingo(room) {
    const bg = room.bg
    if (!bg.dirty) return
    bg.clearDirty()
    const t = now()
    for (const p of room.players.values()) send(p, bg.view(p.id, t))
    if (bg.phase === 'over' && room.phase === 'game') {
      stopGame(room)
      room.phase = 'over'
      broadcastRoom(room)
    }
  }

  function startBingo(room, host) {
    const list = [...room.players.values()]
    if (!list.every(p => room.boards.has(p.id))) return error(host, 'Everyone must confirm their board first.')
    room.bg = createBingo({ players: list.map(p => ({ id: p.id, name: p.name, board: room.boards.get(p.id) })), settings: { ...room.settings }, random, now: now() })
    room.phase = 'game'
    broadcastRoom(room)
    flushBingo(room)
    room.timer = setInterval(() => {
      room.bg.tick(now())
      flushBingo(room)
    }, 500)
    room.timer.unref?.()
    return undefined
  }

  // ---- tambola ----

  function flushTambola(room) {
    const tm = room.tm
    if (!tm.dirty) return
    tm.clearDirty()
    const t = now()
    for (const p of room.players.values()) send(p, tm.view(p.id, t))
    if (tm.phase === 'over' && room.phase === 'game') {
      stopGame(room)
      room.phase = 'over'
      broadcastRoom(room)
    }
  }

  function startTambola(room) {
    room.tm = createTambola({ players: [...room.players.values()].map(p => ({ id: p.id, name: p.name })), settings: { ...room.settings }, random, now: now() })
    room.phase = 'game'
    broadcastRoom(room)
    flushTambola(room)
    // The caller and the mark windows are timed here, on the host, so every player sees the same clock.
    room.timer = setInterval(() => {
      room.tm.tick(now())
      flushTambola(room)
    }, 200)
    room.timer.unref?.()
  }

  // ---- rooms ----

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
    if (room.type === 'hideseek' && room.phase === 'game' && room.players.size < 2) {
      room.sim.finish(room.sim.players.get(room.sim.mafiaId).alive ? 'mafia' : 'villagers')
    }
    room.boards.delete(player.id)
    if (room.type === 'bingo' && room.phase === 'game') {
      room.bg.leave(player.id, now())
      flushBingo(room)
    }
    if (room.type === 'tambola' && room.phase === 'game') {
      room.tm.leave(player.id)
      flushTambola(room)
    }
    if (room.type === 'tictactoe' && room.phase === 'game') {
      room.tt.leave(player.id, now())
      flushTicTacToe(room)
    }
    if (room.type === 'undercover' && room.phase === 'game') {
      room.ug.leave(player.id, now())
      if (room.players.size < 2) room.ug.abort()
      flushUndercover(room)
    }
    broadcastRoom(room)
  }

  function enter(player, room) {
    player.room = room
    room.players.set(player.id, player)
    send(player, { t: 'joined', code: room.code, id: player.id, game: room.type })
    broadcastRoom(room)
  }

  const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : undefined)

  function applySettings(room, msg) {
    const s = room.settings
    if (room.type === 'tambola') {
      Object.assign(s, tambolaNormalize({ ...s, ...(CALL_SECONDS.includes(msg.callSeconds) ? { callSeconds: msg.callSeconds } : {}), ...(MARK_SECONDS.includes(msg.markSeconds) ? { markSeconds: msg.markSeconds } : {}), ...(TICKET_COUNTS.includes(msg.tickets) ? { tickets: msg.tickets } : {}) }))
    } else if (room.type === 'bingo') {
      if (TURN_SECONDS.includes(msg.turnSeconds)) s.turnSeconds = msg.turnSeconds
    } else if (room.type === 'tictactoe') {
      if (BEST_OF.includes(msg.bestOf)) s.bestOf = msg.bestOf
      if (FIRST_MOVES.includes(msg.first)) s.first = msg.first
    } else if (room.type === 'hideseek') {
      if (DURATIONS.includes(msg.duration)) s.duration = msg.duration
      if (msg.map === 'random' || MAP_IDS.includes(msg.map)) s.map = msg.map
    } else {
      s.undercover = int(msg.undercover, 0, UNDERCOVER_MAX) ?? s.undercover
      s.mrwhite = int(msg.mrwhite, 0, UNDERCOVER_MAX) ?? s.mrwhite
      if (CLUE_SECONDS.includes(msg.clueSeconds)) s.clueSeconds = msg.clueSeconds
      if (END_RULES.includes(msg.endRule)) s.endRule = msg.endRule
    }
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
        const type = msg.game ?? 'hideseek'
        if (!GAME_TYPES.includes(type)) return error(player, 'Unknown game.')
        if (rooms.size >= maxRooms) return error(player, 'The server is full. Try again later.')
        const code = newCode()
        if (!code) return error(player, 'Could not make a room code.')
        player.name = cleanName(msg.name, `Player ${player.id}`)
        const settings = type === 'hideseek' ? { duration: 180, map: 'random' } : type === 'tictactoe' ? tttSettings() : type === 'bingo' ? bingoSettings() : type === 'tambola' ? tambolaSettings() : defaultSettings()
        const created = { code, type, hostId: player.id, players: new Map(), settings, phase: 'lobby', sim: null, ug: null, tt: null, bg: null, tm: null, boards: new Map(), timer: null, lastTick: 0 }
        rooms.set(code, created)
        enter(player, created)
        break
      }
      case 'join': {
        if (room) return error(player, 'You are already in a room.')
        const target = rooms.get(String(msg.code ?? '').toUpperCase().trim())
        if (!target) return error(player, 'Room not found. Check the code.')
        if (msg.game && msg.game !== target.type) {
          return error(player, `That room is for ${GAME_NAMES[target.type]}. Open that game to join it.`)
        }
        if (target.phase !== 'lobby') return error(player, 'That game has already started.')
        if (target.players.size >= capacity(target.type)) return error(player, `The room is full (${capacity(target.type)} players).`)
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
        applySettings(room, msg)
        broadcastRoom(room)
        break
      case 'start':
        if (!room || room.hostId !== player.id || room.phase !== 'lobby') return
        if (room.players.size < minimum(room.type)) return error(player, `You need ${room.type === 'tictactoe' ? 'another player' : `at least ${minimum(room.type)} players`}.`)
        if (room.type === 'bingo') startBingo(room, player)
        else if (room.type === 'tambola') startTambola(room)
        else if (room.type === 'undercover') startUndercover(room, player)
        else if (room.type === 'tictactoe') startTicTacToe(room)
        else startHide(room)
        break
      case 'input':
        if (room?.type === 'hideseek' && room.phase === 'game') room.sim.setInput(player.id, msg)
        break
      case 'uc':
        if (room?.type === 'undercover' && room.phase === 'game') {
          const res = room.ug.act(player.id, msg, now())
          if (res?.error) error(player, res.error)
          flushUndercover(room)
        }
        break
      case 'bingo':
        if (room?.type !== 'bingo') return undefined
        if (room.phase === 'lobby' && msg.a === 'board') {
          if (!isValidBoard(msg.cells)) return error(player, 'Use each number from 1 to 25 exactly once.')
          room.boards.set(player.id, msg.cells.slice())
          broadcastRoom(room)
        } else if (room.phase === 'lobby' && msg.a === 'edit') {
          room.boards.delete(player.id)
          broadcastRoom(room)
        } else if (room.phase === 'game' && msg.a === 'call') {
          const res = room.bg.act(player.id, msg, now())
          if (res?.error) error(player, res.error)
          flushBingo(room)
        }
        break
      case 'tb':
        if (room?.type === 'tambola' && room.phase === 'game') {
          const res = room.tm.act(player.id, msg, now())
          if (res?.error) error(player, res.error)
          flushTambola(room)
        }
        break
      case 'ttt':
        if (room?.type === 'tictactoe' && room.phase === 'game') {
          const res = room.tt.act(player.id, msg, now())
          if (res?.error) error(player, res.error)
          flushTicTacToe(room)
        }
        break
      case 'lobby':
        if (!room || room.hostId !== player.id || room.phase !== 'over') return
        room.phase = 'lobby'
        room.sim = null
        room.ug = null
        room.tt = null
        room.bg = null
        room.tm = null
        if (!msg.keep) room.boards.clear() // "play again" keeps everyone's boards; "return to lobby" starts the set-up afresh
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
