// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import TambolaGame from './TambolaGame'
import { generateLevel, getSolution } from './levels'
import { progressStore, getProgress } from '../../platform/progress'
import { readStats } from './store'
import { ticketNumbers } from './ticket'

const fresh = () => ({
  level: 1, best: 0, stars: {}, highScore: 0, extraLives: 0, tutorialSeen: true,
  stats: { cleared: 0, flawless: 0, launches: 0, blocked: 0, bestCombo: 0, hints: 0 },
  achievements: {}, daily: { last: null, streak: 0, best: 0, history: {} },
})

beforeEach(() => {
  vi.useFakeTimers()
  progressStore('tambola').set(fresh)
})
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear() })

const lv = generateLevel('tambola:L1', { level: 1 })
const lives = () => screen.getByRole('img', { name: /lives left/ }).getAttribute('aria-label')
const cell = (t, n) => screen.getByRole('button', { name: `Ticket ${t + 1}, number ${n}` })
const tick = ms => act(() => { vi.advanceTimersByTime(ms) })
const callNext = () => tick(lv.interval)

function start() {
  render(<TambolaGame initialMode="solo" />)
  fireEvent.click(screen.getByRole('button', { name: /Play/ }))
  tick(1300) // the first number is called
}

describe('Tambola end to end (level 1)', () => {
  it('shows the menu, then a ticket with 15 numbers and the goal', () => {
    render(<TambolaGame initialMode="solo" />)
    expect(screen.getByRole('button', { name: /Play/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Play/ }))
    const ticket = screen.getByRole('group', { name: 'Ticket 1' })
    expect(ticket.querySelectorAll('button')).toHaveLength(15)
    expect(ticket.querySelectorAll('.tb-blank')).toHaveLength(12)
    expect(screen.getByText('Early Five')).toBeTruthy()
    expect(screen.getByText('No rivals on this level.')).toBeTruthy()
  })

  it('calls numbers in the level order and lists them on the board', () => {
    start()
    expect(screen.getByRole('group', { name: 'Numbers called so far' }).querySelectorAll('.out')).toHaveLength(1)
    callNext()
    const board = screen.getByRole('group', { name: 'Numbers called so far' })
    expect(board.querySelectorAll('.out')).toHaveLength(2)
    expect(screen.getByLabelText(`${lv.calls[1]}, called`)).toBeTruthy()
  })

  it('wins the level by marking every called number and pressing Claim', () => {
    const { numbers, claimAfter, ticket } = getSolution(lv)
    start()
    for (let call = 1; call <= claimAfter; call++) {
      if (call > 1) callNext()
      const n = lv.calls[call - 1]
      if (numbers.includes(n)) fireEvent.click(cell(ticket, n))
    }
    expect(lives()).toContain('3 of 3')
    fireEvent.click(screen.getByRole('button', { name: /Claim Early Five/ }))
    tick(400)
    expect(screen.getByText(/Level 1 cleared/)).toBeTruthy()
    const p = getProgress('tambola')
    expect(p.best).toBe(1)
    expect(p.level).toBe(2)
    expect(readStats(p).won).toBe(1)
    expect(readStats(p).bestTimes[1]).toBeGreaterThan(0)
  })

  it('claims with the C key', () => {
    const { numbers, claimAfter, ticket } = getSolution(lv)
    start()
    for (let call = 1; call <= claimAfter; call++) {
      if (call > 1) callNext()
      if (numbers.includes(lv.calls[call - 1])) fireEvent.click(cell(ticket, lv.calls[call - 1]))
    }
    fireEvent.keyDown(screen.getByRole('status').parentElement, { key: 'c' })
    tick(400)
    expect(screen.getByText(/Level 1 cleared/)).toBeTruthy()
  })

  it('costs a life to mark a number that has not been called', () => {
    start()
    const uncalled = ticketNumbers(lv.tickets[0]).find(n => !lv.calls.slice(0, 1).includes(n))
    fireEvent.click(cell(0, uncalled))
    expect(lives()).toContain('2 of 3')
    expect(screen.getByRole('status').textContent).toMatch(/has not been called/)
    expect(cell(0, uncalled).getAttribute('aria-pressed')).toBe('false')
  })

  it('costs a life to claim before the pattern is complete', () => {
    start()
    fireEvent.click(screen.getByRole('button', { name: /Claim Early Five/ }))
    expect(lives()).toContain('2 of 3')
    expect(screen.getByRole('status').textContent).toMatch(/not a Early Five yet|not an? Early Five yet/)
  })

  it('shows Out of lives after three mistakes', () => {
    start()
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: /Claim Early Five/ }))
    tick(600)
    expect(screen.getByRole('heading', { name: /Out of lives/ })).toBeTruthy()
  })

  it('stops the caller while the game is paused behind an overlay', () => {
    start()
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: /Claim Early Five/ }))
    tick(600)
    const board = () => screen.getByRole('group', { name: 'Numbers called so far' }).querySelectorAll('.out').length
    const before = board()
    tick(30000)
    expect(board()).toBe(before)
  })

  it('a hint points at a called number you need, and counts as used', () => {
    const { numbers, ticket } = getSolution(lv)
    start()
    let call = 1
    while (!numbers.includes(lv.calls[call - 1])) { callNext(); call++ } // wait until a number you need is out
    fireEvent.click(screen.getByRole('button', { name: /Hint/ }))
    const hinted = document.querySelector('.tb-cell.hint')
    expect(hinted).toBeTruthy()
    expect(lv.calls.slice(0, call)).toContain(Number(hinted.textContent))
    expect(numbers).toContain(Number(hinted.textContent))
    expect(hinted.getAttribute('aria-label')).toContain(`Ticket ${ticket + 1}`)
    expect(readStats(getProgress('tambola')).hints).toBe(1)
  })
})

describe('Tambola against rivals', () => {
  it('lets a rival win the round when the player is too slow, then starts it again', () => {
    const level = 12 // has a rival
    progressStore('tambola').set(s => ({ ...s, level }))
    const rival = generateLevel(`tambola:L${level}`, { level })
    expect(rival.bots.length).toBeGreaterThan(0)
    render(<TambolaGame initialMode="solo" />)
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    const first = rival.bots.reduce((a, b) => (a.claimAt <= b.claimAt ? a : b))
    tick(1300)
    for (let i = 1; i < first.claimAt; i++) tick(rival.interval)
    expect(screen.getByRole('status').textContent).toContain(first.name)
    expect(lives()).toContain('2 of 3')
    tick(2600)
    expect(screen.getByRole('group', { name: 'Numbers called so far' }).querySelectorAll('.out')).toHaveLength(0)
  })
})
