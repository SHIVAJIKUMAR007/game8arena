// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { COLORS } from './data'
import { DEFAULT_SAVE, applyVictory, buy, equip, owns, priceOf, sanitizeSave, starsFor, stickStore } from './store'
import { STORAGE_PREFIX } from '../../platform/storage'

afterEach(() => localStorage.clear())
const save = (patch = {}) => sanitizeSave({ ...DEFAULT_SAVE, ...patch })

describe('save handling', () => {
  it('falls back to defaults for missing, malformed or wrong-version data', () => {
    for (const bad of [undefined, null, 5, 'x', [], {}, { v: 99, coins: 500 }, { coins: 500 }]) {
      const s = sanitizeSave(bad)
      expect(s.coins, JSON.stringify(bad)).toBe(0)
      expect(s.weapons).toEqual(['sword'])
      expect(s.equipped.weapon).toBe('sword')
      expect(s.level).toBe(1)
    }
  })

  it('repairs bad fields one by one and keeps the good ones', () => {
    const s = sanitizeSave({
      v: 1, coins: -50, level: 'x', best: 4.9, stars: { 1: 3, 2: 99, x: 2, 3: 'a' }, weapons: ['axe', 'laser', 7], skins: 'no',
      colors: ['pink'], effects: null, designs: ['axe:gold', 'axe:classic', 'laser:gold', 'nonsense'],
      equipped: { weapon: 'bow', skin: 'crown', color: 'pink', effect: 'fire', designs: { axe: 'gold', sword: 'gold' } }, music: 'yes', wins: { single: -1, p1: 3 },
    })
    expect(s.coins).toBe(0)
    expect(s.best).toBe(4)
    expect(s.level).toBe(5)
    expect(s.stars).toEqual({ 1: 3, 2: 3 })
    expect([...s.weapons].sort()).toEqual(['axe', 'sword'])
    expect(s.skins).toEqual(['classic'])
    expect(s.colors).toContain('pink')
    expect(s.designs).toEqual(['axe:gold'])
    expect(s.equipped).toEqual({ weapon: 'sword', skin: 'classic', color: 'pink', effect: 'none', designs: { axe: 'gold' } })
    expect(s.music).toBe(true)
    expect(s.wins).toEqual({ single: 0, p1: 3, p2: 0 })
  })

  it('always owns the free items and equips only what it owns', () => {
    const s = sanitizeSave({ v: 1, equipped: { weapon: 'giant' } })
    expect(s.equipped.weapon).toBe('sword')
    expect(COLORS.filter(c => c.price === 0).every(c => s.colors.includes(c.id))).toBe(true)
  })

  it('the persistent store survives corrupted JSON in localStorage', () => {
    localStorage.setItem(`${STORAGE_PREFIX}stickman`, '{not json')
    expect(() => stickStore.get()).not.toThrow()
    stickStore.set(s => ({ ...s, coins: 12 }))
    expect(JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}stickman`)).coins).toBe(12)
  })
})

describe('shop and progress', () => {
  it('buying spends coins once and refuses when short or already owned', () => {
    const s = save({ coins: 300 })
    const b = buy(s, 'weapon', 'axe')
    expect(b.coins).toBe(300 - priceOf('weapon', 'axe'))
    expect(owns(b, 'weapon', 'axe')).toBe(true)
    expect(buy(b, 'weapon', 'axe')).toBeNull()
    expect(buy(s, 'weapon', 'giant')).toBeNull()
    expect(buy(s, 'weapon', 'nope')).toBeNull()
    expect(s.coins).toBe(300)
  })

  it('weapon designs need the weapon first', () => {
    const s = save({ coins: 1000 })
    expect(buy(s, 'design', 'axe:gold')).toBeNull()
    const withAxe = buy(s, 'weapon', 'axe')
    const d = buy(withAxe, 'design', 'axe:frost')
    expect(owns(d, 'design', 'axe:frost')).toBe(true)
    expect(equip(d, 'design', 'axe:frost').equipped.designs.axe).toBe('frost')
    expect(equip(d, 'design', 'axe:gold')).toBeNull()
    expect(owns(s, 'design', 'sword:classic')).toBe(true)
  })

  it('equip refuses things that are not owned', () => {
    const s = save()
    expect(equip(s, 'weapon', 'hammer')).toBeNull()
    expect(equip(s, 'color', 'red').equipped.color).toBe('red')
    expect(equip(s, 'skin', 'cap')).toBeNull()
  })

  it('a win adds coins, keeps the best stars and unlocks the next level', () => {
    let s = applyVictory(save(), 1, 2, 70)
    expect(s.coins).toBe(70)
    expect(s.level).toBe(2)
    expect(s.best).toBe(1)
    s = applyVictory(s, 1, 1, 10)
    expect(s.stars[1]).toBe(2)
    expect(s.level).toBe(2)
    s = applyVictory(s, 2, 3, 0)
    expect(s.level).toBe(3)
    expect(s.wins.single).toBe(3)
  })

  it('stars follow the health left', () => {
    expect(starsFor(100, 100)).toBe(3)
    expect(starsFor(50, 100)).toBe(2)
    expect(starsFor(5, 100)).toBe(1)
  })
})
