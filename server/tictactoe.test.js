import { afterEach, describe, expect, it } from 'vitest'
import { BETWEEN_MS, createTicTacToe, judge, winsNeeded } from './tictactoe.js'
import { createHub } from './hub.js'

const players = [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bob' }]
const game = (settings = {}, random = () => 0) => createTicTacToe({ players, settings: { first: 'host', ...settings }, random, now: 0 })
const move = (g, id, cell, t = 0) => g.act(id, { a: 'move', cell }, t)

/** X (Ann when she starts) takes the top row, O plays the middle row. */
function xWins(g, t = 0) {
  move(g, 'a', 0, t); move(g, 'b', 3, t); move(g, 'a', 1, t); move(g, 'b', 4, t); move(g, 'a', 2, t)
}

describe('judge', () => {
  it('finds every winning line, a draw, and play still going', () => {
    expect(judge(['X', 'X', 'X', null, null, null, null, null, null])).toEqual({ mark: 'X', line: [0, 1, 2] })
    expect(judge([null, null, 'O', null, 'O', null, 'O', null, null])).toEqual({ mark: 'O', line: [2, 4, 6] })
    expect(judge(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'])).toBe('draw')
    expect(judge(Array(9).fill(null))).toBeNull()
  })
  it('needs a majority to take a series', () => {
    expect([1, 3, 5].map(winsNeeded)).toEqual([1, 2, 3])
  })
})

describe('createTicTacToe', () => {
  it('needs exactly two players', () => {
    expect(() => createTicTacToe({ players: [players[0]] })).toThrow()
  })

  it('lets the starter be the host, the guest or a random player', () => {
    expect(game({ first: 'host' }).view('a').turnId).toBe('a')
    expect(game({ first: 'guest' }).view('a').turnId).toBe('b')
    expect(game({ first: 'random' }, () => 0.9).view('a').turnId).toBe('b')
    expect(game({ first: 'random' }, () => 0.1).view('a').turnId).toBe('a')
  })

  it('shows each player their own side of the same board', () => {
    const g = game()
    move(g, 'a', 4)
    const a = g.view('a')
    const b = g.view('b')
    expect(a.board).toEqual(b.board)
    expect(a.you).toMatchObject({ id: 'a', mark: 'X' })
    expect(a.them).toMatchObject({ id: 'b', mark: 'O' })
    expect(b.you).toMatchObject({ id: 'b', mark: 'O' })
    expect(b.turnId).toBe('b')
  })

  it('rejects moves out of turn, on taken squares, off the board, or from strangers', () => {
    const g = game()
    expect(move(g, 'b', 0).error).toMatch(/not your turn/)
    expect(move(g, 'a', 9).error).toMatch(/nine squares/)
    expect(move(g, 'a', 1.5).error).toMatch(/nine squares/)
    expect(move(g, 'a', '2').error).toMatch(/nine squares/)
    expect(move(g, 'zed', 0).error).toMatch(/not in this game/)
    expect(g.act('a', { a: 'cheat' }, 0).error).toMatch(/Unknown/)
    expect(move(g, 'a', 0).error).toBeUndefined()
    expect(move(g, 'b', 0).error).toMatch(/taken/)
  })

  it('scores a win, pauses, then starts the next game with the marks swapped', () => {
    const g = game({ bestOf: 3 })
    xWins(g)
    let v = g.view('a')
    expect(v.phase).toBe('between')
    expect(v.you.score).toBe(1)
    expect(v.last).toEqual({ winnerId: 'a', line: [0, 1, 2] })
    expect(move(g, 'b', 5).error).toMatch(/next game/)
    g.tick(BETWEEN_MS - 1)
    expect(g.view('a').phase).toBe('between')
    g.tick(BETWEEN_MS)
    v = g.view('a')
    expect(v.phase).toBe('play')
    expect(v.game).toBe(2)
    expect(v.board.every(c => c === null)).toBe(true)
    expect(v.you.mark).toBe('O')
    expect(v.turnId).toBe('b')
  })

  it('ends the series as soon as someone has the wins they need', () => {
    const g = game({ bestOf: 3 })
    xWins(g)
    g.tick(BETWEEN_MS)
    // game 2: Bob is X. Bob wins with the top row again.
    move(g, 'b', 0); move(g, 'a', 3); move(g, 'b', 1); move(g, 'a', 4); move(g, 'b', 2)
    expect(g.phase).toBe('between')
    g.tick(2 * BETWEEN_MS)
    // game 3: Ann is X again and wins.
    xWins(g, 2 * BETWEEN_MS)
    expect(g.phase).toBe('over')
    expect(g.view('a').seriesWinnerId).toBe('a')
    expect(g.view('b').you.score).toBe(1)
  })

  it('counts a drawn game and can end a series with nobody ahead', () => {
    const g = game({ bestOf: 1 })
    // X O X / X O O / O X X  (no line)
    for (const [id, cell] of [['a', 0], ['b', 1], ['a', 2], ['b', 4], ['a', 3], ['b', 5], ['a', 7], ['b', 6], ['a', 8]]) move(g, id, cell)
    const v = g.view('a')
    expect(v.phase).toBe('over')
    expect(v.draws).toBe(1)
    expect(v.seriesWinnerId).toBeNull()
  })

  it('gives the match to the player who stays when the other leaves', () => {
    const g = game({ bestOf: 5 })
    move(g, 'a', 0)
    g.leave('a')
    const v = g.view('b')
    expect(v).toMatchObject({ phase: 'over', seriesWinnerId: 'b', forfeit: true })
    expect(move(g, 'b', 1).error).toBeTruthy()
  })

  it('reports it is dirty until cleared, whenever something changes', () => {
    const g = game()
    expect(g.dirty).toBe(true)
    g.clearDirty()
    expect(g.dirty).toBe(false)
    move(g, 'b', 0) // rejected: nothing changed
    expect(g.dirty).toBe(false)
    move(g, 'a', 0)
    expect(g.dirty).toBe(true)
  })

  it('counts down the pause between games', () => {
    const g = game()
    xWins(g, 1000)
    expect(g.view('a', 1000).left).toBe(3)
    expect(g.view('a', 1000 + BETWEEN_MS).left).toBe(0)
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
const wait = ms => new Promise(r => setTimeout(r, ms))

function pair() {
  hub = createHub({ random: () => 0 })
  const host = client(hub)
  host.say({ t: 'create', name: 'Ann', game: 'tictactoe' })
  const guest = client(hub)
  guest.say({ t: 'join', code: host.last('joined').code, name: 'Bob', game: 'tictactoe' })
  return { host, guest }
}

describe('Tic Tac Toe rooms', () => {
  it('makes a room with defaults the host can change, and takes exactly two players', () => {
    const { host, guest } = pair()
    expect(host.last('room')).toMatchObject({ game: 'tictactoe', settings: { bestOf: 3, first: 'random' }, limits: { bestOf: [1, 3, 5] } })
    host.say({ t: 'settings', bestOf: 5, first: 'host' })
    host.say({ t: 'settings', bestOf: 4, first: 'nobody' }) // ignored
    guest.say({ t: 'settings', bestOf: 1 }) // only the host may
    expect(host.last('room').settings).toEqual({ bestOf: 5, first: 'host' })
    const third = client(hub)
    third.say({ t: 'join', code: host.last('joined').code, name: 'Cy', game: 'tictactoe' })
    expect(third.last('error').message).toMatch(/full/)
  })

  it('needs two players to start and names the game for a wrong-game join', () => {
    hub = createHub()
    const host = client(hub)
    host.say({ t: 'create', name: 'Ann', game: 'tictactoe' })
    host.say({ t: 'start' })
    expect(host.last('error').message).toMatch(/another player/)
    const other = client(hub)
    other.say({ t: 'join', code: host.last('joined').code, name: 'Bob', game: 'undercover' })
    expect(other.last('error').message).toMatch(/Tic Tac Toe/)
  })

  it('plays a move through the hub and tells both players', () => {
    const { host, guest } = pair()
    host.say({ t: 'settings', first: 'host' })
    host.say({ t: 'start' })
    expect(host.last('room').phase).toBe('game')
    expect(host.last('tstate').you.mark).toBe('X')
    guest.say({ t: 'ttt', a: 'move', cell: 0 })
    expect(guest.last('error').message).toMatch(/not your turn/)
    host.say({ t: 'ttt', a: 'move', cell: 4 })
    expect(guest.last('tstate').board[4]).toBe('X')
    expect(guest.last('tstate').turnId).toBe(guest.last('joined').id)
  })

  it('finishes the room when the series ends, and the host can go back to the lobby', () => {
    const { host, guest } = pair()
    host.say({ t: 'settings', bestOf: 1, first: 'host' })
    host.say({ t: 'start' })
    for (const [who, cell] of [[host, 0], [guest, 3], [host, 1], [guest, 4], [host, 2]]) who.say({ t: 'ttt', a: 'move', cell })
    expect(host.last('tstate').seriesWinnerId).toBe(host.last('joined').id)
    expect(host.last('room').phase).toBe('over')
    host.say({ t: 'lobby' })
    expect(host.last('room').phase).toBe('lobby')
  })

  it('moves on to the next game by itself', async () => {
    const { host, guest } = pair()
    host.say({ t: 'settings', bestOf: 3, first: 'host' })
    host.say({ t: 'start' })
    for (const [who, cell] of [[host, 0], [guest, 3], [host, 1], [guest, 4], [host, 2]]) who.say({ t: 'ttt', a: 'move', cell })
    expect(host.last('tstate').phase).toBe('between')
    await wait(BETWEEN_MS + 400)
    expect(host.last('tstate')).toMatchObject({ phase: 'play', game: 2 })
  })

  it('gives the match to the player who stays when the other drops', () => {
    const { host, guest } = pair()
    host.say({ t: 'start' })
    guest.drop()
    expect(host.last('tstate')).toMatchObject({ phase: 'over', forfeit: true, seriesWinnerId: host.last('joined').id })
    expect(host.last('room').phase).toBe('over')
  })
})
