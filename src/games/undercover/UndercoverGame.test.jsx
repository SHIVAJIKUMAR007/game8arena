// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import UndercoverGame from './UndercoverGame'
import { iWon, winnerTitle } from './outcome'

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
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ ips: ['192.168.1.9'], port: 8787 }) })))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

const roomMsg = (n, settings = {}, hostId = '1') => ({
  t: 'room', code: 'ABCD', game: 'undercover', hostId, phase: 'lobby',
  settings: { undercover: 1, mrwhite: 0, clueSeconds: 30, endRule: 'parity', ...settings },
  limits: { min: 3, max: 20, clueSeconds: [20, 30, 45, 60], endRules: ['parity', 'last'] },
  players: Array.from({ length: n }, (_, i) => ({ id: String(i + 1), name: `P${i + 1}` })),
})

function enter(n, settings, id = '1', hostId = '1') {
  render(<UndercoverGame />)
  act(() => socket().open())
  act(() => {
    socket().say({ t: 'joined', code: 'ABCD', id, game: 'undercover' })
    socket().say(roomMsg(n, settings, hostId))
  })
}

const view = (over = {}) => ({
  t: 'ustate', phase: 'reveal', round: 1, left: 30,
  you: { id: '1', alive: true, mrWhite: false, word: 'Coffee', ready: false, vote: null },
  players: [
    { id: '1', name: 'P1', alive: true, ready: false }, { id: '2', name: 'P2', alive: true, ready: false },
    { id: '3', name: 'P3', alive: true, ready: false }, { id: '4', name: 'P4', alive: true, ready: false },
  ],
  turnId: null, rounds: [], candidates: null, result: null, guessFor: null, winner: null, winners: [],
  counts: { civilian: 3, undercover: 1, mrwhite: 0 }, endRule: 'parity', ...over,
})
const showGame = v => {
  act(() => socket().say({ t: 'room', ...roomMsg(4), phase: 'game' }))
  act(() => socket().say(v))
}

