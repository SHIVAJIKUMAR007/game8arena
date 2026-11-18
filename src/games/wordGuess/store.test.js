import { describe, expect, it } from 'vitest'
import { readSave, readStats, recordResult, summarize } from './store'

describe('saved statistics', () => {
  it('starts empty and survives missing or corrupted data', () => {
    const empty = { played: 0, wins: 0, streak: 0, maxStreak: 0, guessTotal: 0, dist: [0, 0, 0, 0, 0, 0] }
    expect(readStats({})).toEqual(empty)
    expect(readStats(null)).toEqual(empty)
    expect(readStats({ wordStats: 'oops' })).toEqual(empty)
    expect(readStats({ wordStats: { played: -3, wins: NaN, dist: 'x', streak: Infinity } })).toEqual(empty)
    // impossible values are clamped: wins can't exceed played, streaks can't exceed wins
    expect(readStats({ wordStats: { played: 1, wins: 4, streak: 9, maxStreak: 2 } })).toMatchObject({ played: 4, wins: 4, streak: 4, maxStreak: 4 })
  })

  it('records wins, losses, streaks and the guess distribution', () => {
    let s = {}
    s = recordResult(s, { won: true, guesses: 3 })
    s = recordResult(s, { won: true, guesses: 4 })
    s = recordResult(s, { won: false, guesses: 6 })
    s = recordResult(s, { won: true, guesses: 2 })
    expect(s).toEqual({ played: 4, wins: 3, streak: 1, maxStreak: 2, guessTotal: 9, dist: [0, 1, 1, 1, 0, 0] })
    expect(summarize(s)).toMatchObject({ winPct: 75, average: 3 })
    expect(summarize({})).toMatchObject({ winPct: 0, average: 0 })
  })
})

describe('saved word in progress', () => {
  const p = { wordSaves: { campaign: { key: 'L4', guesses: ['crane', 'ZZZZZ', 'Slate', 42], given: [1, 1, 9, 'x', 2], hard: 1 } } }

  it('only resumes the matching puzzle', () => {
    expect(readSave(p, 'campaign', 'L5')).toBeNull()
    expect(readSave(p, 'daily', 'L4')).toBeNull()
    expect(readSave({}, 'campaign', 'L4')).toBeNull()
    expect(readSave({ wordSaves: 'junk' }, 'campaign', 'L4')).toBeNull()
  })

  it('drops invalid guesses and hint positions', () => {
    expect(readSave(p, 'campaign', 'L4')).toEqual({ key: 'L4', guesses: ['crane', 'slate'], given: [1, 2], hard: true, recorded: false })
  })
})
