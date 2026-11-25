// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createTambola } from '../../../server/tambola.js'

// The room connection is replaced by a stub the test can push messages through. The round state is made by the real
// server rules (server/tambola.js), so the screen is tested against exactly what a host would send.
let handler
let sent
let socket
vi.mock('../../platform/multiplayer/useRoomSocket', () => ({
  useRoomSocket: ({ onMessage }) => {
    handler = onMessage
    return {
      conn: 'open', mode: 'p2p', error: socket.error || '', send: m => sent.push(m), me: socket.me, room: socket.room,
      create: () => sent.push({ t: 'create' }), join: () => {}, retry: () => {}, start: () => sent.push({ t: 'start' }),
      setSettings: p => sent.push({ t: 'settings', ...p }), toLobby: () => sent.push({ t: 'lobby' }), leave: () => sent.push({ t: 'leave' }),
    }
  },
}))

import TambolaGame from './TambolaGame'

const room = (phase, over = {}) => ({
  t: 'room', code: 'ABCD', game: 'tambola', hostId: '1', phase, settings: { callSeconds: 8, markSeconds: 5, tickets: 1 },
  limits: { callSeconds: [6, 8, 10, 15], markSeconds: [3, 5, 8, 10], tickets: [1, 2, 3] },
  players: [{ id: '1', name: 'Ann' }, { id: '2', name: 'Bob' }, { id: '3', name: 'Cy' }], ...over,
})
const push = m => act(() => handler(m))
const enter = (phase = 'game', id = '1') => {
  socket = { me: { id, code: 'ABCD' }, room: room(phase), error: '' }
  render(<TambolaGame initialMode="multi" />)
}

beforeEach(() => {
  sent = []
  socket = { me: null, room: null, error: '' }
})
afterEach(() => cleanup())

const people = [{ id: '1', name: 'Ann' }, { id: '2', name: 'Bob' }, { id: '3', name: 'Cy' }]
const newGame = () => createTambola({ players: people, settings: {}, random: () => 0.37, now: 0 })
const mark = (g, id, t) => g.view(id, t).due.forEach(d => g.act(id, { a: 'mark', n: d.n, ticket: d.ticket }, t))

/** Plays on (Bob and Cy keep up) until Ann has a number to cut. */
function untilAnnDue() {
  const g = newGame()
  for (let t = 0; t < 2000000; t += 1000) {
    g.tick(t)
    mark(g, '2', t)
    mark(g, '3', t)
    if (g.view('1', t).due.length) return { g, t }
  }
  throw new Error('no number came up')
}

describe('choosing a mode', () => {
  it('offers friends or solo, and solo still opens the level game', () => {
    render(<TambolaGame />)
    expect(screen.getByRole('button', { name: /Play with friends/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Solo levels/ }))
    expect(screen.getByRole('button', { name: /Play/ })).toBeTruthy()
  })

  it('friends mode shows the room menu, and can go back to the modes', () => {
    render(<TambolaGame />)
    fireEvent.click(screen.getByRole('button', { name: /Play with friends/ }))
    expect(screen.getByRole('button', { name: 'Create a room' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }))
    expect(sent).toContainEqual({ t: 'create' })
    fireEvent.click(screen.getByRole('button', { name: /Back to modes/ }))
    expect(screen.getByRole('button', { name: /Solo levels/ })).toBeTruthy()
  })

  it('?mode=multi opens the friends room menu at once', () => {
    render(<TambolaGame initialMode="multi" />)
    expect(screen.getByRole('button', { name: 'Create a room' })).toBeTruthy()
  })
})

describe('lobby', () => {
  it('shows the rules, and lets only the host change the timers', () => {
    enter('lobby', '1')
    expect(screen.getByText('ABCD')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Time to cut a number'), { target: { value: '3' } })
    expect(sent).toContainEqual({ t: 'settings', markSeconds: 3 })
    fireEvent.change(screen.getByLabelText('Tickets each'), { target: { value: '2' } })
    expect(sent).toContainEqual({ t: 'settings', tickets: 2 })
    expect(screen.getAllByText(/you are out of the round/i).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }))
    expect(sent).toContainEqual({ t: 'start' })
  })

  it('a guest sees the timers but cannot change them', () => {
    enter('lobby', '2')
    expect(screen.queryByLabelText('Time to cut a number')).toBeNull()
    expect(screen.getByText('5 seconds')).toBeTruthy()
  })

  it('only offers mark windows that fit inside the gap between numbers', () => {
    socket = { me: { id: '1', code: 'ABCD' }, room: room('lobby', { settings: { callSeconds: 6, markSeconds: 5, tickets: 1 } }), error: '' }
    render(<TambolaGame initialMode="multi" />)
    const options = [...within(screen.getByLabelText('Time to cut a number')).getAllByRole('option')].map(o => o.textContent)
    expect(options).toEqual(['3 seconds', '5 seconds'])
  })
})