describe('Undercover lobby', () => {
  it('creates an undercover room and sends the game type', () => {
    render(<UndercoverGame />)
    act(() => socket().open())
    fireEvent.change(screen.getByPlaceholderText('Player'), { target: { value: 'Ann' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }))
    expect(sent('create')).toEqual([{ t: 'create', name: 'Ann', game: 'undercover' }])
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'wxyz' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(sent('join')[0]).toMatchObject({ code: 'WXYZ', game: 'undercover' })
  })

  it('shows the role counts and lets the host change them', () => {
    enter(8, { undercover: 2, mrwhite: 1 })
    expect(screen.getByText(/5 civilians, 2 Undercover, 1 Mr\. White\. Up to 4 infiltrators with 8 players/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Undercover'), { target: { value: '3' } })
    expect(sent('settings')).toContainEqual({ t: 'settings', undercover: 3 })
    fireEvent.change(screen.getByLabelText('Mr. White'), { target: { value: '0' } })
    expect(sent('settings')).toContainEqual({ t: 'settings', mrwhite: 0 })
    fireEvent.change(screen.getByLabelText('Time for each clue'), { target: { value: '45' } })
    expect(sent('settings')).toContainEqual({ t: 'settings', clueSeconds: 45 })
    fireEvent.change(screen.getByLabelText('Infiltrators win when'), { target: { value: 'last' } })
    expect(sent('settings')).toContainEqual({ t: 'settings', endRule: 'last' })
  })

  it('blocks Start when the two role counts add up to more than half the players', () => {
    enter(6, { undercover: 3, mrwhite: 1 })
    expect(screen.getByText(/at most 3 Undercover and Mr\. White together/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start game' }).hasAttribute('disabled')).toBe(true)
    act(() => socket().say(roomMsg(6, { undercover: 2, mrwhite: 1 })))
    expect(screen.queryByText(/at most 3/)).toBeNull()
    const start = screen.getByRole('button', { name: 'Start game' })
    expect(start.hasAttribute('disabled')).toBe(false)
    fireEvent.click(start)
    expect(sent('start')).toHaveLength(1)
  })

  it('needs at least 3 players and at least one infiltrator', () => {
    enter(2)
    expect(screen.getByRole('button', { name: /Waiting for 1 more/ }).hasAttribute('disabled')).toBe(true)
    act(() => socket().say(roomMsg(5, { undercover: 0, mrwhite: 0 })))
    expect(screen.getByText(/at least one Undercover or Mr\. White/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start game' }).hasAttribute('disabled')).toBe(true)
  })

  it('shows a non-host the settings without controls', () => {
    enter(5, { undercover: 2, mrwhite: 1 }, '2', '1')
    expect(screen.queryByLabelText('Undercover')).toBeNull()
    expect(screen.getByText(/Waiting for the host/)).toBeTruthy()
  })
})

describe('Undercover game', () => {
  it('shows your word, lets you hide it, and sends ready', () => {
    enter(4)
    showGame(view())
    expect(screen.getByText('Coffee')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }))
    expect(screen.queryByText('Coffee')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    fireEvent.click(screen.getByRole('button', { name: 'I’m ready' }))
    expect(sent('uc')).toEqual([{ t: 'uc', a: 'ready' }])
  })

  it('tells Mr. White they have no word', () => {
    enter(4)
    showGame(view({ you: { id: '1', alive: true, mrWhite: true, word: null, ready: false, vote: null } }))
    expect(screen.getByText('Mr. White')).toBeTruthy()
    expect(screen.getByText(/no word/)).toBeTruthy()
  })

  it('on your turn, sends a clue; on someone else’s, only waits', () => {
    enter(4)
    showGame(view({ phase: 'clue', turnId: '2', rounds: [{ round: 1, items: [] }] }))
    expect(screen.getByText(/Waiting for/).textContent).toMatch(/P2/)
    expect(screen.queryByLabelText('Your clue')).toBeNull()
    act(() => socket().say(view({ phase: 'clue', turnId: '1', rounds: [{ round: 1, items: [{ id: '2', text: 'hot' }] }] })))
    expect(screen.getByText(/Your turn/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Your clue'), { target: { value: 'morning' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send clue' }))
    expect(sent('uc')).toContainEqual({ t: 'uc', a: 'clue', text: 'morning' })
    expect(screen.getByText('hot')).toBeTruthy()
  })

  it('lets you vote for another player and shows who has voted', () => {
    enter(4)
    showGame(view({
      phase: 'vote', rounds: [{ round: 1, items: [{ id: '2', text: 'hot' }] }],
      players: [
        { id: '1', name: 'P1', alive: true, voted: false }, { id: '2', name: 'P2', alive: true, voted: true },
        { id: '3', name: 'P3', alive: true, voted: false }, { id: '4', name: 'P4', alive: false, role: 'civilian', voted: false },
      ],
    }))
    const votes = screen.getAllByRole('button', { name: 'Vote' })
    expect(votes).toHaveLength(2) // not for yourself, not for someone who is out
    fireEvent.click(votes[1])
    expect(sent('uc')).toContainEqual({ t: 'uc', a: 'vote', target: '3' })
    expect(screen.getByText('voted')).toBeTruthy()
    expect(screen.getByText('Civilian')).toBeTruthy()
  })

  it('in a revote only the tied players can be picked', () => {
    enter(4)
    showGame(view({ phase: 'vote', candidates: ['2'], rounds: [{ round: 1, items: [] }] }))
    expect(screen.getByText(/It was a tie/)).toBeTruthy()
    const buttons = screen.getAllByRole('button', { name: 'Vote' })
    expect(buttons.filter(b => !b.hasAttribute('disabled'))).toHaveLength(1)
  })

  it('lets a voted-out Mr. White guess, and shows others a waiting message', () => {
    enter(4)
    showGame(view({
      phase: 'guess', guessFor: '1', you: { id: '1', alive: false, mrWhite: true, word: null, ready: true, vote: null },
      result: { eliminated: { id: '1', name: 'P1', role: 'mrwhite' }, tie: false, votes: [{ from: '2', to: '1' }] },
    }))
    expect(screen.getByText(/You were voted out/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Your guess'), { target: { value: 'tea' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guess' }))
    expect(sent('uc')).toContainEqual({ t: 'uc', a: 'guess', text: 'tea' })
    act(() => socket().say(view({ phase: 'guess', guessFor: '3', result: { eliminated: { id: '3', name: 'P3', role: 'mrwhite' }, tie: false, votes: [] } })))
    expect(screen.getByText(/Mr\. White is guessing/)).toBeTruthy()
  })

  it('shows who was voted out, their role, and who voted for whom', () => {
    enter(4)
    showGame(view({
      phase: 'result', result: { eliminated: { id: '3', name: 'P3', role: 'undercover' }, tie: false, votes: [{ from: '1', to: '3' }, { from: '2', to: '3' }] },
      players: [
        { id: '1', name: 'P1', alive: true }, { id: '2', name: 'P2', alive: true }, { id: '3', name: 'P3', alive: false, role: 'undercover' }, { id: '4', name: 'P4', alive: true },
      ],
    }))
    expect(screen.getAllByText('P3').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Undercover').length).toBeGreaterThan(0)
    expect(screen.getByText('P1 → P3')).toBeTruthy()
  })

  it('shows the winner, both words and every role at the end, and the host can play again', () => {
    enter(4)
    showGame(view({
      phase: 'over', winner: 'civilians', winners: ['1', '2'], words: { civilian: 'Coffee', undercover: 'Tea' },
      you: { id: '1', alive: true, mrWhite: false, word: 'Coffee', ready: true, vote: null, role: 'civilian' },
      players: [
        { id: '1', name: 'P1', alive: true, role: 'civilian' }, { id: '2', name: 'P2', alive: true, role: 'civilian' },
        { id: '3', name: 'P3', alive: false, role: 'undercover' }, { id: '4', name: 'P4', alive: false, role: 'civilian' },
      ],
    }))
    const dialog = screen.getByRole('dialog', { name: 'Game over' })
    expect(dialog.textContent).toMatch(/Civilians win/)
    expect(dialog.textContent).toMatch(/You are on the winning side/)
    expect(dialog.textContent).toMatch(/Coffee.*Tea/)
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(sent('lobby')).toHaveLength(1)
    act(() => socket().say(roomMsg(4)))
    expect(screen.getByLabelText(/Room code/)).toBeTruthy()
  })

  it('shows server errors and returns to the menu when the connection drops', () => {
    enter(4)
    showGame(view({ phase: 'clue', turnId: '1', rounds: [{ round: 1, items: [] }] }))
    act(() => socket().say({ t: 'error', message: 'You cannot say your own word.' }))
    expect(screen.getByRole('alert').textContent).toMatch(/own word/)
    act(() => socket().onclose())
    expect(screen.getByRole('alert').textContent).toMatch(/npm run host/)
  })
})

describe('outcome', () => {
  const v = (winner, role, winners = []) => ({ winner, winners, you: { id: '9', role } })
  it('works out who won from the final view', () => {
    expect(iWon(v('civilians', 'civilian'))).toBe(true)
    expect(iWon(v('civilians', 'undercover'))).toBe(false)
    expect(iWon(v('undercover', 'undercover'))).toBe(true)
    expect(iWon(v('infiltrators', 'mrwhite'))).toBe(true)
    expect(iWon(v('infiltrators', 'civilian'))).toBe(false)
    expect(iWon(v('mrwhite', 'mrwhite', ['9']))).toBe(true)
    expect(iWon(v('mrwhite', 'mrwhite', ['8']))).toBe(false)
    expect(iWon(v('none', 'civilian'))).toBe(false)
    expect(winnerTitle(v('mrwhite', 'x'))).toBe('Mr. White wins!')
    expect(winnerTitle(v('none', 'x'))).toBe('Game over')
  })
})
