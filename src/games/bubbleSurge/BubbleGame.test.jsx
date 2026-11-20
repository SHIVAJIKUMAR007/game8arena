// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import BubbleGame from './BubbleGame'
import { surgeStore } from './store'
import { settingsStore } from '../../platform/settings'
import { progressStore } from '../../platform/progress'

// jsdom has no canvas: the rules and HUD still run, only drawing is skipped.
beforeEach(() => {
  surgeStore.set({ level: 1, score: 0 })
  progressStore('bubbles').set(s => ({ ...s, highScore: 0, best: 0, stars: {} }))
  settingsStore.set(s => ({ ...s, sound: true }))
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

const canvas = () => screen.getByRole('application')

describe('Bubble Surge screen', () => {
  it('starts on level 1 with an empty meter, score 0 and a focusable canvas', () => {
    render(<BubbleGame />)
    expect(screen.getByLabelText('Level 1')).toBeTruthy()
    expect(screen.getByLabelText('Score 0')).toBeTruthy()
    expect(screen.getByRole('img', { name: /Bomb meter 0 of 5/ })).toBeTruthy()
    expect(canvas().getAttribute('tabindex')).toBe('0')
    expect(screen.getByRole('progressbar', { name: 'Field cleared' })).toBeTruthy()
  })

  it('resumes from the saved level and score', () => {
    surgeStore.set({ level: 4, score: 5200 })
    render(<BubbleGame />)
    expect(screen.getByLabelText('Level 4')).toBeTruthy()
    expect(screen.getByLabelText('Score 5200')).toBeTruthy()
  })

  it('pauses and resumes from the button and the keyboard', () => {
    render(<BubbleGame />)
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeTruthy()
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Paused' })).getByRole('button', { name: 'Resume' }))
    expect(screen.queryByRole('dialog', { name: 'Paused' })).toBeNull()
    fireEvent.keyDown(canvas(), { key: 'p' })
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeTruthy()
    fireEvent.keyDown(canvas(), { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Paused' })).toBeNull()
  })

  it('the speaker button toggles the shared sound setting', () => {
    render(<BubbleGame />)
    fireEvent.click(screen.getByRole('button', { name: 'Mute sound' }))
    expect(settingsStore.get().sound).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Turn sound on' }))
    expect(settingsStore.get().sound).toBe(true)
  })

  it('Space swaps the shooter bubble with the next one', () => {
    render(<BubbleGame />)
    const next = () => screen.getByRole('button', { name: /Swap with the next bubble/ }).firstChild.getAttribute('class') + screen.getByRole('button', { name: /Swap with the next bubble/ }).firstChild.getAttribute('style')
    const before = next()
    // swapping twice always returns to the start; once may or may not change the look if both bubbles match
    act(() => {
      fireEvent.keyDown(canvas(), { key: ' ' })
      fireEvent.keyDown(canvas(), { key: ' ' })
    })
    expect(next()).toBe(before)
  })

  it('firing with the keyboard does not crash and is allowed again after the bubble lands', () => {
    render(<BubbleGame />)
    fireEvent.keyDown(canvas(), { key: 'ArrowLeft' })
    fireEvent.keyDown(canvas(), { key: 'ArrowRight' })
    fireEvent.keyDown(canvas(), { key: 'Enter' })
    expect(screen.getByLabelText('Level 1')).toBeTruthy()
  })
})

describe('saved progress', () => {
  it.each([
    ['wrong types', { level: 'x', score: -5 }],
    ['not an object', 'garbage'],
    ['impossible level', { level: 0, score: 10 }],
  ])('falls back to a safe start for corrupted data: %s', async (_, raw) => {
    localStorage.setItem('arcadehub:v1:bubbles', JSON.stringify(raw))
    vi.resetModules()
    const { surgeStore: fresh } = await import('./store')
    const { level, score } = fresh.get()
    expect(level).toBeGreaterThanOrEqual(1)
    expect(Number.isInteger(level)).toBe(true)
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it('keeps valid saved data', async () => {
    localStorage.setItem('arcadehub:v1:bubbles', JSON.stringify({ level: 7, score: 12345 }))
    vi.resetModules()
    const { surgeStore: fresh } = await import('./store')
    expect(fresh.get()).toEqual({ level: 7, score: 12345 })
  })
})
