import { describe, expect, it } from 'vitest'
import { BEST_TIMES_KEPT, formatTime, readSave, readStats, recordResult, summarize } from './store'

const emptyMode = { played: 0, won: 0, times: [] }
const empty = {
  played: 0, won: 0, streak: 0, maxStreak: 0, totalTime: 0,
  modes: { beginner: emptyMode, intermediate: emptyMode, expert: emptyMode, level: emptyMode, daily: emptyMode },
}

describe('saved statistics', () => {
  it('start empty and survive missing or corrupted data', () => {
    expect(readStats({})).toEqual(empty)
    expect(readStats(null)).toEqual(empty)
    expect(readStats({ msStats: 'oops' })).toEqual(empty)
    expect(readStats({ msStats: [] })).toEqual(empty)
    expect(readStats({ msStats: { streak: -3, maxStreak: NaN, totalTime: Infinity, modes: 'x' } })).toEqual(empty)
    expect(readStats({ msStats: { modes: { beginner: { played: -1, won: 'a', times: 'fast' } } } })).toEqual(empty)
  })

  it('clamps impossible values', () => {
    // wins can't exceed games played, a streak can't exceed wins, and times must be positive numbers
    const s = readStats({ msStats: { streak: 9, maxStreak: 2, modes: { beginner: { played: 1, won: 4, times: [30, -5, 'x', 0, NaN, 12] } } } })
    expect(s.modes.beginner).toEqual({ played: 4, won: 4, times: [12, 30] })
    expect(s.streak).toBe(4)
    expect(s.maxStreak).toBe(4)
  })

  it('records wins, losses, streaks and best times per mode', () => {
    let s = {}
    s = recordResult(s, { mode: 'beginner', won: true, time: 50 })
    s = recordResult(s, { mode: 'beginner', won: true, time: 30 })
    s = recordResult(s, { mode: 'expert', won: false, time: 100 })
    s = recordResult(s, { mode: 'level', won: true, time: 20 })
    expect(s.played).toBe(4)
    expect(s.won).toBe(3)
    expect(s.streak).toBe(1)
    expect(s.maxStreak).toBe(2)
    expect(s.modes.beginner).toEqual({ played: 2, won: 2, times: [30, 50] })
    expect(s.modes.expert).toEqual({ played: 1, won: 0, times: [] })
    expect(s.totalTime).toBe(200)
  })

  it('keeps only the fastest times', () => {
    let s = {}
    for (const t of [90, 80, 70, 60, 50, 40, 100]) s = recordResult(s, { mode: 'intermediate', won: true, time: t })
    expect(s.modes.intermediate.times).toEqual([40, 50, 60, 70, 80])
    expect(s.modes.intermediate.times).toHaveLength(BEST_TIMES_KEPT)
  })

  it('a loss never adds a time', () => {
    const s = recordResult({}, { mode: 'beginner', won: false, time: 5 })
    expect(s.modes.beginner.times).toEqual([])
  })

  it('summarises win rate, average time and best times', () => {
    let s = {}
    s = recordResult(s, { mode: 'beginner', won: true, time: 40 })
    s = recordResult(s, { mode: 'beginner', won: true, time: 60 })
    s = recordResult(s, { mode: 'daily', won: false, time: 10 })
    const sum = summarize(s)
    expect(sum.winPct).toBe(67)
    expect(sum.averageTime).toBe(55)
    expect(sum.best.beginner).toBe(40)
    expect(sum.best.expert).toBeNull()
    expect(summarize({})).toMatchObject({ winPct: 0, averageTime: 0 })
  })
})

describe('saved game in progress', () => {
  const save = { key: 'L4', mode: 'campaign', seed: 'minesweeper:L4', firstIdx: 12, revealed: [12, 13, 13, -2, 'x', 1.5, 7], flags: [3, 3, 99999], elapsed: 41.26, hints: 2 }
  const p = { msSaves: { campaign: save } }

  it('only resumes the matching board', () => {
    expect(readSave(p, 'campaign', 'L5')).toBeNull()
    expect(readSave(p, 'daily', 'L4')).toBeNull()
    expect(readSave({}, 'campaign', 'L4')).toBeNull()
    expect(readSave({ msSaves: 'junk' }, 'campaign', 'L4')).toBeNull()
    expect(readSave({ msSaves: { campaign: null } }, 'campaign', 'L4')).toBeNull()
    expect(readSave(p, 'campaign')?.key).toBe('L4') // classic resumes by slot alone
  })

  it('drops invalid, duplicate and out-of-range indexes, and sorts the rest', () => {
    expect(readSave(p, 'campaign', 'L4')).toEqual({
      key: 'L4', mode: 'campaign', seed: 'minesweeper:L4', firstIdx: 12, revealed: [7, 12, 13], flags: [3], elapsed: 41, hints: 2,
    })
  })

  it('rejects a save with no usable first click', () => {
    for (const firstIdx of [undefined, -1, 1.5, 'a', 5000]) {
      expect(readSave({ msSaves: { campaign: { ...save, firstIdx } } }, 'campaign', 'L4')).toBeNull()
    }
    expect(readSave({ msSaves: { campaign: { ...save, key: 7 } } }, 'campaign')).toBeNull()
  })

  it('cleans nonsense times and hint counts', () => {
    const r = readSave({ msSaves: { campaign: { ...save, elapsed: -5, hints: 'many' } } }, 'campaign', 'L4')
    expect(r.elapsed).toBe(0)
    expect(r.hints).toBe(0)
    expect(readSave({ msSaves: { campaign: { ...save, elapsed: 1e12 } } }, 'campaign', 'L4').elapsed).toBe(86400)
  })
})

describe('formatTime', () => {
  it('shows minutes and seconds', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(9)).toBe('0:09')
    expect(formatTime(75)).toBe('1:15')
    expect(formatTime(3600)).toBe('60:00')
    expect(formatTime(-3)).toBe('0:00')
  })
})
