// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import MinesweeperGame from './MinesweeperGame'
import { generatePuzzle, makeSetup } from './levels'
import { getProgress, progressStore } from '../../platform/progress'
import { settingsStore } from '../../platform/settings'
import { todayKey } from '../../platform/daily'

const fresh = () => ({
  level: 1, best: 0, stars: {}, highScore: 0, extraLives: 0, tutorialSeen: true,
  stats: { cleared: 0, flawless: 0, launches: 0, blocked: 0, bestCombo: 0, hints: 0 },
  achievements: {}, daily: { last: null, streak: 0, best: 0, history: {} },
})

beforeEach(() => {
  progressStore('minesweeper').set(fresh)
  settingsStore.set(s => ({ ...s, motion: 'reduce', sound: false, haptics: false })) // instant results, silent tests
})
afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers() })

const grid = () => screen.getByRole('grid')
const cell = i => grid().querySelector(`[data-i="${i}"]`)
const isClosed = i => /\b(hidden|flag)\b/.test(cell(i).className)
const counter = () => screen.getByRole('img', { name: /mines left/ }).textContent

async function startLevels() {
  render(<MinesweeperGame />)
  fireEvent.click(screen.getByRole('button', { name: /Play|Continue/ }))
  await screen.findByRole('grid')
}

/** Opens every safe cell of a generated puzzle, starting with its first-click cell. */
function clearBoard(puzzle) {
  fireEvent.click(cell(puzzle.firstIdx))
  for (let i = 0; i < puzzle.w * puzzle.h; i++) {
    if (!puzzle.mines[i] && cell(i).className.includes('hidden')) fireEvent.click(cell(i))
  }
}

