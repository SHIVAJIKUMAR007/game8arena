import { afterEach, describe, expect, it } from 'vitest'
import { CELLS, LINES, WIN_LINES, completedLines, createBingo, isValidBoard, randomBoard } from './bingo.js'
import { createHub } from './hub.js'

const ordered = () => Array.from({ length: CELLS }, (_, i) => i + 1) // rows are 1-5, 6-10, ...
const reversed = () => ordered().reverse()
const people = n => Array.from({ length: n }, (_, i) => ({ id: String(i + 1), name: `P${i + 1}`, board: i % 2 ? reversed() : ordered() }))
const game = (n = 2, settings = { turnSeconds: 0 }, random = () => 0) => createBingo({ players: people(n), settings, random, now: 0 })
const call = (g, id, n, t = 0) => g.act(id, { a: 'call', n }, t)

describe('boards and lines', () => {
  it('has 12 lines: 5 rows, 5 columns and 2 diagonals', () => {
    expect(LINES).toHaveLength(12)
    expect(LINES[0]).toEqual([0, 1, 2, 3, 4])
    expect(LINES[5]).toEqual([0, 5, 10, 15, 20])
    expect(LINES[10]).toEqual([0, 6, 12, 18, 24])
    expect(LINES[11]).toEqual([4, 8, 12, 16, 20])
  })

  it('accepts a board only if it holds 1-25 exactly once', () => {
    expect(isValidBoard(ordered())).toBe(true)
    expect(isValidBoard(randomBoard())).toBe(true)
    expect(isValidBoard(ordered().slice(1))).toBe(false)
    expect(isValidBoard([...ordered().slice(0, 24), 1])).toBe(false) // 1 twice, 25 missing
    expect(isValidBoard([...ordered().slice(0, 24), 26])).toBe(false)
    expect(isValidBoard([...ordered().slice(0, 24), 1.5])).toBe(false)
    expect(isValidBoard([...ordered().slice(0, 24), '25'])).toBe(false)
    expect(isValidBoard('nope')).toBe(false)
  })

  it('shuffles deterministically for a given random source and keeps every number once', () => {
    let seed = 7
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const a = randomBoard(rnd)
    seed = 7
    expect(randomBoard(rnd)).toEqual(a)
    expect(isValidBoard(a)).toBe(true)
    expect(a).not.toEqual(ordered())
  })

  it('finds a completed line only when all five of its numbers are out, and counts each line once', () => {
    expect(completedLines(ordered(), [1, 2, 3, 4])).toEqual([])
    expect(completedLines(ordered(), [1, 2, 3, 4, 5])).toEqual([0])
    // one number can finish a row, a column and a diagonal at once: 13 is the centre
    const called = new Set([11, 12, 14, 15, 3, 8, 18, 23, 1, 7, 19, 25, 5, 9, 17, 21, 13])
    expect(completedLines(ordered(), called)).toEqual([2, 7, 10, 11])
  })
})

describe('turns', () => {
  it('goes clockwise through the lobby order and wraps around', () => {
    const g = game(3)
    expect(g.view('1').turnId).toBe('1')
    call(g, '1', 5)
    expect(g.view('1').turnId).toBe('2')
    call(g, '2', 6)
    call(g, '3', 7)
    expect(g.view('1').turnId).toBe('1')
  })

  it('only lets the player on turn announce, and only an unused number from 1 to 25', () => {
    const g = game(3)
    expect(call(g, '2', 5).error).toMatch(/not your turn/)
    expect(call(g, 'zed', 5).error).toMatch(/not in this game/)
    expect(call(g, '1', 0).error).toMatch(/1 to 25/)
    expect(call(g, '1', 26).error).toMatch(/1 to 25/)
    expect(call(g, '1', 2.5).error).toMatch(/1 to 25/)
    expect(call(g, '1', '5').error).toMatch(/1 to 25/)
    expect(g.act('1', { a: 'cheat' }, 0).error).toMatch(/Unknown/)
    expect(call(g, '1', 5).error).toBeUndefined()
    expect(call(g, '2', 5).error).toMatch(/already announced/)
    expect(g.view('1').called).toEqual([{ n: 5, by: '1', auto: false }])
  })

  it('shows everyone the same boards and announcements', () => {
    const g = game(2)
    call(g, '1', 3)
    const a = g.view('1')
    const b = g.view('2')
    expect({ ...a, you: 0 }).toEqual({ ...b, you: 0 })
    expect(a.players[0].board).toEqual(ordered())
    expect(a.players[1].board).toEqual(reversed())
  })
})

