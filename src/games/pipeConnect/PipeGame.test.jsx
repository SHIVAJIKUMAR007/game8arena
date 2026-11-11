// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import PipeGame from './PipeGame'
import { generateLevel, isFixed, timeFor, turnsToSolve } from './logic'
import { progressStore } from '../../platform/progress'

beforeEach(() => progressStore('pipe').set(() => ({
  level: 1, best: 0, stars: {}, highScore: 0, extraLives: 0, tutorialSeen: true,
  stats: { cleared: 0, flawless: 0, launches: 0, blocked: 0, bestCombo: 0, hints: 0 },
  achievements: {}, daily: { last: null, streak: 0, best: 0, history: {} },
})))
afterEach(() => { vi.useRealTimers(); cleanup(); localStorage.clear() })

const grid = () => screen.getByRole('application')
const key = (k, opts = {}) => fireEvent.keyDown(grid(), { key: k, ...opts })
const goal = () => document.querySelector('.pc-goal').textContent
const msg = () => document.querySelector('.pc-msg').textContent
const lives = () => screen.getByRole('img', { name: /lives left/ }).getAttribute('aria-label')

function walk(n, a, b) {
  const [ar, ac, br, bc] = [Math.floor(a / n), a % n, Math.floor(b / n), b % n]
  for (let r = ar; r !== br; r += Math.sign(br - ar)) key(br > ar ? 'ArrowDown' : 'ArrowUp')
  for (let c = ac; c !== bc; c += Math.sign(bc - ac)) key(bc > ac ? 'ArrowRight' : 'ArrowLeft')
}

async function start() {
  render(<PipeGame />)
  fireEvent.click(screen.getByRole('button', { name: /Play/ }))
  await screen.findByRole('application', { name: /Pipe Connect/ })
}

describe('Pipe Connect end-to-end (level 1)', () => {
  it('turns every route pipe into place with the keyboard and clears the level', async () => {
    const p = generateLevel('pipe:L1', 1)
    await start()
    let cursor = p.source
    for (const cell of p.path) {
      if (isFixed(p, cell)) continue
      walk(p.n, cursor, cell)
      cursor = cell
      for (let t = turnsToSolve(p, p.start, cell); t > 0; t--) key(' ')
    }
    expect(goal()).toContain('Drains 1/1')
    await screen.findByText(/Level 1 cleared/)
  })

  it('Shift+Space turns back, undo restores, hint fixes a piece, fixed pieces refuse to turn', async () => {
    const p = generateLevel('pipe:L1', 1)
    await start()
    key(' ') // cursor starts on the source
    expect(goal()).toContain('Turns 0')
    expect(msg()).toMatch(/source can’t turn/)
    const cell = p.path.find(i => !isFixed(p, i))
    walk(p.n, p.source, cell)
    key(' ')
    key(' ', { shiftKey: true })
    expect(goal()).toContain('Turns 2')
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    fireEvent.click(screen.getByRole('button', { name: /Hint/ }))
    expect(msg()).toMatch(/Hint: the piece/)
    expect(document.querySelectorAll('.pc-cell.pinned')).toHaveLength(1)
  })

  it('the clock waits for the first turn, then costs a life when it runs out', async () => {
    const p = generateLevel('pipe:L1', 1)
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await start()
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(lives()).toMatch(/^3 of 3/)
    const cell = p.path.find(i => !isFixed(p, i))
    walk(p.n, p.source, cell)
    key(' ')
    act(() => { vi.advanceTimersByTime(timeFor(p, 1) * 1000 + 500) })
    expect(lives()).toMatch(/^2 of 3/)
    expect(msg()).toMatch(/Time’s up/)
  })
})
