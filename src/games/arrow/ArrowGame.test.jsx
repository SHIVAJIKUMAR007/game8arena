// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ArrowGame from './ArrowGame'
import { generateLevel, findBlocker } from './levelGenerator'
import { getProgress, progressStore } from '../../platform/progress'

beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} }
})
const fresh = (extra = {}) => progressStore('arrow').set(() => ({
  level: 1, best: 0, stars: {}, highScore: 0, extraLives: 0, tutorialSeen: true,
  stats: { cleared: 0, flawless: 0, launches: 0, blocked: 0, bestCombo: 0, hints: 0 },
  achievements: {}, daily: { last: null, streak: 0, best: 0, history: {} }, ...extra,
}))
beforeEach(() => fresh())
afterEach(() => { cleanup(); localStorage.clear() })

const headOf = a => a.cells[a.cells.length - 1]
const labelFor = a => new RegExp(`head at row ${headOf(a).y + 1}, column ${headOf(a).x + 1}$`)
const arrowEl = a => screen.getByRole('button', { name: labelFor(a) })

describe('Arrow Escape end-to-end (level 1)', () => {
  it('loses a life when blocked, and wins when cleared in a safe order', async () => {
    const lv = generateLevel({ level: 1, seed: 'arrow:L1' })
    render(<ArrowGame />)
    fireEvent.click(screen.getByRole('button', { name: /Play/ }))
    await screen.findByRole('group', { name: /Arrow board/ })
    expect(screen.getAllByRole('button', { name: /^Arrow pointing/ })).toHaveLength(lv.arrows.length)

    // A blocked arrow costs one life.
    const blocked = lv.arrows.find(a => findBlocker(a, lv.arrows, lv.cols, lv.rows))
    expect(blocked).toBeTruthy()
    fireEvent.click(arrowEl(blocked))
    await screen.findByRole('img', { name: '2 of 3 lives left' })

    // Undo gives the life back.
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    await screen.findByRole('img', { name: '3 of 3 lives left' })

    // The shaken arrow ignores taps for a moment; wait for it to settle.
    await waitFor(() => expect(arrowEl(blocked).getAttribute('class')).not.toMatch(/blocked/), { timeout: 2000 })

    // Solve in a safe order.
    let left = [...lv.arrows]
    while (left.length) {
      const next = left.find(a => !findBlocker(a, left, lv.cols, lv.rows))
      fireEvent.click(arrowEl(next))
      left = left.filter(a => a !== next)
    }
    await screen.findByRole('heading', { name: /Level 1 cleared/ }, { timeout: 5000 })

    // Progress was saved: 3 stars, next level unlocked.
    const p = getProgress('arrow')
    expect(p.best).toBe(1)
    expect(p.level).toBe(2)
    expect(p.stars[1]).toBe(3)
    expect(p.extraLives).toBe(1) // flawless clear banks an extra life
    await waitFor(() => expect(screen.queryAllByRole('button', { name: /^Arrow pointing/ })).toHaveLength(0))
  }, 15000)

  it('ends the level after 3 blocked taps and offers an extra life', async () => {
    const lv = generateLevel({ level: 1, seed: 'arrow:L1' })
    fresh({ extraLives: 1 })
    render(<ArrowGame />)
    fireEvent.click(screen.getByRole('button', { name: /Play/ }))
    await screen.findByRole('group', { name: /Arrow board/ })
    const blocked = lv.arrows.find(a => findBlocker(a, lv.arrows, lv.cols, lv.rows))
    for (let i = 0; i < 3; i++) {
      fireEvent.click(arrowEl(blocked))
      await waitFor(() => expect(arrowEl(blocked).getAttribute('class')).not.toMatch(/blocked/), { timeout: 2000 })
    }
    await screen.findByRole("heading", { name: /Out of lives/ }, { timeout: 3000 })
    fireEvent.click(screen.getByRole('button', { name: /Use extra life/ }))
    await screen.findByRole('img', { name: '1 of 3 lives left' })
  }, 15000)
})
