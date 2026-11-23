// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import FamilySortGame from './FamilySortGame'
import { BOTTLE_COST, HINT_COST, levelReward } from './economy'
import { buildLevel } from './engine'
import { levelParams } from './generator'
import { familyStore, resetFamily } from './store'
import { settingsStore } from '../../platform/settings'
import { progressStore } from '../../platform/progress'

beforeEach(() => {
  resetFamily()
  // Instant pours (no animation timers) and no sound; the tutorial is not in the way.
  settingsStore.set(s => ({ ...s, motion: 'reduce', sound: false }))
  progressStore('family').set(s => ({ ...s, tutorialSeen: true, best: 0, stars: {}, highScore: 0 }))
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

const bottles = () => screen.getAllByRole('button', { name: /^Bottle \d+/ })
const click = i => fireEvent.click(bottles()[i])
const pour = (from, to) => {
  click(from)
  click(to)
}
const coins = () => Number(screen.getByLabelText(/^Coins \d+/).getAttribute('aria-label').replace('Coins ', ''))

/** Clicks through a stored solution of a level. */
function playSolution(level) {
  for (const [f, t] of buildLevel(level).solution) pour(f, t)
}

describe('Family Sort screen', () => {
  it('opens on level 1 with the starting coins and the right number of bottles', () => {
    render(<FamilySortGame />)
    expect(screen.getByLabelText('Level 1')).toBeTruthy()
    expect(coins()).toBe(150)
    expect(bottles()).toHaveLength(4)
    for (const name of [/Undo move/, /Add bottle/, /Hint/, /Settings/]) expect(screen.getByRole('button', { name })).toBeTruthy()
  })

  it('describes each bottle from the bottom up for screen readers', () => {
    render(<FamilySortGame />)
    const first = buildLevel(1).bottles[0]
    expect(bottles()[0].getAttribute('aria-label')).toMatch(/from bottom to top|empty/)
    expect(bottles()[0].getAttribute('aria-label').split(',').length).toBeGreaterThanOrEqual(first.length ? first.length : 1)
  })

  it('lifts a bottle when tapped and puts it down when tapped again', () => {
    render(<FamilySortGame />)
    const i = buildLevel(1).bottles.findIndex(b => b.length)
    click(i)
    expect(bottles()[i].getAttribute('aria-pressed')).toBe('true')
    click(i)
    expect(bottles()[i].getAttribute('aria-pressed')).toBe('false')
  })

  it('shakes and does nothing on a pour the rules forbid, and on an empty bottle', () => {
    render(<FamilySortGame />)
    const lv = buildLevel(1)
    const empty = lv.bottles.findIndex(b => b.length === 0)
    click(empty)
    expect(bottles()[empty].className).toContain('shake')
    // Find two full bottles with different tops: that pour is illegal.
    const full = lv.bottles.map((b, i) => [b, i]).filter(([b]) => b.length === 4)
    const bad = full.find(([b]) => b[3] !== full[0][0][3]) || full[1]
    const before = bottles().map(b => b.getAttribute('aria-label'))
    pour(full[0][1], bad[1])
    expect(bottles().map(b => b.getAttribute('aria-label'))).toEqual(before)
    expect(bottles()[bad[1]].className).toContain('shake')
  })

  it('pours, undoes, and counts moves', () => {
    render(<FamilySortGame />)
    const lv = buildLevel(1)
    const [f, t] = lv.solution[0]
    const before = bottles().map(b => b.getAttribute('aria-label'))
    pour(f, t)
    const after = bottles().map(b => b.getAttribute('aria-label'))
    expect(after).not.toEqual(before)
    expect(screen.getByRole('button', { name: /Undo move/ }).textContent).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: /Undo move/ }))
    expect(bottles().map(b => b.getAttribute('aria-label'))).toEqual(before)
    expect(screen.getByRole('button', { name: /Undo move/ }).hasAttribute('disabled')).toBe(true)
  })

  it('charges coins for a hint and glows the two bottles of a move that works', () => {
    render(<FamilySortGame />)
    fireEvent.click(screen.getByRole('button', { name: /Hint/ }))
    expect(coins()).toBe(150 - HINT_COST)
    expect(document.querySelectorAll('.hint-from')).toHaveLength(1)
    expect(document.querySelectorAll('.hint-to')).toHaveLength(1)
    expect(familyStore.get().hintsUsed).toBe(1)
  })

  it('refuses a hint and an extra bottle when the player cannot pay', () => {
    familyStore.set(s => ({ ...s, coins: 5 }))
    render(<FamilySortGame />)
    fireEvent.click(screen.getByRole('button', { name: /Hint/ }))
    expect(screen.getByRole('status').textContent).toMatch(/costs 30 coins/)
    fireEvent.click(screen.getByRole('button', { name: /Add bottle/ }))
    expect(bottles()).toHaveLength(4)
    expect(coins()).toBe(5)
  })

  it('adds an extra empty bottle for coins, up to two', () => {
    familyStore.set(s => ({ ...s, coins: 1000 }))
    render(<FamilySortGame />)
    const add = screen.getByRole('button', { name: /Add bottle/ })
    fireEvent.click(add)
    expect(bottles()).toHaveLength(5)
    expect(coins()).toBe(1000 - BOTTLE_COST)
    fireEvent.click(add)
    fireEvent.click(add)
    expect(bottles()).toHaveLength(6)
    expect(coins()).toBe(1000 - 2 * BOTTLE_COST)
  })

  it('keeps an extra bottle when a move made before it is undone', () => {
    familyStore.set(s => ({ ...s, coins: 1000 }))
    render(<FamilySortGame />)
    const [f, t] = buildLevel(1).solution[0]
    pour(f, t)
    fireEvent.click(screen.getByRole('button', { name: /Add bottle/ }))
    fireEvent.click(screen.getByRole('button', { name: /Undo move/ }))
    expect(bottles()).toHaveLength(5)
  })

  it('restores the level in progress after a reload', () => {
    const view = render(<FamilySortGame />)
    const [f, t] = buildLevel(1).solution[0]
    pour(f, t)
    const mid = bottles().map(b => b.getAttribute('aria-label'))
    view.unmount()
    render(<FamilySortGame />)
    expect(bottles().map(b => b.getAttribute('aria-label'))).toEqual(mid)
  })

  it('solving the level shows the win screen, pays coins once, and Next Level starts level 2', async () => {
    render(<FamilySortGame />)
    playSolution(1)
    const dialog = await screen.findByRole('dialog', { name: /Level 1 complete/ }, { timeout: 3000 })
    expect(dialog).toBeTruthy()
    const reward = levelReward({ level: 1, hints: 0 })
    expect(familyStore.get().coins).toBe(150 + reward.total)
    expect(familyStore.get().completed[1]).toBeTruthy()
    expect(screen.getByText(new RegExp(`\\+${reward.total} coins`))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next Level' }))
    expect(screen.getByLabelText('Level 2')).toBeTruthy()
    expect(familyStore.get().level).toBe(2)
    expect(bottles()).toHaveLength(levelParams(2).bottles)
  })

  it('opens the settings with the shop, and restarts the level from there', () => {
    familyStore.set(s => ({ ...s, coins: 1000 }))
    render(<FamilySortGame />)
    const fresh = bottles().map(b => b.getAttribute('aria-label'))
    const [f, t] = buildLevel(1).solution[0]
    pour(f, t)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Buy Frosted glass/ }))
    expect(familyStore.get().equipped.bottle).toBe('frosted')
    expect(document.querySelector('.fs-root').getAttribute('data-bottle')).toBe('frosted')
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    expect(bottles().map(b => b.getAttribute('aria-label'))).toEqual(fresh)
    expect(screen.getByRole('button', { name: /Undo move/ }).hasAttribute('disabled')).toBe(true)
  })

  it('shows the how-to-play tips the first time', () => {
    progressStore('family').set(s => ({ ...s, tutorialSeen: false }))
    render(<FamilySortGame />)
    expect(screen.getByRole('dialog', { name: 'How to play' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(progressStore('family').get().tutorialSeen).toBe(true)
  })

  it('supports the keyboard: arrows move focus, U undoes', () => {
    render(<FamilySortGame />)
    const root = document.querySelector('.fs-root')
    bottles()[0].focus()
    fireEvent.keyDown(root, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(bottles()[1])
    const [f, t] = buildLevel(1).solution[0]
    pour(f, t)
    fireEvent.keyDown(root, { key: 'u' })
    expect(screen.getByRole('button', { name: /Undo move/ }).hasAttribute('disabled')).toBe(true)
  })
})
