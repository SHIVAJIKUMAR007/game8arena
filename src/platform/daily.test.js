// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { completeDaily, dailyState, overallDaily, pickDaily, todayKey } from './daily'
import { getProgress } from './progress'

const IDS = ['arrow', 'merge', 'god', 'box', 'traffic', 'memory', 'connect']

afterEach(() => { vi.useRealTimers(); localStorage.clear() })

describe('daily picks', () => {
  it('picks 3 different games, the same for everyone on a given day', () => {
    const a = pickDaily(IDS, '2026-11-05')
    expect(a).toHaveLength(3)
    expect(new Set(a).size).toBe(3)
    expect(a.every(id => IDS.includes(id))).toBe(true)
    expect(pickDaily([...IDS].reverse(), '2026-11-05')).toEqual(a) // list order doesn't matter
  })

  it('changes from day to day and gives every game a turn', () => {
    const seen = new Set()
    const sets = new Set()
    for (let d = 1; d <= 28; d++) {
      const p = pickDaily(IDS, `2026-02-${String(d).padStart(2, '0')}`)
      p.forEach(id => seen.add(id))
      sets.add(p.slice().sort().join())
    }
    expect(seen.size).toBe(IDS.length)
    expect(sets.size).toBeGreaterThan(10)
  })

  it('copes with fewer games than slots', () => {
    expect(pickDaily(['a', 'b'], '2026-11-05')).toHaveLength(2)
  })
})

describe('overall streak', () => {
  const day = d => { vi.useFakeTimers(); vi.setSystemTime(new Date(`2026-11-${d}T12:00:00`)) }
  const picks = ['a', 'b', 'c']

  it('a day counts only when all of its games are done, and streaks carry over consecutive days', () => {
    day('05')
    completeDaily('a', { stars: 3, score: 100 }, picks)
    completeDaily('b', { stars: 2, score: 80 }, picks)
    expect(overallDaily(picks)).toMatchObject({ complete: false, streak: 0 })
    expect(dailyState(getProgress('a')).done).toBe(true)
    expect(dailyState(getProgress('c')).done).toBe(false)
    completeDaily('c', { stars: 1, score: 50 }, picks)
    expect(overallDaily(picks)).toMatchObject({ complete: true, streak: 1 })
    expect(getProgress('c').daily.streak).toBe(1)
    completeDaily('c', { stars: 1, score: 50 }, picks) // replay: no double count
    expect(overallDaily(picks).streak).toBe(1)

    day('06')
    expect(todayKey()).toBe('2026-11-06')
    expect(overallDaily(picks)).toMatchObject({ complete: false, streak: 1 }) // still alive today
    picks.forEach(id => completeDaily(id, { stars: 3, score: 1 }, picks))
    expect(overallDaily(picks).streak).toBe(2)

    day('08') // skipped the 7th
    expect(overallDaily(picks).streak).toBe(0)
    picks.forEach(id => completeDaily(id, { stars: 3, score: 1 }, picks))
    expect(overallDaily(picks).streak).toBe(1)
  })
})
