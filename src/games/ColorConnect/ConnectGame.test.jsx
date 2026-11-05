// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ConnectGame from './ConnectGame'
import { generateLevel } from './logic'
import { progressStore } from '../../platform/progress'

beforeEach(() => progressStore('connect').set(() => ({
  level: 1, best: 0, stars: {}, highScore: 0, extraLives: 0, tutorialSeen: true,
  stats: { cleared: 0, flawless: 0, launches: 0, blocked: 0, bestCombo: 0, hints: 0 },
  achievements: {}, daily: { last: null, streak: 0, best: 0, history: {} },
})))
afterEach(() => { cleanup(); localStorage.clear() })

const grid = () => screen.getByRole('application')
const key = k => fireEvent.keyDown(grid(), { key: k })
const goal = () => document.querySelector('.cc-goal').textContent

/** Arrow keys from cell a to neighbouring/any cell b (cursor moves freely when nothing is held). */
function walk(n, a, b) {
  const [ar, ac, br, bc] = [Math.floor(a / n), a % n, Math.floor(b / n), b % n]
  for (let r = ar; r !== br; r += Math.sign(br - ar)) key(br > ar ? 'ArrowDown' : 'ArrowUp')
  for (let c = ac; c !== bc; c += Math.sign(bc - ac)) key(bc > ac ? 'ArrowRight' : 'ArrowLeft')
}

async function start() {
  render(<ConnectGame />)
  fireEvent.click(screen.getByRole('button', { name: /Play/ }))
  await screen.findByRole('application', { name: /Color Connect/ })
}

describe('Color Connect end-to-end (level 1)', () => {
  it('draws every solution pipe with the keyboard and clears the level in perfect moves', async () => {
    const p = generateLevel('connect:L1', 1)
    await start()
    let cursor = p.dots[0][0]
    for (const path of p.solution) {
      walk(p.n, cursor, path[0])
      key(' ')
      for (let i = 1; i < path.length; i++) walk(p.n, path[i - 1], path[i])
      cursor = path.at(-1)
    }
    expect(goal()).toContain(`Flows ${p.dots.length}/${p.dots.length}`)
    expect(goal()).toContain('Filled 100%')
    expect(goal()).toContain(`Moves ${p.dots.length}`)
    await screen.findByText(/Level 1 cleared/)
  })

  it('undo removes a stroke and hint draws a pipe', async () => {
    const p = generateLevel('connect:L1', 1)
    await start()
    const path = p.solution[0]
    key(' ')
    for (let i = 1; i < path.length; i++) walk(p.n, path[i - 1], path[i])
    expect(goal()).toContain('Flows 1/')
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    expect(goal()).toContain('Flows 0/')
    fireEvent.click(screen.getByRole('button', { name: /Hint/ }))
    expect(goal()).toContain('Flows 1/')
    expect(document.querySelectorAll('.cc-pipe')).toHaveLength(1)
  })
})
