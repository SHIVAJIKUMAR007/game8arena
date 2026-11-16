// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import SudokuGame from './SudokuGame'
import { generateLevel } from './logic'
import { progressStore } from '../../platform/progress'

beforeEach(() => progressStore('sudoku').set(() => ({
  level: 1, best: 0, stars: {}, highScore: 0, extraLives: 0, tutorialSeen: true,
  stats: { cleared: 0, flawless: 0, launches: 0, blocked: 0, bestCombo: 0, hints: 0 },
  achievements: {}, daily: { last: null, streak: 0, best: 0, history: {} },
})))
afterEach(() => { cleanup(); localStorage.clear() })

const board = () => screen.getByRole('group', { name: /Sudoku/ })
const lives = () => screen.getByRole('img', { name: /lives left/ }).getAttribute('aria-label')

async function start() {
  render(<SudokuGame />)
  fireEvent.click(screen.getByRole('button', { name: /Play/ }))
  await screen.findByRole('group', { name: /Sudoku/ })
}

describe('Sudoku end-to-end (level 1)', () => {
  it('rejects a wrong digit with a life, accepts right ones, and solves the grid', async () => {
    const p = generateLevel('sudoku:L1', 1)
    await start()
    const blanks = p.puzzle.map((n, i) => (n ? -1 : i)).filter(i => i >= 0)
    const cell = i => screen.getByRole('gridcell', { name: new RegExp(`^Row ${Math.floor(i / 9) + 1}, column ${(i % 9) + 1}:`) })

    // Wrong digit on the first blank cell.
    const first = blanks[0]
    fireEvent.click(cell(first))
    const wrong = (p.solution[first] % 9) + 1
    const before = lives()
    fireEvent.keyDown(board(), { key: String(wrong) })
    expect(lives()).not.toBe(before)
    expect(cell(first).textContent).toBe('')

    // Fill every blank cell correctly.
    for (const i of blanks) {
      fireEvent.click(cell(i))
      fireEvent.keyDown(board(), { key: String(p.solution[i]) })
    }
    await screen.findByText(/Level 1 cleared/)
  })
})