describe('winning', () => {
  it('ends the game the moment someone completes 5 lines, and keeps all their lines', () => {
    const g = game(2)
    // Player 1 board is 1..25 by rows. The five rows are 1-5, 6-10, ... Announce 1-25 in order.
    let turn = '1'
    for (let n = 1; n <= 25 && g.phase === 'play'; n++) {
      call(g, turn, n)
      turn = turn === '1' ? '2' : '1'
    }
    const v = g.view('1')
    expect(v.phase).toBe('over')
    // player 1 has rows 1-4 after 20 numbers (4 lines) and columns don't finish until 21+; the reversed board is later
    expect(v.winners.length).toBeGreaterThanOrEqual(1)
    const winner = v.players.find(p => p.id === v.winners[0])
    expect(winner.count).toBeGreaterThanOrEqual(WIN_LINES)
    expect(winner.lines.length).toBe(winner.count)
    expect(call(g, turn, 1).error).toMatch(/over/)
  })

  it('counts one announcement toward several lines for several players, and picks the most lines', () => {
    // Both boards are the same arrangement: rows 1-5.., so the call that finishes line five finishes it for both.
    const g = createBingo({ players: [{ id: '1', name: 'A', board: ordered() }, { id: '2', name: 'B', board: ordered() }], settings: { turnSeconds: 0 } })
    const order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]
    let turn = '1'
    for (const n of order) {
      if (g.phase !== 'play') break
      call(g, turn, n)
      turn = turn === '1' ? '2' : '1'
    }
    const v = g.view('1')
    expect(v.winners).toEqual(['1', '2']) // identical boards reach 5 lines together: shared win
  })

  it('does not end the game at 4 lines', () => {
    const g = game(2)
    let turn = '1'
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
      call(g, turn, n)
      turn = turn === '1' ? '2' : '1'
    }
    const v = g.view('1')
    expect(v.players[0].count).toBe(4)
    expect(v.phase).toBe('play')
  })
})

describe('turn timer and leaving', () => {
  it('announces a random unused number for a player who runs out of time, then moves on', () => {
    const g = game(2, { turnSeconds: 15 }, () => 0)
    expect(g.view('1', 0).left).toBe(15)
    g.tick(14999)
    expect(g.view('1').called).toHaveLength(0)
    g.tick(15000)
    expect(g.view('1').called).toEqual([{ n: 1, by: '1', auto: true }])
    expect(g.view('1', 15000).turnId).toBe('2')
    expect(g.view('1', 15000).left).toBe(15)
  })

  it('has no timer when the limit is off', () => {
    const g = game(2, { turnSeconds: 0 })
    g.tick(10 ** 9)
    expect(g.view('1').called).toHaveLength(0)
    expect(g.view('1').left).toBe(0)
  })

  it('passes the turn on when the player on turn leaves, and keeps their board on show', () => {
    const g = game(3)
    g.leave('1')
    const v = g.view('2')
    expect(v.turnId).toBe('2')
    expect(v.players[0]).toMatchObject({ id: '1', active: false })
    expect(v.players[0].board).toEqual(ordered())
    call(g, '2', 4)
    expect(g.view('2').turnId).toBe('3') // the player who left is skipped
    call(g, '3', 5)
    expect(g.view('2').turnId).toBe('2')
  })

  it('gives the game to the last player when everyone else leaves', () => {
    const g = game(3)
    g.leave('1')
    g.leave('3')
    expect(g.view('2')).toMatchObject({ phase: 'over', winners: ['2'], forfeit: true })
  })

  it('stays dirty only when something changed', () => {
    const g = game(2)
    g.clearDirty()
    call(g, '2', 3) // rejected
    expect(g.dirty).toBe(false)
    call(g, '1', 3)
    expect(g.dirty).toBe(true)
  })

  it('needs 2 to 8 players with valid boards', () => {
    expect(() => createBingo({ players: people(1) })).toThrow()
    expect(() => createBingo({ players: people(9) })).toThrow()
    expect(() => createBingo({ players: [{ id: '1', name: 'A', board: [1, 2] }, ...people(2).slice(1)] })).toThrow()
    expect(game(8).view('1').players).toHaveLength(8)
  })
})

// ---- through the hub ----

function client(hub) {
  const handlers = { message: [], close: [] }
  const got = []
  hub.handleConnection({ on: (e, fn) => handlers[e].push(fn), send: t => got.push(JSON.parse(t)), close: () => handlers.close.forEach(f => f()) })
  return {
    got,
    say: msg => handlers.message.forEach(f => f(JSON.stringify(msg))),
    drop: () => handlers.close.forEach(f => f()),
    last: type => [...got].reverse().find(m => m.t === type),
  }
}

let hub
afterEach(() => hub?.close())

