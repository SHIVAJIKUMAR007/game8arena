// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import StickmanGame from './StickmanGame'
import { DEFAULT_SAVE, stickStore } from './store'
import { settingsStore } from '../../platform/settings'
import { progressStore } from '../../platform/progress'

// jsdom has no canvas: menus, HUD and rules still run, only drawing is skipped.
beforeEach(() => {
  stickStore.set({ ...DEFAULT_SAVE })
  settingsStore.set(s => ({ ...s, sound: false }))
  progressStore('stickman').set(s => ({ ...s, best: 0, level: 1, stars: {}, highScore: 0 }))
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

const btn = name => screen.getByRole('button', { name })

describe('Stickman Fight menus', () => {
  it('shows the logo and every main menu option, with no dead buttons', () => {
    render(<StickmanGame />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/STICKMAN\s*FIGHT/)
    for (const name of [/Single Player/, /2 Player/, /Weapon Selection/, /Skin Selection/, /Level Selection/, /Settings/]) {
      expect(screen.getAllByRole('button', { name }).length).toBeGreaterThan(0)
    }
  })

  it('opens and closes the settings dialog and saves the music toggle', () => {
    render(<StickmanGame />)
    fireEvent.click(screen.getByRole('button', { name: /^⚙ Settings/ }))
    const dlg = screen.getByRole('dialog', { name: 'Settings' })
    settingsStore.set(s => ({ ...s, sound: true }))
    const music = within(dlg).getByLabelText('Music')
    fireEvent.click(music)
    expect(stickStore.get().music).toBe(false)
    expect(within(dlg).getByLabelText('Volume')).toBeTruthy()
    fireEvent.click(within(dlg).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('level select: only level 1 is open on a new save, and a cleared level opens the next', () => {
    const { unmount } = render(<StickmanGame />)
    fireEvent.click(btn(/Level Selection/))
    expect(btn(/^Level 1,/).disabled).toBe(false)
    expect(btn('Level 2, locked').disabled).toBe(true)
    unmount()
    stickStore.set(s => ({ ...s, best: 1, level: 2, stars: { 1: 2 } }))
    render(<StickmanGame />)
    fireEvent.click(btn(/Level Selection/))
    expect(btn(/^Level 1,.*2 stars/)).toBeTruthy()
    expect(btn(/^Level 2,/).disabled).toBe(false)
    expect(btn('Level 3, locked').disabled).toBe(true)
  })

  it('weapon shop: refuses when coins are short, buys and equips when they are enough', () => {
    render(<StickmanGame />)
    fireEvent.click(btn(/Weapon Selection/))
    fireEvent.click(btn(/^Axe, 200 coins/))
    expect(btn(/Buy/).disabled).toBe(false)
    fireEvent.click(btn(/Buy/))
    expect(screen.getByRole('status').textContent).toMatch(/Not enough coins/)
    expect(stickStore.get().weapons).toEqual(['sword'])

    act(() => stickStore.set(s => ({ ...s, coins: 500 })))
    fireEvent.click(btn(/Buy/))
    expect(stickStore.get().weapons).toContain('axe')
    expect(stickStore.get().equipped.weapon).toBe('axe')
    expect(stickStore.get().coins).toBe(300)
    expect(screen.getByRole('status').textContent).toMatch(/Unlocked/)
    expect(btn('Equipped').disabled).toBe(true)
  })

  it('skins, colours and effects can be bought and equipped', () => {
    act(() => stickStore.set(s => ({ ...s, coins: 1000 })))
    render(<StickmanGame />)
    fireEvent.click(btn(/Skin Selection/))
    fireEvent.click(btn(/^Red Cap, 100 coins/))
    fireEvent.click(btn(/Buy/))
    expect(stickStore.get().equipped.skin).toBe('cap')
    fireEvent.click(screen.getByRole('tab', { name: /Color/ }))
    fireEvent.click(btn(/^Red, owned/))
    fireEvent.click(btn('Equip'))
    expect(stickStore.get().equipped.color).toBe('red')
    fireEvent.click(screen.getByRole('tab', { name: /Effect/ }))
    fireEvent.click(btn(/^Fire, 200 coins/))
    fireEvent.click(btn(/Buy/))
    expect(stickStore.get().equipped.effect).toBe('fire')
  })

  it('weapon designs are sold for owned weapons', () => {
    act(() => stickStore.set(s => ({ ...s, coins: 400 })))
    render(<StickmanGame />)
    fireEvent.click(btn(/Weapon Selection/))
    fireEvent.click(btn(/Frost design, 150 coins/))
    expect(stickStore.get().designs).toContain('sword:frost')
    expect(stickStore.get().equipped.designs.sword).toBe('frost')
    expect(stickStore.get().coins).toBe(250)
  })

  it('survives a corrupted save', () => {
    localStorage.setItem('arcadehub:v1:stickman', '{{{{')
    expect(() => render(<StickmanGame />)).not.toThrow()
    expect(btn(/Single Player/)).toBeTruthy()
  })
})

describe('Stickman Fight matches', () => {
  it('single player starts level 1: HUD with both health bars, level number and a way to pause', () => {
    render(<StickmanGame />)
    fireEvent.click(btn(/Single Player/))
    expect(screen.getByRole('progressbar', { name: 'You health' })).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Rookie health' })).toBeTruthy()
    expect(screen.getByText('LEVEL 1')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Jump' })).toBeTruthy()
  })

  it('pause menu offers resume, restart, settings and quit', () => {
    render(<StickmanGame />)
    fireEvent.click(btn(/Single Player/))
    fireEvent.click(btn('Pause'))
    const dlg = screen.getByRole('dialog', { name: 'Paused' })
    for (const n of ['Resume', 'Restart', /Sound/, 'Quit to menu']) expect(within(dlg).getByRole('button', { name: n })).toBeTruthy()
    fireEvent.click(within(dlg).getByRole('button', { name: 'Resume' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(btn('Pause'))
    fireEvent.click(btn('Quit to menu'))
    expect(btn(/Single Player/)).toBeTruthy()
  })

  it('2 player: setup shows both players, controls, and starts a fight with two bars', () => {
    render(<StickmanGame />)
    fireEvent.click(btn('2 Player'))
    expect(screen.getByRole('region', { name: 'Player 1' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Player 2' })).toBeTruthy()
    const p2 = screen.getByRole('region', { name: 'Player 2' })
    fireEvent.click(within(p2).getByRole('button', { name: 'Next Weapon' }))
    expect(within(p2).getByText('Dual Swords')).toBeTruthy()
    fireEvent.click(btn('Next Arena')) // Random → Floating Platforms
    fireEvent.click(btn('Next Arena'))
    expect(screen.getByText('Forest Arena')).toBeTruthy()
    fireEvent.click(btn('Start Fight'))
    expect(screen.getByRole('progressbar', { name: 'Player 1 health' })).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Player 2 health' })).toBeTruthy()
    expect(screen.getByText('VS')).toBeTruthy()
  })

  it('2 player: keys are heard by the running fight, pressing P pauses it', () => {
    render(<StickmanGame />)
    fireEvent.click(btn('2 Player'))
    fireEvent.click(btn('Start Fight'))
    fireEvent.keyDown(window, { code: 'KeyP' })
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeTruthy()
    fireEvent.keyDown(window, { code: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('?mode=versus opens the two player setup', () => {
    render(<StickmanGame initialMode="versus" />)
    expect(screen.getByRole('button', { name: 'Start Fight' })).toBeTruthy()
  })
})
