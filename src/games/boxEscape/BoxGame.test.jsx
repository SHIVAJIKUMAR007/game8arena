// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import BoxGame from './BoxGame'
import { generateLevel, pushesToMoves, solve } from './logic'
import { progressStore } from '../../platform/progress'

beforeEach(() => progressStore('box').set(() => ({
  level: 1, best: 0, stars: {}, highScore: 0, extraLives: 0, tutorialSeen: true,
  stats: { cleared: 0, flawless: 0, launches: 0, blocked: 0, bestCombo: 0, hints: 0 },
  achievements: {}, daily: { last: null, streak: 0, best: 0, history: {} },
})))
afterEach(() => { cleanup(); localStorage.clear() })

const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }
const press = dir => fireEvent.keyDown(window, { key: KEY[dir] })

async function start() {
  render(<BoxGame />)
  fireEvent.click(screen.getByRole('button', { name: /Play/ }))
  return screen.findByRole('grid', { name: /Warehouse/ })
}

describe('Box Escape end-to-end (level 1)', () => {
  it('plays the shortest solution with the keyboard and clears the level', async () => {
    const p = generateLevel('box:L1', 1)
    await start()
    await waitFor(() => expect(document.querySelector('.lg-info').textContent).toContain('Crates: 0/1'))
    const moves = pushesToMoves(p, p.player, p.boxes, solve(p, p.player, p.boxes))
    moves.forEach(press)
    expect(document.querySelector('.bx-goal').textContent).toContain(`Pushes ${p.par}`)
    await screen.findByText(/Level 1 cleared/)
  })

  it('undo takes back a push and hint highlights a crate', async () => {
    const p = generateLevel('box:L1', 1)
    await start()
    const pushes = solve(p, p.player, p.boxes)
    const moves = pushesToMoves(p, p.player, p.boxes, pushes.slice(0, 1))
    moves.forEach(press)
    expect(document.querySelector('.bx-goal').textContent).toContain('Pushes 1')
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    expect(document.querySelector('.bx-goal').textContent).toContain('Pushes 0')
    fireEvent.click(screen.getByRole('button', { name: /Hint/ }))
    expect(document.querySelector('.bx-crate.hint')).not.toBeNull()
  })
})
