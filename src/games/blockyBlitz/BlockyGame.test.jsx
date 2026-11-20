// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import BlockyGame from './BlockyGame'
import { emptyBoard, serializeState } from './logic'
import { COLORS } from './pieces'
import { blockyStore } from './store'
import { progressStore } from '../../platform/progress'

beforeEach(() => {
  blockyStore.set({ theme: 0, save: null })
  progressStore('blocky').set(s => ({ ...s, highScore: 0, best: 0 }))
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

const pieces = () => screen.getAllByRole('button', { name: /^Piece \d of 3/ })
const savedGame = over => ({
  board: emptyBoard(),
  tray: [{ id: 'dot', color: COLORS[0] }, { id: 'h2', color: COLORS[1] }, { id: 'v2', color: COLORS[2] }],
  hold: null,
  score: 50,
  level: 1,
  streak: 0,
  rerolls: 2,
  ...over,
})
const seed = state => blockyStore.set({ theme: 0, save: serializeState(state) })

describe('Blocky Blitz screen', () => {
  it('starts a new game with three pieces, an empty hold slot and 2 re-rolls', () => {
    render(<BlockyGame />)
    expect(pieces()).toHaveLength(3)
    expect(screen.getByLabelText('Score 0')).toBeTruthy()
    expect(screen.getByRole('group', { name: /Hold slot, empty/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Re-roll .* 2 left/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Change colour theme/ })).toBeTruthy()
  })

  it('restores a saved game', () => {
    seed(savedGame({ score: 321, level: 1 }))
    render(<BlockyGame />)
    expect(screen.getByLabelText('Score 321')).toBeTruthy()
    expect(pieces().map(p => p.getAttribute('aria-label')).length).toBe(3)
  })

  it('ignores a corrupted save and starts fresh', () => {
    blockyStore.set({ theme: 0, save: { board: 'nope', tray: 7 } })
    render(<BlockyGame />)
    expect(screen.getByLabelText('Score 0')).toBeTruthy()
    expect(pieces()).toHaveLength(3)
  })

  it('re-roll spends one and disables at zero', () => {
    seed(savedGame({ rerolls: 1 }))
    render(<BlockyGame />)
    fireEvent.click(screen.getByRole('button', { name: /Re-roll .* 1 left/ }))
    const btn = screen.getByRole('button', { name: /Re-roll .* 0 left/ })
    expect(btn.disabled).toBe(true)
    expect(pieces()).toHaveLength(3)
  })

  it('places a piece from the keyboard: Enter picks up, Enter places', () => {
    seed(savedGame({ score: 0 }))
    render(<BlockyGame />)
    const first = pieces()[0] // a single dot
    fireEvent.keyDown(first, { key: 'Enter' })
    fireEvent.keyDown(first, { key: 'Enter' })
    expect(pieces()).toHaveLength(2) // slot emptied
    expect(screen.getByLabelText('Score 1')).toBeTruthy() // the dot is worth 1 point
  })

  it('holds a piece with H and shows it in the hold slot', () => {
    seed(savedGame({}))
    render(<BlockyGame />)
    fireEvent.keyDown(pieces()[1], { key: 'h' })
    expect(screen.getByRole('group', { name: /one piece stored/ })).toBeTruthy()
    expect(pieces()).toHaveLength(2)
    const hold = screen.getByRole('group', { name: /one piece stored/ })
    expect(within(hold).getByRole('button', { name: /Held piece/ })).toBeTruthy()
  })

  it('cycles colour themes and remembers the choice', () => {
    render(<BlockyGame />)
    fireEvent.click(screen.getByRole('button', { name: /Change colour theme/ }))
    expect(document.querySelector('.bb-root').getAttribute('data-theme')).toBe('1')
    expect(blockyStore.get().theme).toBe(1)
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: /Change colour theme/ }))
    expect(document.querySelector('.bb-root').getAttribute('data-theme')).toBe('0')
  })

  it('opens settings with sound, vibration, reset and new game', () => {
    seed(savedGame({ score: 40 }))
    render(<BlockyGame />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    const dialog = screen.getByRole('dialog', { name: 'Settings' })
    expect(within(dialog).getByLabelText('Sound')).toBeTruthy()
    expect(within(dialog).getByLabelText(/Vibration/)).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: /Reset best score/ })).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'New Game' }))
    expect(screen.getByLabelText('Score 0')).toBeTruthy()
  })

  it('shows the game over card when nothing fits, with a Play Again button', () => {
    // checkerboard board: only single cells are free, and the tray holds a domino and a square
    const board = emptyBoard()
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 0) board[r][c] = COLORS[3]
    // the saved game is "over" so loadSavedGame drops it; play the final dot instead
    seed(savedGame({ board, tray: [{ id: 'dot', color: COLORS[0] }, { id: 'h2', color: COLORS[1] }, { id: 'sq2', color: COLORS[2] }], score: 10 }))
    render(<BlockyGame />)
    const dot = pieces()[0]
    fireEvent.keyDown(dot, { key: 'Enter' })
    fireEvent.keyDown(dot, { key: 'Enter' })
    // after the dot is placed the h2 and sq2 still cannot fit
    return screen.findByRole('dialog', { name: 'Game over' }, { timeout: 2500 }).then(dialog => {
      expect(within(dialog).getByRole('button', { name: 'Play Again' })).toBeTruthy()
      fireEvent.click(within(dialog).getByRole('button', { name: 'Play Again' }))
      expect(screen.queryByRole('dialog', { name: 'Game over' })).toBeNull()
      expect(screen.getByLabelText('Score 0')).toBeTruthy()
    })
  })
})
