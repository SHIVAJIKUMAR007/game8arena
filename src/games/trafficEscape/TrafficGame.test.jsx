// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import TrafficGame from './TrafficGame'
import { levelFor, solve } from './logic'
import { progressStore } from '../../platform/progress'

beforeEach(() => progressStore('traffic').set(() => ({
  level: 1, best: 0, stars: {}, highScore: 0, extraLives: 0, tutorialSeen: true,
  stats: { cleared: 0, flawless: 0, launches: 0, blocked: 0, bestCombo: 0, hints: 0 },
  achievements: {}, daily: { last: null, streak: 0, best: 0, history: {} },
})))
afterEach(() => { cleanup(); localStorage.clear() })

const cars = () => document.querySelectorAll('.tr-car')
const goal = () => document.querySelector('.tr-goal').textContent

/** Slide car k from `from` to `to` with the keyboard, one square per key press. */
function slide(p, k, from, to) {
  const key = p.cars[k].horiz ? (to > from ? 'ArrowRight' : 'ArrowLeft') : (to > from ? 'ArrowDown' : 'ArrowUp')
  for (let i = 0; i < Math.abs(to - from); i++) fireEvent.keyDown(cars()[k], { key })
}

async function start() {
  render(<TrafficGame />)
  fireEvent.click(screen.getByRole('button', { name: /Play/ }))
  await screen.findByRole('group', { name: /Parking lot/ })
}

describe('Traffic Escape end-to-end (level 1)', () => {
  it('plays the shortest solution with the keyboard, at par, and clears the level', async () => {
    const p = levelFor(1)
    await start()
    expect(cars()).toHaveLength(p.cars.length)
    const state = p.start.slice()
    for (const { car, to } of solve(p, p.start)) { slide(p, car, state[car], to); state[car] = to }
    expect(goal()).toContain(`Moves ${p.par}`)
    await screen.findByText(/Level 1 cleared/)
  })

  it('sliding a car back where it started is not a move; undo keeps the count; hint marks a car', async () => {
    const p = levelFor(1)
    await start()
    const { car, to } = solve(p, p.start)[0]
    slide(p, car, p.start[car], to)
    expect(goal()).toContain('Moves 1')
    slide(p, car, to, p.start[car])
    expect(goal()).toContain('Moves 0')
    slide(p, car, p.start[car], to)
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    expect(goal()).toContain('Moves 1')
    fireEvent.click(screen.getByRole('button', { name: /Hint/ }))
    expect(document.querySelector('.tr-car.hint')).not.toBeNull()
    expect(document.querySelector('.tr-ghost')).not.toBeNull()
  })
})
