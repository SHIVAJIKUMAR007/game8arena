// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { START_COINS, levelReward, levelScore, shopItem, starRating } from './economy'
import {
  DEFAULT, STORE_VERSION, addCoins, buyItem, completeLevel, equipItem, familyStore, merge, resetFamily, saveSession, setLevel, setSetting,
} from './store'
import { getProgress } from '../../platform/progress'
import { STORAGE_PREFIX } from '../../platform/storage'

beforeEach(() => resetFamily())
afterEach(() => localStorage.clear())

describe('safe loading', () => {
  it('falls back to the defaults for missing, non-object and wrong-version data', () => {
    for (const bad of [undefined, null, 'oops', 42, [], {}, { v: STORE_VERSION + 1, coins: 9999 }, { v: 0, level: 7 }]) {
      const s = merge(DEFAULT, bad)
      expect(s.level).toBe(1)
      expect(s.coins).toBe(START_COINS)
      expect(s.completed).toEqual({})
    }
  })

  it('repairs individual bad fields and keeps the good ones', () => {
    const s = merge(DEFAULT, {
      v: STORE_VERSION, level: 'seven', coins: -5, bestScore: 1234.9, hintsUsed: NaN,
      completed: { 3: { moves: 9, hints: 0, time: 5000, stars: 3, score: 1100 }, abc: {}, 4: 'x', 5: { stars: 99 } },
      owned: { bottles: ['crystal', 'nonsense', 7], backgrounds: 'nope' },
      equipped: { bottle: 'potion', background: 'night' }, // not owned, so ignored
      settings: { music: 'yes', symbols: true },
    })
    expect(s.level).toBe(1)
    expect(s.coins).toBe(START_COINS)
    expect(s.bestScore).toBe(1234)
    expect(s.hintsUsed).toBe(0)
    expect(Object.keys(s.completed).sort()).toEqual(['3', '5'])
    expect(s.completed[5].stars).toBe(1)
    expect(s.owned.bottles).toEqual(['classic', 'crystal'])
    expect(s.owned.backgrounds).toEqual(['garden'])
    expect(s.equipped).toEqual({ bottle: 'classic', background: 'garden' })
    expect(s.settings).toEqual({ music: false, symbols: true })
  })

  it('drops a saved game that does not match the level or holds impossible bottles', () => {
    const base = { v: STORE_VERSION, level: 4 }
    const ok = { level: 4, bottles: [[0, 1, 0, 1], [1, 0, 1, 0], []], moves: 2, hints: 1, elapsed: 900 }
    expect(merge(DEFAULT, { ...base, session: ok }).session).toEqual(ok)
    expect(merge(DEFAULT, { ...base, session: { ...ok, level: 5 } }).session).toBeNull()
    expect(merge(DEFAULT, { ...base, session: { ...ok, bottles: [[0, 0, 0, 0, 0]] } }).session).toBeNull()
    expect(merge(DEFAULT, { ...base, session: { ...ok, bottles: [[0, 1], [1, 0]] } }).session).toBeNull()
    expect(merge(DEFAULT, { ...base, session: 'junk' }).session).toBeNull()
  })

  it('does not crash on unreadable stored JSON', () => {
    localStorage.setItem(`${STORAGE_PREFIX}family`, '{not json')
    expect(() => merge(DEFAULT, JSON.parse('{}'))).not.toThrow()
    // The store reads through readJSON, which swallows the parse error and returns its fallback.
    expect(familyStore.get().level).toBeGreaterThanOrEqual(1)
  })
})