describe('the round', () => {
  it('shows your ticket, the prizes and a waiting message before the first number', () => {
    enter()
    const g = newGame()
    push(g.view('1', 0))
    const ticket = screen.getByRole('group', { name: 'Ticket 1' })
    expect(ticket.querySelectorAll('button')).toHaveLength(15)
    expect(screen.getByText('Early Five')).toBeTruthy()
    expect(screen.getByText(/first number is coming/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Claim Early Five/ })).toBeTruthy()
    // other players are listed, but nobody else's ticket is on screen
    const players = screen.getByRole('list', { name: 'Players' })
    expect(within(players).getAllByRole('listitem')).toHaveLength(3)
  })

  it('tells you to cut a called number, with a countdown, and sends the mark when you tap it', () => {
    enter()
    const { g, t } = untilAnnDue()
    push(g.view('1', t))
    const d = g.view('1', t).due[0]
    expect(screen.getByRole('status').textContent).toMatch(new RegExp(`Cut ${d.n} on ticket ${d.ticket + 1} now`))
    const cell = screen.getByRole('button', { name: `Ticket ${d.ticket + 1}, number ${d.n}, cut it now` })
    fireEvent.click(cell)
    expect(sent).toContainEqual({ t: 'tb', a: 'mark', n: d.n, ticket: d.ticket })

    // the host confirms: the cell is marked and the warning goes away
    g.act('1', { a: 'mark', n: d.n, ticket: d.ticket }, t)
    push(g.view('1', t))
    expect(screen.getByRole('button', { name: `Ticket ${d.ticket + 1}, number ${d.n}, marked` })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/caught up/)
  })

  it('does not send a tap on a number that has not been called', () => {
    enter()
    const { g, t } = untilAnnDue()
    const v = g.view('1', t)
    push(v)
    const calledSet = new Set(v.called)
    const uncalled = v.tickets[0].flat().find(n => n !== null && !calledSet.has(n))
    sent.length = 0
    fireEvent.click(screen.getByRole('button', { name: `Ticket 1, number ${uncalled}` }))
    expect(sent).toEqual([])
  })

  it('pressing C or the button claims the current prize', () => {
    enter()
    const g = newGame()
    push(g.view('1', 0))
    fireEvent.click(screen.getByRole('button', { name: /Claim Early Five/ }))
    expect(sent).toContainEqual({ t: 'tb', a: 'claim' })
    sent.length = 0
    fireEvent.keyDown(screen.getByRole('button', { name: /Claim Early Five/ }), { key: 'c' })
    expect(sent).toContainEqual({ t: 'tb', a: 'claim' })
  })

  it('a false claim locks the button for a moment', () => {
    enter()
    const g = newGame()
    g.act('1', { a: 'claim' }, 5000)
    push(g.view('1', 5000))
    expect(screen.getByRole('button', { name: /Claim Early Five \(\d+s\)/ }).disabled).toBe(true)
  })

  it('shows that you are out after missing a number: watching only, nothing to tap or claim', () => {
    enter()
    const { g, t } = untilAnnDue()
    let tt = t
    while (g.view('1', tt).players[0].active && tt < t + 20000) {
      tt += 1000
      g.tick(tt)
      mark(g, '2', tt)
      mark(g, '3', tt)
    }
    push(g.view('1', tt))
    expect(screen.getByRole('status').textContent).toMatch(/You are out: you missed \d+/)
    expect(screen.getByRole('button', { name: /Claim Early Five/ }).disabled).toBe(true)
    const cells = screen.getByRole('group', { name: 'Ticket 1' }).querySelectorAll('button')
    expect([...cells].every(c => c.disabled)).toBe(true)
    expect(within(screen.getByRole('list', { name: 'Players' })).getAllByRole('listitem')[0].className).toMatch(/gone/)
    expect(screen.getByRole('list', { name: 'What just happened' }).textContent).toMatch(/Ann is out: missed/)
  })

  it('shows the result when the round ends, with play again for the host', () => {
    enter()
    const g = createTambola({ players: people.slice(0, 2), settings: {}, random: () => 0.37, now: 0 })
    let t = 0
    while (g.phase === 'play' && t < 2000000) {
      g.tick(t)
      mark(g, '2', t)
      t += 1000
    }
    push(g.view('1', t))
    const dlg = screen.getByRole('dialog', { name: 'Round over' })
    expect(within(dlg).getByRole('heading').textContent).toBe('Bob wins!')
    expect(within(dlg).getByText(/last player standing/)).toBeTruthy()
    fireEvent.click(within(dlg).getByRole('button', { name: 'Play again' }))
    expect(sent).toContainEqual({ t: 'lobby', keep: true })
    fireEvent.click(within(dlg).getByRole('button', { name: 'Return to lobby' }))
    expect(sent).toContainEqual({ t: 'lobby' })
  })

  it('goes back to the lobby view when the host starts another round', () => {
    enter()
    push(newGame().view('1', 0))
    expect(screen.getByRole('group', { name: 'Ticket 1' })).toBeTruthy()
    socket.room = room('lobby')
    push(room('lobby'))
    expect(screen.queryByRole('group', { name: 'Ticket 1' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Start game' })).toBeTruthy()
  })
})