describe('Minesweeper end-to-end', () => {
  it('shows a closed board with the mine count, a timer and the difficulty', async () => {
    await startLevels()
    const p = generatePuzzle(makeSetup('campaign', { level: 1 }))
    expect(screen.getAllByRole('gridcell')).toHaveLength(p.w * p.h)
    expect(counter()).toBe(String(p.mineCount).padStart(3, '0'))
    expect(screen.getByRole('timer').textContent).toBe('000')
    expect(screen.getByText(/Difficulty: Gentle/)).toBeTruthy()
    expect(screen.getByText('Level 1')).toBeTruthy()
  })

  it('the board does not give mines away before the game ends', async () => {
    await startLevels()
    const p = generatePuzzle(makeSetup('campaign', { level: 1 }))
    fireEvent.click(cell(p.firstIdx))
    const labels = screen.getAllByRole('gridcell').map(c => c.getAttribute('aria-label')).join('|')
    expect(labels).not.toMatch(/mine:|exploded|wrong flag/)
    expect(grid().textContent).not.toMatch(/💣|💥/)
    expect(grid().innerHTML).not.toMatch(/data-mine/)
  })

  it('opens the glowing start cell safely and flood-fills from it', async () => {
    await startLevels()
    const p = generatePuzzle(makeSetup('campaign', { level: 1 }))
    expect(cell(p.start).className).toContain('start')
    fireEvent.click(cell(p.firstIdx))
    expect(cell(p.firstIdx).className).toContain('open')
    expect(cell(p.firstIdx).className).not.toContain('mine')
    expect(cell(p.firstIdx).className).not.toContain('start')
    expect(screen.getAllByRole('gridcell').filter(c => c.className.includes('open')).length).toBeGreaterThan(1)
  })

  it('wins by opening every safe cell, and saves level, stars, score and statistics', async () => {
    await startLevels()
    const p = generatePuzzle(makeSetup('campaign', { level: 1 }))
    clearBoard(p)
    const result = await screen.findByRole('dialog', { name: 'Board cleared' })
    expect(result.textContent).toMatch(/Time/)
    const saved = getProgress('minesweeper')
    expect(saved.level).toBe(2)
    expect(saved.best).toBe(1)
    expect(saved.stars[1]).toBe(3) // no hints, well under par
    expect(saved.highScore).toBeGreaterThan(0)
    expect(saved.msStats).toMatchObject({ played: 1, won: 1, streak: 1 })
    expect(saved.msStats.modes.level.times).toHaveLength(1)
    expect(saved.msSaves.campaign).toBeNull()
    expect(screen.getByRole('img', { name: /3 of 3 stars/ })).toBeTruthy()
    // After a win the face is cool and the counter reads zero.
    expect(screen.getByRole('button', { name: 'Restart' }).textContent).toBe('😎')
    expect(counter()).toBe('000')
    fireEvent.click(screen.getByRole('button', { name: /Next level/ }))
    expect(screen.getByText('Level 2')).toBeTruthy()
  })

  it('opening a mine loses: shows every mine and the wrong flags, and records the loss without advancing', async () => {
    await startLevels()
    const p = generatePuzzle(makeSetup('campaign', { level: 1 }))
    fireEvent.click(cell(p.firstIdx))
    const mine = Array.from(p.mines, (m, i) => (m ? i : -1)).filter(i => i >= 0)
    const safeClosed = Array.from(p.mines, (m, i) => (!m && cell(i).className.includes('hidden') ? i : -1)).find(i => i >= 0)
    fireEvent.contextMenu(cell(safeClosed)) // a wrong flag
    fireEvent.click(cell(mine[0]))
    const result = await screen.findByRole('dialog', { name: 'You hit a mine' })
    expect(result.textContent).toMatch(/mine/)
    fireEvent.click(screen.getByRole('button', { name: 'See board' }))
    expect(cell(mine[0]).className).toContain('boom')
    mine.slice(1).forEach(i => expect(cell(i).className).toContain('mine'))
    expect(cell(safeClosed).getAttribute('aria-label')).toMatch(/wrong flag/)
    expect(screen.getByRole('button', { name: 'Restart' }).textContent).toBe('😵')
    const saved = getProgress('minesweeper')
    expect(saved.level).toBe(1)
    expect(saved.msStats).toMatchObject({ played: 1, won: 0, streak: 0 })
    expect(saved.msSaves.campaign).toBeNull()
  })

  it('right-click flags and unflags, and the counter follows', async () => {
    await startLevels()
    const before = Number(counter())
    fireEvent.contextMenu(cell(0))
    expect(cell(0).getAttribute('aria-label')).toMatch(/flagged/)
    expect(Number(counter())).toBe(before - 1)
    fireEvent.click(cell(0)) // a flagged cell ignores a normal click
    expect(cell(0).getAttribute('aria-label')).toMatch(/flagged/)
    fireEvent.contextMenu(cell(0))
    expect(cell(0).getAttribute('aria-label')).toMatch(/closed/)
    expect(Number(counter())).toBe(before)
  })

  it('flag mode turns taps into flags for touch screens', async () => {
    await startLevels()
    const toggle = screen.getByRole('button', { name: /Dig mode/ })
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(cell(3))
    expect(cell(3).getAttribute('aria-label')).toMatch(/flagged/)
    fireEvent.click(cell(3))
    expect(cell(3).getAttribute('aria-label')).toMatch(/closed/)
  })

  it('a long press flags, and the tap that ends it does not also open the cell', async () => {
    vi.useFakeTimers()
    await act(async () => { render(<MinesweeperGame />) })
    fireEvent.click(screen.getByRole('button', { name: /Play/ }))
    const c = cell(5)
    // jsdom may not carry pointerType through; define it so the touch path is exercised either way.
    const down = new Event('pointerdown', { bubbles: true })
    Object.defineProperty(down, 'pointerType', { value: 'touch' })
    act(() => { c.dispatchEvent(down) })
    act(() => { vi.advanceTimersByTime(500) })
    expect(c.getAttribute('aria-label')).toMatch(/flagged/)
    fireEvent.click(c)
    expect(c.getAttribute('aria-label')).toMatch(/flagged/) // still flagged, not opened
  })

  it('a quick tap on touch opens the cell instead of flagging it', async () => {
    vi.useFakeTimers()
    await act(async () => { render(<MinesweeperGame />) })
    fireEvent.click(screen.getByRole('button', { name: /Play/ }))
    const p = generatePuzzle(makeSetup('campaign', { level: 1 }))
    const c = cell(p.firstIdx)
    const down = new Event('pointerdown', { bubbles: true })
    Object.defineProperty(down, 'pointerType', { value: 'touch' })
    act(() => { c.dispatchEvent(down) })
    act(() => { c.dispatchEvent(new Event('pointerup', { bubbles: true })) })
    fireEvent.click(c)
    act(() => { vi.advanceTimersByTime(500) })
    expect(c.className).toContain('open')
  })

  it('keyboard: arrows move, Space opens, F flags', async () => {
    await startLevels()
    const p = generatePuzzle(makeSetup('campaign', { level: 1 }))
    const start = cell(p.start)
    start.focus()
    fireEvent.keyDown(start, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(cell(p.start + 1))
    fireEvent.keyDown(document.activeElement, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(cell(p.start))
    fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(cell(p.start - p.w))
    fireEvent.keyDown(document.activeElement, { key: 'f' })
    expect(cell(p.start - p.w).getAttribute('aria-label')).toMatch(/flagged/)
  })

  it('the first hint on a fresh board points at the start cell and costs nothing', async () => {
    await startLevels()
    fireEvent.click(screen.getByRole('button', { name: /Hint, 3 left/ }))
    expect(screen.getByRole('button', { name: /Hint, 3 left/ })).toBeTruthy()
    expect(document.querySelector('.ms-msg').textContent).toMatch(/glowing square/)
  })

  it('a hint during play points at a certain square and uses one hint, which costs a star', async () => {
    await startLevels()
    const p = generatePuzzle(makeSetup('campaign', { level: 1 }))
    fireEvent.click(cell(p.firstIdx))
    fireEvent.click(screen.getByRole('button', { name: /Hint, 3 left/ }))
    expect(screen.getByRole('button', { name: /Hint, 2 left/ })).toBeTruthy()
    const hinted = document.querySelector('.hint-safe, .hint-mine')
    expect(hinted).toBeTruthy()
    const i = Number(hinted.dataset.i)
    expect(p.mines[i]).toBe(hinted.className.includes('hint-mine') ? 1 : 0)
    expect(document.querySelector('.ms-msg').textContent).toMatch(/safe|mine/i)
    clearBoard(p)
    await screen.findByRole('dialog', { name: 'Board cleared' })
    expect(getProgress('minesweeper').stars[1]).toBe(2)
  })

  it('pause hides the board and stops play; resume brings it back', async () => {
    await startLevels()
    const p = generatePuzzle(makeSetup('campaign', { level: 1 }))
    expect(screen.getByRole('button', { name: /Pause/ }).disabled).toBe(true) // nothing to pause before the first click
    fireEvent.click(cell(p.firstIdx))
    fireEvent.click(screen.getByRole('button', { name: /Pause/ }))
    expect(screen.getByText('Paused')).toBeTruthy()
    const closedBefore = screen.getAllByRole('gridcell').filter(c => c.className.includes('hidden')).length
    fireEvent.click(cell(0)) // ignored while paused
    expect(screen.getAllByRole('gridcell').filter(c => c.className.includes('hidden')).length).toBe(closedBefore)
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(screen.queryByText('Paused')).toBeNull()
  })

  it('resumes a game in progress after a reload, with its flags', async () => {
    await startLevels()
    const p = generatePuzzle(makeSetup('campaign', { level: 1 }))
    fireEvent.click(cell(p.firstIdx))
    const open = screen.getAllByRole('gridcell').filter(c => c.className.includes('open')).length
    const closed = Array.from({ length: p.w * p.h }, (_, i) => i).find(i => isClosed(i))
    fireEvent.contextMenu(cell(closed))
    cleanup() // the page is closed
    render(<MinesweeperGame />)
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    await screen.findByRole('grid')
    expect(screen.getAllByRole('gridcell').filter(c => c.className.includes('open')).length).toBe(open)
    expect(cell(closed).getAttribute('aria-label')).toMatch(/flagged/)
  })

  it('restart (the face) gives a fresh board and the old game is not brought back', async () => {
    await startLevels()
    const p = generatePuzzle(makeSetup('campaign', { level: 1 }))
    fireEvent.click(cell(p.firstIdx))
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    expect(screen.getAllByRole('gridcell').every(c => c.className.includes('hidden'))).toBe(true)
    expect(screen.getByRole('timer').textContent).toBe('000')
    expect(getProgress('minesweeper').msSaves?.campaign ?? null).toBeNull()
  })

  it('ignores a corrupted save instead of crashing', async () => {
    progressStore('minesweeper').set(p => ({ ...p, msSaves: { campaign: { key: 'L1', firstIdx: 'bad', revealed: 'x' }, classic: 42 }, msStats: 'oops' }))
    await startLevels()
    expect(screen.getAllByRole('gridcell').every(c => c.className.includes('hidden'))).toBe(true)
    // A save that parses but doesn't fit the board (a mine listed as open) is dropped too.
    const p = generatePuzzle(makeSetup('campaign', { level: 1 }))
    const mine = Array.from(p.mines).findIndex(m => m)
    cleanup()
    progressStore('minesweeper').set(s => ({ ...s, msSaves: { campaign: { key: 'L1', mode: 'campaign', seed: 'x', firstIdx: p.firstIdx, revealed: [p.firstIdx, mine], flags: [], elapsed: 5, hints: 0 } } }))
    await startLevels()
    expect(screen.getAllByRole('gridcell').every(c => c.className.includes('hidden'))).toBe(true)
  })

  it('classic Beginner: starts a 9×9 board, records a best time, and offers a new board', async () => {
    render(<MinesweeperGame />)
    fireEvent.click(screen.getByRole('button', { name: /Beginner/ }))
    await screen.findByRole('grid')
    expect(screen.getAllByRole('gridcell')).toHaveLength(81)
    expect(counter()).toBe('010')
    fireEvent.click(cell(40))
    // The board comes from the seed saved with the game; rebuild it to know where the mines are.
    const save = getProgress('minesweeper').msSaves.classic
    expect(save.firstIdx).toBe(40)
    const p = generatePuzzle(makeSetup('beginner', { seed: save.seed }), save.firstIdx)
    for (let i = 0; i < 81; i++) if (!p.mines[i] && cell(i).className.includes('hidden')) fireEvent.click(cell(i))
    await screen.findByRole('dialog', { name: 'Board cleared' })
    const stats = getProgress('minesweeper').msStats
    expect(stats.modes.beginner).toMatchObject({ played: 1, won: 1 })
    expect(stats.modes.beginner.times).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'New board' }).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByText(/best \d+:\d\d/)).toBeTruthy()
  }, 30000)

  it('classic Expert is 30×16 with 99 mines', async () => {
    render(<MinesweeperGame />)
    fireEvent.click(screen.getByRole('button', { name: /Expert/ }))
    await screen.findByRole('grid')
    expect(screen.getAllByRole('gridcell')).toHaveLength(480)
    expect(counter()).toBe('099')
  })

  it('the daily board is today’s board, counts once, and is marked done afterwards', async () => {
    render(<MinesweeperGame initialMode="daily" />)
    await screen.findByText('Daily board')
    const p = generatePuzzle(makeSetup('daily', { date: todayKey() }))
    clearBoard(p)
    await screen.findByRole('dialog', { name: 'Board cleared' })
    const saved = getProgress('minesweeper')
    expect(saved.daily.last).toBe(todayKey())
    expect(saved.level).toBe(1) // the daily doesn't move the level on
    expect(saved.msStats.modes.daily.won).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('button', { name: /Daily board ✓/ })).toBeTruthy()
    // Playing it again is practice: it doesn't change today's recorded result.
    const score = saved.daily.history[todayKey()].score
    fireEvent.click(screen.getByRole('button', { name: /Daily board/ }))
    await screen.findByRole('grid')
    clearBoard(p)
    const again = await screen.findByRole('dialog', { name: 'Board cleared' })
    expect(again.textContent).toMatch(/practice/)
    expect(getProgress('minesweeper').daily.history[todayKey()].score).toBe(score)
  }, 30000)

  it('the level map unlocks levels as you win', async () => {
    progressStore('minesweeper').set(p => ({ ...p, level: 4, best: 3, stars: { 1: 3, 2: 2, 3: 1 } }))
    render(<MinesweeperGame />)
    fireEvent.click(screen.getByRole('button', { name: /Level map/ }))
    expect(screen.getByRole('button', { name: /Level 3, 1 stars/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Level 5, locked/ }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Level 4,/ }))
    await screen.findByRole('grid')
    expect(screen.getByText('Level 4')).toBeTruthy()
  })

  it('statistics show games played, win rate, streaks and best times', async () => {
    progressStore('minesweeper').set(p => ({
      ...p,
      msStats: { played: 4, won: 3, streak: 2, maxStreak: 2, totalTime: 180, modes: { beginner: { played: 4, won: 3, times: [31, 55, 70] } } },
    }))
    render(<MinesweeperGame />)
    fireEvent.click(screen.getByRole('button', { name: /Statistics/ }))
    const dialog = screen.getByRole('dialog', { name: 'Statistics' })
    const value = name => [...dialog.querySelectorAll('dt')].find(d => d.textContent === name).nextSibling.textContent
    expect(value('Played')).toBe('4')
    expect(value('Win %')).toBe('75')
    expect(value('Current streak')).toBe('2')
    expect(value('Avg win time')).toBe('1:00')
    expect(within(dialog).getByText('0:31 · 0:55 · 1:10')).toBeTruthy()
  })
})
