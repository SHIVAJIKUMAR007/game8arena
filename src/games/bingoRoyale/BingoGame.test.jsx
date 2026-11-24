// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import BingoGame from './BingoGame'

class FakeSocket {
  static all = []
  constructor(url) {
    this.url = url
    this.readyState = 0
    this.sent = []
    FakeSocket.all.push(this)
  }
  send(text) { this.sent.push(JSON.parse(text)) }
  close() { this.readyState = 3 }
  open() { this.readyState = 1; this.onopen?.() }
  say(msg) { this.onmessage?.({ data: JSON.stringify(msg) }) }
}
const socket = () => FakeSocket.all[FakeSocket.all.length - 1]
const sent = type => socket().sent.filter(m => m.t === type)

beforeEach(() => {
  FakeSocket.all = []
  vi.stubGlobal('WebSocket', FakeSocket)
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ ips: [], port: 8787 }) })))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

const ordered = () => Array.from({ length: 25 }, (_, i) => i + 1)
const reversed = () => ordered().reverse()
const room = (players, extra = {}) => ({
  t: 'room', code: 'ABCD', game: 'bingo', hostId: '1', phase: 'lobby', settings: { turnSeconds: 30 }, limits: { turnSeconds: [0, 15, 30, 60] }, players, ...extra,
})
const lobbyPlayers = (readyA = false, readyB = false) => [{ id: '1', name: 'Ann', ready: readyA }, { id: '2', name: 'Bob', ready: readyB }]
const view = (extra = {}) => ({
  t: 'bstate', phase: 'play', you: '1', need: 5, turnSeconds: 30, left: 20, forfeit: false, winners: [], called: [], turnId: '1',
  players: [
    { id: '1', name: 'Ann', active: true, board: ordered(), lines: [], count: 0 },
    { id: '2', name: 'Bob', active: true, board: reversed(), lines: [], count: 0 },
  ],
  ...extra,
})

function enter(you = '1', players = lobbyPlayers()) {
  render(<BingoGame />)
  act(() => socket().open())
  act(() => {
    socket().say({ t: 'joined', code: 'ABCD', id: you })
    socket().say(room(players))
  })
}
const startMatch = (v = view(), players = [{ id: '1', name: 'Ann', ready: true }, { id: '2', name: 'Bob', ready: true }]) =>
  act(() => {
    socket().say(room(players, { phase: 'game' }))
    socket().say(v)
  })

