// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import TicTacToeGame from './TicTacToeGame'

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

const players = [{ id: '1', name: 'Ann' }, { id: '2', name: 'Bob' }]
const room = (extra = {}) => ({ t: 'room', code: 'ABCD', game: 'tictactoe', hostId: '1', phase: 'lobby', settings: { bestOf: 3, first: 'random' }, limits: { bestOf: [1, 3, 5], first: ['random', 'host', 'guest'] }, players, ...extra })
const state = (extra = {}) => ({
  t: 'tstate', phase: 'play', board: Array(9).fill(null), game: 1, bestOf: 3, turnId: '1',
  you: { id: '1', name: 'Ann', mark: 'X', score: 0 }, them: { id: '2', name: 'Bob', mark: 'O', score: 0 },
  draws: 0, last: null, seriesWinnerId: null, forfeit: false, left: 0, ...extra,
})

function enter(you = '1') {
  render(<TicTacToeGame />)
  act(() => socket().open())
  act(() => {
    socket().say({ t: 'joined', code: 'ABCD', id: you })
    socket().say(room({ hostId: '1' }))
  })
}

describe('Tic Tac Toe screens', () => {
  it('creates a room with the typed name for the tictactoe game', () => {
    render(<TicTacToeGame />)
    act(() => socket().open())
    fireEvent.change(screen.getByPlaceholderText('Player'), { target: { value: 'Ann' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }))
    expect(socket().sent).toContainEqual({ t: 'create', name: 'Ann', game: 'tictactoe' })
  })

  it('lets the host change the match and start, while the guest only sees the settings', () => {
    enter('1')
    fireEvent.change(screen.getByLabelText('Match length'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Who plays X first'), { target: { value: 'guest' } })
    expect(socket().sent).toContainEqual({ t: 'settings', bestOf: 5 })
    expect(socket().sent).toContainEqual({ t: 'settings', first: 'guest' })
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }))
    expect(socket().sent).toContainEqual({ t: 'start' })
    cleanup()
    enter('2')
    expect(screen.queryByLabelText('Match length')).toBeNull()
    expect(screen.getByText(/Waiting for the host to start/)).toBeTruthy()
  })

  it('sends a move on your turn and blocks squares when it is not your turn or they are taken', () => {
    enter('1')
    act(() => {
      socket().say(room({ phase: 'game' }))
      socket().say(state({ board: [null, 'O', null, null, null, null, null, null, null] }))
    })
    expect(screen.getByRole('status').textContent).toBe('Your turn (X)')
    fireEvent.click(screen.getByRole('button', { name: 'Square 2, O' }))
    expect(socket().sent.filter(m => m.t === 'ttt')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Square 5, empty' }))
    expect(socket().sent).toContainEqual({ t: 'ttt', a: 'move', cell: 4 })

    act(() => socket().say(state({ turnId: '2' })))
    expect(screen.getByRole('status').textContent).toMatch(/Waiting for Bob/)
    fireEvent.click(screen.getByRole('button', { name: 'Square 1, empty' }))
    expect(socket().sent.filter(m => m.t === 'ttt')).toHaveLength(1)
  })

  it('moves the focus with the arrow keys', () => {
    enter('1')
    act(() => {
      socket().say(room({ phase: 'game' }))
      socket().say(state())
    })
    const centre = screen.getByRole('button', { name: 'Square 5, empty' })
    centre.focus()
    fireEvent.keyDown(centre, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Square 6, empty' }))
    fireEvent.keyDown(document.activeElement, { key: 'ArrowRight' }) // edge: stays
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Square 6, empty' }))
    fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Square 3, empty' }))
  })

  it('shows the score and the pause between games', () => {
    enter('1')
    act(() => {
      socket().say(room({ phase: 'game' }))
      socket().say(state({ phase: 'between', game: 1, left: 2, you: { id: '1', name: 'Ann', mark: 'X', score: 1 }, last: { winnerId: '1', line: [0, 1, 2] }, board: ['X', 'X', 'X', 'O', 'O', null, null, null, null] }))
    })
    expect(screen.getByRole('status').textContent).toMatch(/You win this game!/)
    expect(screen.getByLabelText('Score').textContent).toMatch(/Ann \(you, X\)1/)
    expect(screen.getByText('Game 1 of 3')).toBeTruthy()
  })

  it('ends with the match result and a play again for the host only', () => {
    enter('1')
    act(() => {
      socket().say(room({ phase: 'game' }))
      socket().say(state({ phase: 'over', seriesWinnerId: '1', you: { id: '1', name: 'Ann', mark: 'X', score: 2 }, them: { id: '2', name: 'Bob', mark: 'O', score: 1 }, draws: 1 }))
    })
    const dialog = screen.getByRole('dialog', { name: 'Game over' })
    expect(dialog.textContent).toMatch(/You win the match/)
    expect(dialog.textContent).toMatch(/Ann 2 – 1 Bob · 1 draw/)
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(socket().sent).toContainEqual({ t: 'lobby' })
    act(() => socket().say(room()))
    expect(screen.getByLabelText(/Room code/)).toBeTruthy()
  })

  it('tells a guest when the host left and the match was forfeited', () => {
    enter('2')
    act(() => {
      socket().say(room({ phase: 'game' }))
      socket().say(state({
        phase: 'over', forfeit: true, seriesWinnerId: '2', turnId: '2',
        you: { id: '2', name: 'Bob', mark: 'O', score: 0 }, them: { id: '1', name: 'Ann', mark: 'X', score: 0 },
      }))
    })
    expect(screen.getByRole('dialog').textContent).toMatch(/Ann left the game/)
    expect(screen.queryByRole('button', { name: 'Play again' })).toBeNull()
  })
})
