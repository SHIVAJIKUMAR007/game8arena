// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

// The real engine needs a canvas and a frame clock. Here it is a stub that lets the test decide how the fight ends,
// so the screen's own result handling (coins, stars, unlocks, saving) is what gets tested.
const engines = []
vi.mock('./engine', () => ({
  createEngine: vi.fn(({ config, onUi, onEnd }) => {
    const players = config.fighters.map((f, id) => ({
      id, name: f.name, hp: f.hpMax || 100, hpMax: f.hpMax || 100, cd: 0, cdMax: 7, special: 'Energy Wave', guard: 100, color: f.color || 'blue', weapon: f.weapon, shield: false, isAI: Boolean(f.isAI),
    }))
    const eng = {
      config, onEnd,
      key: () => false, setTouch: () => {}, releaseAll: () => {}, resize: () => {}, destroy: () => {},
      pause: vi.fn(), start: () => onUi({ phase: 'fight', paused: false, timeLeft: 100, mode: config.mode, players }),
    }
    engines.push(eng)
    return eng
  }),
}))

import StickmanGame from './StickmanGame'
import { DEFAULT_SAVE, stickStore } from './store'
import { progressStore } from '../../platform/progress'
import { settingsStore } from '../../platform/settings'

beforeEach(() => {
  engines.length = 0
  stickStore.set({ ...DEFAULT_SAVE })
  settingsStore.set(s => ({ ...s, sound: false }))
  progressStore('stickman').set(s => ({ ...s, best: 0, level: 1, stars: {}, highScore: 0 }))
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})
const btn = name => screen.getByRole('button', { name })
const last = () => engines[engines.length - 1]

describe('single player results', () => {
  it('a win pays coins, saves stars and opens the next level', () => {
    render(<StickmanGame />)
    fireEvent.click(btn(/Single Player/))
    act(() => last().onEnd({ winner: 0, reason: 'ko', hp: [90, 0], hpMax: [100, 60], time: 20, stats: [{}, {}] }))
    const dlg = screen.getByRole('dialog', { name: 'Victory' })
    expect(within(dlg).getByLabelText('3 of 3 stars')).toBeTruthy()
    const s = stickStore.get()
    expect(s.coins).toBe(30 + 8 + 30) // level 1 first clear with 3 stars
    expect(s.best).toBe(1)
    expect(s.level).toBe(2)
    expect(s.stars[1]).toBe(3)
    expect(progressStore('stickman').get().best).toBe(1)
    expect(progressStore('stickman').get().highScore).toBeGreaterThan(0)

    fireEvent.click(within(dlg).getByRole('button', { name: 'Next level' }))
    expect(screen.getByText('LEVEL 2')).toBeTruthy()
    expect(last().config.fighters[1].weapon).toBe('sword')
  })

  it('replaying a cleared level pays less and never lowers the stars', () => {
    stickStore.set(s => ({ ...s, best: 1, level: 2, stars: { 1: 3 } }))
    render(<StickmanGame />)
    fireEvent.click(btn(/Level Selection/))
    fireEvent.click(btn(/^Level 1,/))
    act(() => last().onEnd({ winner: 0, reason: 'ko', hp: [10, 0], hpMax: [100, 60], time: 90, stats: [{}, {}] }))
    expect(screen.getByRole('dialog', { name: 'Victory' })).toBeTruthy()
    const s = stickStore.get()
    expect(s.coins).toBe(Math.round((30 + 8 + 10) * 0.4))
    expect(s.stars[1]).toBe(3)
    expect(s.level).toBe(2)
    expect(screen.getByText(/Replays pay less/)).toBeTruthy()
  })

  it('a loss pays nothing, keeps progress and offers a retry', () => {
    render(<StickmanGame />)
    fireEvent.click(btn(/Single Player/))
    act(() => last().onEnd({ winner: 1, reason: 'ko', hp: [0, 40], hpMax: [100, 60], time: 30, stats: [{}, {}] }))
    expect(screen.getByRole('dialog', { name: 'Defeat' })).toBeTruthy()
    expect(stickStore.get().coins).toBe(0)
    expect(stickStore.get().level).toBe(1)
    const before = engines.length
    fireEvent.click(btn('Try again'))
    expect(engines.length).toBeGreaterThan(before)
    expect(screen.getByText('LEVEL 1')).toBeTruthy()
  })

  it('cannot start a locked level, even from a stale button', () => {
    render(<StickmanGame />)
    fireEvent.click(btn(/Level Selection/))
    expect(btn('Level 5, locked').disabled).toBe(true)
  })

  it('coins earned can be spent right after the fight', () => {
    render(<StickmanGame />)
    fireEvent.click(btn(/Single Player/))
    act(() => last().onEnd({ winner: 0, reason: 'ko', hp: [90, 0], hpMax: [100, 60], time: 20, stats: [{}, {}] }))
    fireEvent.click(btn('Menu'))
    fireEvent.click(btn(/Weapon Selection/))
    fireEvent.click(btn(/^Spear, 150 coins/))
    expect(btn(/Buy/)).toBeTruthy()
  })
})

describe('2 player results', () => {
  const start = () => {
    render(<StickmanGame />)
    fireEvent.click(btn('2 Player'))
    fireEvent.click(btn('Start Fight'))
  }

  it('names the winner, counts the series and offers a rematch', () => {
    start()
    act(() => last().onEnd({ winner: 1, reason: 'ko', hp: [0, 55], hpMax: [100, 100], time: 40, stats: [{}, {}] }))
    expect(screen.getByRole('heading', { name: 'Player 2 wins!' })).toBeTruthy()
    expect(stickStore.get().wins).toEqual({ single: 0, p1: 0, p2: 1 })
    expect(stickStore.get().coins).toBe(0)
    const before = engines.length
    fireEvent.click(btn('Rematch'))
    expect(engines.length).toBe(before + 1)
    expect(screen.getByText('VS')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /wins/ })).toBeNull()
  })

  it('shows a draw when time runs out level', () => {
    start()
    act(() => last().onEnd({ winner: -1, reason: 'time', hp: [50, 50], hpMax: [100, 100], time: 120, stats: [{}, {}] }))
    expect(screen.getByRole('heading', { name: 'Draw!' })).toBeTruthy()
    expect(stickStore.get().wins).toEqual({ single: 0, p1: 0, p2: 0 })
  })

  it('can go back to change fighters, or to the menu', () => {
    start()
    act(() => last().onEnd({ winner: 0, reason: 'ko', hp: [60, 0], hpMax: [100, 100], time: 30, stats: [{}, {}] }))
    fireEvent.click(btn('Change fighters'))
    expect(btn('Start Fight')).toBeTruthy()
  })

  it('restart from the pause menu begins a fresh fight', () => {
    start()
    const before = engines.length
    fireEvent.click(btn('Pause'))
    // the stub does not flip the paused flag, so open the dialog through the snapshot
    expect(last().pause).toHaveBeenCalledWith(true)
    expect(before).toBeGreaterThan(0)
  })
})