describe('Bingo Royale board setup', () => {
  it('creates a room for the bingo game', () => {
    render(<BingoGame />)
    act(() => socket().open())
    fireEvent.change(screen.getByPlaceholderText('Player'), { target: { value: 'Ann' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }))
    expect(socket().sent).toContainEqual({ t: 'create', name: 'Ann', game: 'bingo' })
  })

  it('fills a square by tapping it and then a number, and moves on to the next empty square', () => {
    enter()
    expect(screen.getByRole('button', { name: /Place 25 more numbers/ }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Square 1, empty' }))
    fireEvent.click(screen.getByRole('button', { name: 'Number 7' }))
    fireEvent.click(screen.getByRole('button', { name: 'Number 3' })) // goes to square 2 without tapping it
    expect(screen.getByRole('button', { name: 'Square 1, 7' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Square 2, 3' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Number 7' })).toBeNull() // used numbers leave the tray
  })

  it('fills a square by picking a number first, and empties a square with a second tap', () => {
    enter()
    fireEvent.click(screen.getByRole('button', { name: 'Number 12' }))
    fireEvent.click(screen.getByRole('button', { name: 'Square 5, empty' }))
    expect(screen.getByRole('button', { name: 'Square 5, 12' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Square 5, 12' }))
    fireEvent.click(screen.getByRole('button', { name: 'Square 5, 12' }))
    expect(screen.getByRole('button', { name: 'Square 5, empty' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Number 12' })).toBeTruthy()
  })

  it('shuffles a full board, confirms it, and then locks it until the player edits', () => {
    enter()
    fireEvent.click(screen.getByRole('button', { name: /Shuffle/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm my board' }))
    const [confirm] = sent('bingo')
    expect(confirm.a).toBe('board')
    expect([...confirm.cells].sort((a, b) => a - b)).toEqual(ordered())
    act(() => socket().say(room(lobbyPlayers(true, false))))
    expect(screen.getByText(/Your board is locked in/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Shuffle/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit my board' }))
    expect(sent('bingo')).toContainEqual({ t: 'bingo', a: 'edit' })
  })

  it('shows the order, who is ready, and only lets the host start when everyone is', () => {
    enter('1', lobbyPlayers(true, false))
    const list = screen.getByRole('list', { name: 'Players' })
    expect(within(list).getByText('ready')).toBeTruthy()
    expect(within(list).getByText('setting up')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start game' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText(/Everyone must confirm their board/)).toBeTruthy()
    act(() => socket().say(room(lobbyPlayers(true, true))))
    expect(screen.getByRole('button', { name: 'Start game' }).hasAttribute('disabled')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }))
    expect(sent('start')).toHaveLength(1)
  })

  it('lets only the host change the turn timer', () => {
    enter('1')
    fireEvent.change(screen.getByLabelText('Time for each turn'), { target: { value: '60' } })
    expect(socket().sent).toContainEqual({ t: 'settings', turnSeconds: 60 })
    cleanup()
    enter('2')
    expect(screen.queryByLabelText('Time for each turn')).toBeNull()
    expect(screen.getByText('30 seconds')).toBeTruthy()
  })
})

describe('Bingo Royale match', () => {
  it('shows whose turn it is and lets the player announce a chosen unused number', () => {
    enter()
    startMatch(view({ called: [{ n: 5, by: '2', auto: false }] }))
    expect(screen.getByRole('status').textContent).toMatch(/Your turn/)
    expect(screen.queryByRole('button', { name: 'Number 5' })).toBeNull() // already announced: not offered
    const announce = screen.getByRole('button', { name: 'Pick a number' })
    expect(announce.hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Number 9' }))
    fireEvent.click(screen.getByRole('button', { name: /Announce 9/ }))
    expect(socket().sent).toContainEqual({ t: 'bingo', a: 'call', n: 9 })
  })

  it('shows no picker when it is somebody else’s turn', () => {
    enter()
    startMatch(view({ turnId: '2' }))
    expect(screen.getByRole('status').textContent).toMatch(/Bob is choosing/)
    expect(screen.queryByRole('group', { name: /Choose a number/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Announce/ })).toBeNull()
  })

  it('marks announced numbers on every board and shows the latest announcement and history', () => {
    enter()
    startMatch(view({ turnId: '2', called: [{ n: 3, by: '1', auto: false }, { n: 20, by: '2', auto: true }] }))
    const mine = screen.getByRole('group', { name: 'Ann\'s board' })
    expect(within(mine).getByLabelText('3, announced')).toBeTruthy()
    expect(within(mine).getByLabelText('20, announced')).toBeTruthy()
    expect(within(mine).getByLabelText('4')).toBeTruthy() // not announced
    const theirs = screen.getByRole('group', { name: 'Bob\'s board' })
    expect(within(theirs).getByLabelText('3, announced')).toBeTruthy()
    expect(screen.getByText('Bob ran out of time')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Announced numbers' })).getAllByRole('listitem').map(li => li.textContent)).toEqual(['3', '20'])
  })

  it('shows progress toward 5 lines and highlights completed lines', () => {
    enter()
    startMatch(view({
      turnId: '2', called: [1, 2, 3, 4, 5].map(n => ({ n, by: '1', auto: false })),
      players: [
        { id: '1', name: 'Ann', active: true, board: ordered(), lines: [0], count: 1 },
        { id: '2', name: 'Bob', active: true, board: reversed(), lines: [], count: 0 },
      ],
    }))
    expect(screen.getByLabelText('1 of 5 lines')).toBeTruthy()
    expect(screen.getByText('1/5 lines')).toBeTruthy()
    expect(screen.getByText('Row 1')).toBeTruthy()
    const mine = screen.getByRole('group', { name: 'Ann\'s board' })
    expect(within(mine).getByLabelText('1, announced, in a completed line')).toBeTruthy()
    expect(within(mine).getByLabelText('6')).toBeTruthy() // not in the line
  })

  it('lists the playing order and counts down the turn', () => {
    vi.useFakeTimers()
    enter()
    startMatch(view({ left: 12 }))
    const order = screen.getByRole('list', { name: /Playing order/ })
    expect(within(order).getAllByRole('listitem').map(li => li.textContent)).toEqual([expect.stringContaining('Ann (you)'), expect.stringContaining('Bob')])
    expect(screen.getByLabelText('Seconds left').textContent).toMatch(/12s/)
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByLabelText('Seconds left').textContent).toMatch(/9s/)
    vi.useRealTimers()
  })

  it('ends with the winner, their board with the lit lines, final scores and host buttons', () => {
    enter()
    const called = ordered().slice(0, 25).map(n => ({ n, by: '1', auto: false }))
    startMatch(view({
      phase: 'over', turnId: null, winners: ['1'], called,
      players: [
        { id: '1', name: 'Ann', active: true, board: ordered(), lines: [0, 1, 2, 3, 4], count: 5 },
        { id: '2', name: 'Bob', active: true, board: reversed(), lines: [0, 1], count: 2 },
      ],
    }))
    const dialog = screen.getByRole('dialog', { name: 'Game over' })
    expect(dialog.textContent).toMatch(/You win!/)
    expect(dialog.textContent).toMatch(/Row 1 · Row 2 · Row 3 · Row 4 · Row 5/)
    const scores = within(screen.getByRole('list', { name: 'Final scores' })).getAllByRole('listitem').map(li => li.textContent)
    expect(scores[0]).toMatch(/Ann \(you\)5 lines/)
    expect(scores[1]).toMatch(/Bob2 lines/)
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(socket().sent).toContainEqual({ t: 'lobby', keep: true })
    fireEvent.click(screen.getByRole('button', { name: 'Return to lobby' }))
    expect(socket().sent).toContainEqual({ t: 'lobby' })
  })

  it('names the winner for a guest, who waits for the host, and handles a tie', () => {
    enter('2')
    startMatch(view({
      you: '2', phase: 'over', turnId: null, winners: ['1'],
      players: [
        { id: '1', name: 'Ann', active: true, board: ordered(), lines: [0, 1, 2, 3, 4], count: 5 },
        { id: '2', name: 'Bob', active: true, board: reversed(), lines: [], count: 0 },
      ],
    }))
    expect(screen.getByRole('dialog').textContent).toMatch(/Ann wins!/)
    expect(screen.getByText(/Waiting for the host/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Play again' })).toBeNull()
    act(() => socket().say(view({
      you: '2', phase: 'over', turnId: null, winners: ['1', '2'],
      players: [
        { id: '1', name: 'Ann', active: true, board: ordered(), lines: [0, 1, 2, 3, 4], count: 5 },
        { id: '2', name: 'Bob', active: true, board: reversed(), lines: [0, 1, 2, 3, 4], count: 5 },
      ],
    })))
    expect(screen.getByRole('dialog').textContent).toMatch(/tie: Ann & Bob/)
  })

  it('sends a player who leaves back to the menu', () => {
    enter()
    startMatch(view({ phase: 'over', turnId: null, winners: ['1'] }))
    fireEvent.click(screen.getByRole('button', { name: 'Leave room' }))
    expect(socket().sent).toContainEqual({ t: 'leave' })
  })
})
