// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import MemoryGame from './MemoryGame'
import { PADS, paramsFor, sequenceFor } from './logic'
import { progressStore } from '../../platform/progress'

beforeEach(() => {
  vi.useFakeTimers()
  progressStore('memory').set(() => ({
    level: 1, best: 0, stars: {}, highScore: 0, extraLives: 0, tutorialSeen: true,
    stats: { cleared: 0, flawless: 0, launches: 0, blocked: 0, bestCombo: 0, hints: 0 },
    achievements: {}, daily: { last: null, streak: 0, best: 0, history: {} },
  }))
})
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear() })

const prm = paramsFor(1)
const seq = sequenceFor('memory:L1', prm.target, prm.pads)
const pad = n => screen.getByRole('button', { name: new RegExp(`^${PADS[n].name} `) })
const tap = n => act(() => { fireEvent.pointerDown(pad(n)) })
const wait = ms => act(() => { vi.advanceTimersByTime(ms) })
/** Long enough for any playback of level 1 to finish. */
const watch = () => wait(800 + prm.target * (prm.flash + prm.gap) + 1200)

async function start() {
  render(<MemoryGame />)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Play/ })) })
  await act(async () => { await vi.dynamicImportSettled?.() })
}

describe('Memory Sequence end-to-end (level 1)', () => {
  it('repeating every round up to the target clears the level', async () => {
    await start()
    for (let n = prm.start; n <= prm.target; n++) {
      watch()
      expect(document.querySelector('.ms-status').textContent).toMatch(/Your turn/)
      for (let i = 0; i < n; i++) tap(seq[i])
    }
    wait(1000)
    expect(screen.getByText(/Level 1 cleared/)).toBeTruthy()
  })

  it('taps during playback are ignored; a wrong tap costs a life; undo gives it back', async () => {
    await start()
    wait(750) // playback has started
    tap((seq[0] + 1) % prm.pads)
    expect(screen.getByRole('img', { name: '3 of 3 lives left' })).toBeTruthy()

    watch()
    tap((seq[0] + 1) % prm.pads)
    expect(screen.getByRole('img', { name: '2 of 3 lives left' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    expect(screen.getByRole('img', { name: '3 of 3 lives left' })).toBeTruthy()
    expect(document.querySelector('.ms-status').textContent).toMatch(/Mistake undone/)

    fireEvent.click(screen.getByRole('button', { name: /Hint/ }))
    expect(pad(seq[0]).className).toContain('hint')
    tap(seq[0])
    expect(document.querySelector('.ms-status').textContent).toMatch(/Correct/)
  })
})