describe('coins and the shop', () => {
  it('spends and earns coins, and refuses to go below zero', () => {
    expect(familyStore.get().coins).toBe(START_COINS)
    expect(addCoins(-50)).toBe(true)
    expect(familyStore.get().coins).toBe(START_COINS - 50)
    expect(addCoins(-1e6)).toBe(false)
    expect(familyStore.get().coins).toBe(START_COINS - 50)
    expect(addCoins(80)).toBe(true)
  })

  it('buys, owns and equips items, and refuses what it cannot afford', () => {
    expect(buyItem('bottles', 'potion')).toBe(false) // 500 coins, too dear
    expect(buyItem('bottles', 'nonsense')).toBe(false)
    addCoins(1000)
    const before = familyStore.get().coins
    expect(buyItem('bottles', 'frosted')).toBe(true)
    expect(familyStore.get().coins).toBe(before - shopItem('bottles', 'frosted').price)
    expect(familyStore.get().equipped.bottle).toBe('frosted')
    expect(buyItem('bottles', 'frosted')).toBe(false) // already owned
    expect(equipItem('bottles', 'classic')).toBe(true)
    expect(equipItem('bottles', 'crystal')).toBe(false) // not owned
    expect(familyStore.get().equipped.bottle).toBe('classic')
  })
})

describe('saving progress', () => {
  it('records a cleared level: coins, best score, time, hints, and the next level', () => {
    completeLevel(1, { moves: 6, hints: 1, time: 20000, stars: 2, score: 900, reward: 70 })
    const s = familyStore.get()
    expect(s.coins).toBe(START_COINS + 70)
    expect(s.level).toBe(2)
    expect(s.bestScore).toBe(900)
    expect(s.completed[1]).toEqual({ moves: 6, hints: 1, time: 20000, stars: 2, score: 900 })
    expect(getProgress('family').best).toBe(1)
    expect(getProgress('family').stars[1]).toBe(2)
    expect(getProgress('family').highScore).toBe(900)
  })

  it('keeps the better result when a level is played again', () => {
    completeLevel(1, { moves: 6, hints: 0, time: 1, stars: 3, score: 1100, reward: 0 })
    completeLevel(1, { moves: 12, hints: 2, time: 2, stars: 1, score: 400, reward: 0 })
    expect(familyStore.get().completed[1].stars).toBe(3)
    expect(familyStore.get().bestScore).toBe(1100)
    expect(familyStore.get().level).toBe(2)
  })

  it('saves and clears the game in progress, and survives a reload', () => {
    const session = { level: 1, bottles: [[0, 1, 0, 1], [1, 0, 1, 0], []], moves: 3, hints: 0, elapsed: 100 }
    saveSession(session)
    expect(familyStore.get().session).toEqual(session)
    // Simulate a reload: read what was written to localStorage back through merge.
    const raw = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}family`))
    expect(merge(DEFAULT, raw).session).toEqual(session)
    setLevel(2)
    expect(familyStore.get().session).toBeNull()
    setSetting({ music: true })
    expect(familyStore.get().settings.music).toBe(true)
  })
})

describe('economy', () => {
  it('pays a bonus for a level cleared without hints, and more for later levels', () => {
    expect(levelReward({ level: 1, hints: 0 }).total).toBeGreaterThan(levelReward({ level: 1, hints: 2 }).total)
    expect(levelReward({ level: 30, hints: 0 }).total).toBeGreaterThan(levelReward({ level: 1, hints: 0 }).total)
    expect(levelReward({ level: 1e6, hints: 0 }).total).toBe(levelReward({ level: 60, hints: 0 }).total)
    expect(levelReward({ level: 'x', hints: 0 }).total).toBe(levelReward({ level: 1, hints: 0 }).total)
  })

  it('rates stars and scores sensibly', () => {
    expect(starRating({ moves: 8, par: 8, hints: 0 })).toBe(3)
    expect(starRating({ moves: 8, par: 8, hints: 1 })).toBe(2)
    expect(starRating({ moves: 40, par: 8, hints: 0 })).toBe(1)
    expect(levelScore({ moves: 8, par: 8, hints: 0, colors: 3 })).toBeGreaterThan(levelScore({ moves: 30, par: 8, hints: 2, colors: 3 }))
    expect(levelScore({ moves: 9999, par: 1, hints: 99, colors: 2 })).toBe(100)
  })
})