function room(n = 2) {
  hub = createHub({ random: () => 0 })
  const host = client(hub)
  host.say({ t: 'create', name: 'P1', game: 'bingo' })
  const code = host.last('joined').code
  const all = [host]
  for (let i = 2; i <= n; i++) {
    const c = client(hub)
    c.say({ t: 'join', code, name: `P${i}`, game: 'bingo' })
    all.push(c)
  }
  return all
}
const board = (c, cells = ordered()) => c.say({ t: 'bingo', a: 'board', cells })

describe('Bingo rooms', () => {
  it('has the turn timer as its only setting, and fits 8 players but not 9', () => {
    const [host, ...rest] = room(8)
    expect(host.last('room')).toMatchObject({ game: 'bingo', settings: { turnSeconds: 30 }, limits: { turnSeconds: [0, 15, 30, 60] } })
    host.say({ t: 'settings', turnSeconds: 60 })
    host.say({ t: 'settings', turnSeconds: 7 }) // ignored
    rest[0].say({ t: 'settings', turnSeconds: 0 }) // not the host
    expect(host.last('room').settings.turnSeconds).toBe(60)
    const ninth = client(hub)
    ninth.say({ t: 'join', code: host.last('joined').code, name: 'P9', game: 'bingo' })
    expect(ninth.last('error').message).toMatch(/full/)
  })

  it('shows who is ready, rejects a bad board, and lets a player edit theirs', () => {
    const [host, guest] = room(2)
    board(host, [1, 2, 3])
    expect(host.last('error').message).toMatch(/exactly once/)
    board(host)
    expect(guest.last('room').players).toEqual([{ id: '1', name: 'P1', ready: true }, { id: '2', name: 'P2', ready: false }])
    host.say({ t: 'bingo', a: 'edit' })
    expect(guest.last('room').players[0].ready).toBe(false)
  })

  it('only starts when everyone has confirmed a board', () => {
    const [host, guest] = room(2)
    board(host)
    host.say({ t: 'start' })
    expect(host.last('error').message).toMatch(/confirm their board/)
    expect(host.last('room').phase).toBe('lobby')
    board(guest, reversed())
    host.say({ t: 'start' })
    expect(host.last('room').phase).toBe('game')
    expect(guest.last('bstate').players[1].board).toEqual(reversed())
  })

  it('locks boards once the game starts and enforces the turn order', () => {
    const [host, guest] = room(2)
    board(host)
    board(guest, reversed())
    host.say({ t: 'start' })
    board(guest, ordered()) // ignored: the game is on
    expect(guest.last('bstate').players[1].board).toEqual(reversed())
    guest.say({ t: 'bingo', a: 'call', n: 3 })
    expect(guest.last('error').message).toMatch(/not your turn/)
    host.say({ t: 'bingo', a: 'call', n: 3 })
    expect(guest.last('bstate').called).toHaveLength(1)
    host.say({ t: 'bingo', a: 'call', n: 4 })
    expect(host.last('error').message).toMatch(/not your turn/)
  })

  it('ends the room on a win, and play again keeps boards while return to lobby clears them', () => {
    const [host, guest] = room(2)
    board(host)
    board(guest)
    host.say({ t: 'start' })
    let who = host
    for (let n = 1; n <= 25 && host.last('room').phase === 'game'; n++) {
      who.say({ t: 'bingo', a: 'call', n })
      who = who === host ? guest : host
    }
    expect(host.last('room').phase).toBe('over')
    expect(host.last('bstate').winners.length).toBeGreaterThan(0)
    host.say({ t: 'lobby', keep: true })
    expect(host.last('room')).toMatchObject({ phase: 'lobby' })
    expect(host.last('room').players.every(p => p.ready)).toBe(true)
    host.say({ t: 'start' })
    expect(host.last('room').phase).toBe('game')
  })

  it('clears the boards when the host returns to the lobby without keeping them', () => {
    const [host, guest] = room(2)
    board(host)
    board(guest)
    host.say({ t: 'start' })
    host.say({ t: 'bingo', a: 'call', n: 1 })
    guest.drop() // the game ends: the host is the last player
    expect(host.last('room').phase).toBe('over')
    host.say({ t: 'lobby' })
    expect(host.last('room').players.every(p => !p.ready)).toBe(true)
  })

  it('skips a player who disconnects on their turn', () => {
    const [host, guest, third] = room(3)
    ;[host, guest, third].forEach(c => board(c))
    host.say({ t: 'start' })
    host.say({ t: 'bingo', a: 'call', n: 1 })
    guest.drop() // it was the guest's turn
    expect(third.last('bstate').turnId).toBe('3')
    third.say({ t: 'bingo', a: 'call', n: 2 })
    expect(host.last('bstate').turnId).toBe('1')
  })
})
