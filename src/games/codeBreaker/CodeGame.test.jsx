// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import CodeGame from './CodeGame'
import { COLOR_NAMES, generateLevel } from './logic'
import { progressStore } from '../../platform/progress'

beforeEach(() => progressStore('code').set(() => ({
  level: 1, best: 0, stars: {}, highScore: 0, extraLives: 0, tutorialSeen: true,
  stats: { cleared: 0, flawless: 0, launches: 0, blocked: 0, bestCombo: 0, hints: 0 },
  achievements: {}, daily: { last: null, streak: 0, best: 0, history: {} },
})))
afterEach(() => { cleanup(); localStorage.clear() })

const board = () => screen.getByRole('group', { name: /Code Breaker/ })
const key = k => fireEvent.keyDown(board(), { key: k })
const goal = () => document.querySelector('.cb-goal').textContent
const msg = () => document.querySelector('.cb-msg').textContent
const lives = () => screen.getByRole('img', { name: /lives left/ }).getAttribute('aria-label')
const type = code => { code.forEach(c => key(String(c + 1))); key('Enter') }

async function start() {
  render(<CodeGame />)
  fireEvent.click(screen.getByRole('button', { name: /Play/ }))
  await screen.findByRole('group', { name: /Code Breaker/ })
}

/** A legal level-1 guess (no repeats) that isn't the code. */
const wrongGuess = p => {
  const g = [...p.code].reverse()
  return g.join() === p.code.join() ? [p.code[1], p.code[0], p.code[2]] : g
}

describe('Code Breaker end-to-end (level 1)', () => {
  it('scores a guess, then cracks the code with the keyboard', async () => {
    const p = generateLevel('code:L1', 1)
    await start()
    expect(goal()).toContain('Attempts left 7')
    type(wrongGuess(p))
    expect(goal()).toContain('Attempts left 6')
    expect(msg()).toMatch(/exact/)
    type(p.code)
    expect(msg()).toMatch(/Cracked it in 2 guesses/)
    await screen.findByText(/Level 1 cleared/)
  })

  it('clicking colours and spots builds a guess; Check needs every spot', async () => {
    const p = generateLevel('code:L1', 1)
    await start()
    const check = screen.getByRole('button', { name: /Check/ })
    fireEvent.click(screen.getByRole('button', { name: `red 1` }))
    expect(check.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /^Spot 1/ }))
    fireEvent.click(screen.getByRole('button', { name: /Clear/ }))
    expect(screen.getByRole('button', { name: /^Spot 1: empty/ })).toBeTruthy()
    p.code.forEach(c => fireEvent.click(screen.getByRole('button', { name: `${COLOR_NAMES[c]} ${c + 1}` })))
    expect(check.disabled).toBe(false)
    fireEvent.click(check)
    expect(msg()).toMatch(/Cracked it in 1 guess!/)
  })

  it('flags a ruled-out guess, undo refunds it, hint reveals a spot', async () => {
    const p = generateLevel('code:L1', 1)
    await start()
    const g = wrongGuess(p)
    type(g)
    type(g) // the same guess again: row 1's clue already rules it out
    expect(msg()).toMatch(/row 1’s clue already ruled it out/)
    expect(goal()).toContain('Attempts left 5')
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    expect(goal()).toContain('Attempts left 6')
    expect(document.querySelectorAll('.cb-row.refunded')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /Hint/ }))
    expect(msg()).toMatch(/Hint: spot 1 is/)
    expect(screen.getByRole('button', { name: /^Spot 1: .*revealed/ })).toBeTruthy()
  })

  it('running out of attempts costs a life and adds more rows', async () => {
    const p = generateLevel('code:L1', 1)
    await start()
    const g = wrongGuess(p)
    for (let i = 0; i < p.attempts; i++) type(g)
    expect(lives()).toMatch(/^2 of 3/)
    expect(goal()).toContain('Attempts left 3')
    expect(msg()).toMatch(/Out of attempts/)
  })
})
