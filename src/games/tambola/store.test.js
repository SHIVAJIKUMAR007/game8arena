// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { readStats, recordHint, recordWin, withHint, withWin } from './store'
import { getProgress, progressStore } from '../../platform/progress'

afterEach(() => localStorage.clear())

describe('tambola saved stats', () => {
  it('falls back to empty stats for missing, wrong-typed or corrupted data', () => {
    const empty = { won: 0, hints: 0, bestTimes: {} }
    for (const p of [undefined, null, {}, { tbStats: null }, { tbStats: 'junk' }, { tbStats: [1, 2] }, { tbStats: { won: -3, hints: 'x', bestTimes: 5 } }]) {
      expect(readStats(p)).toEqual(empty)
    }
  })

  it('keeps good values and drops bad times', () => {
    const p = { tbStats: { won: 4.9, hints: 2, bestTimes: { 3: 41.26, 0: 5, abc: 9, 7: -1, 8: 'fast', 9: NaN } } }
    expect(readStats(p)).toEqual({ won: 4, hints: 2, bestTimes: { 3: 41.3 } })
  })

  it('records wins, keeping only the fastest time per level', () => {
    let s = withWin(undefined, { level: 2, seconds: 60 })
    s = withWin(s, { level: 2, seconds: 80 })
    expect(s).toEqual({ won: 2, hints: 0, bestTimes: { 2: 60 } })
    s = withWin(s, { level: 2, seconds: 45.04 })
    expect(s.bestTimes[2]).toBe(45)
    expect(withWin(s, { level: 5, seconds: Number.NaN }).bestTimes).toEqual({ 2: 45 })
  })

  it('counts hints', () => {
    expect(withHint(withHint(undefined)).hints).toBe(2)
  })

  it('persists through the shared progress store and survives a corrupted save', () => {
    progressStore('tambola').set(() => ({ level: 1, best: 0, stars: {}, highScore: 0, extraLives: 0, tutorialSeen: true, stats: {}, achievements: {}, daily: {} }))
    recordWin(3, 70)
    recordHint()
    expect(readStats(getProgress('tambola'))).toEqual({ won: 1, hints: 1, bestTimes: { 3: 70 } })
    localStorage.setItem('arcadehub:v1:progress:tambola', '{not json')
    expect(() => readStats({})).not.toThrow()
  })
})
