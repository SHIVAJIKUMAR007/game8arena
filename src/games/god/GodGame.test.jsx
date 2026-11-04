// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import GodGame from './GodGame'
import { generateLevel } from './logic'
import { progressStore } from '../../platform/progress'

beforeEach(() => progressStore('god').set(() => ({
  level: 1, best: 0, stars: {}, highScore: 0, extraLives: 0, tutorialSeen: true,
  stats: { cleared: 0, flawless: 0, launches: 0, blocked: 0, bestCombo: 0, hints: 0 },
  achievements: {}, daily: { last: null, streak: 0, best: 0, history: {} },
})))
afterEach(() => { cleanup(); localStorage.clear() })

const cells = () => screen.getAllByRole('gridcell')
const tap = el => fireEvent.click(el, { detail: 1 })
const doubleTap = el => { tap(el); tap(el) }

describe('Find God end-to-end (level 1)', () => {
  it('discards on tap, costs a life on a wrong search, wins on the right god', async () => {
    const p = generateLevel('god:L1', 1)
    render(<GodGame />)
    fireEvent.click(screen.getByRole('button', { name: /Play/ }))
    await screen.findByRole('grid', { name: /5 by 5/ })
    expect(cells()).toHaveLength(25)
    await waitFor(() => expect(document.querySelector('.lg-info').textContent).toContain(`Seeking: ${p.gods[p.target].icon} ${p.gods[p.target].name}`))

    // Single tap toggles a discard mark; undo removes it.
    const empty = p.regions.findIndex((g, i) => p.solution[g] !== i)
    tap(cells()[empty])
    expect(cells()[empty].getAttribute('aria-label')).toMatch(/discarded/)
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    expect(cells()[empty].getAttribute('aria-label')).not.toMatch(/discarded/)

    // Double-tap on an empty cell: wrong search, one life lost, no mark left behind.
    doubleTap(cells()[empty])
    await screen.findByRole('img', { name: '2 of 3 lives left' })
    expect(cells()[empty].getAttribute('aria-label')).toMatch(/searched, empty/)

    // Double-tap the requested god's cell: level cleared.
    doubleTap(cells()[p.solution[p.target]])
    await screen.findByText(/Level 1 cleared/)
  })

  it('a hint marks a safe cell', async () => {
    const p = generateLevel('god:L1', 1)
    render(<GodGame />)
    fireEvent.click(screen.getByRole('button', { name: /Play/ }))
    await screen.findByRole('grid')
    fireEvent.click(screen.getByRole('button', { name: /Hint/ }))
    const marked = cells().map((c, i) => [c, i]).filter(([c]) => /discarded/.test(c.getAttribute('aria-label')))
    const glowing = cells().findIndex(c => c.className.includes('glow-hint'))
    expect(glowing).toBeGreaterThanOrEqual(0)
    if (marked.length) expect(p.solution[p.regions[marked[0][1]]]).not.toBe(marked[0][1])
    else expect(p.solution[p.regions[glowing]]).toBe(glowing)
  })
})
