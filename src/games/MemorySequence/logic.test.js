import { describe, expect, it } from 'vitest'
import { PADS, layoutFor, paramsFor, sequenceFor } from './logic'

describe('Memory Sequence logic', () => {
  it('sequences are deterministic, in range, and never repeat a pad three times running', () => {
    const a = sequenceFor('memory:L7', 24, 6)
    expect(sequenceFor('memory:L7', 24, 6)).toEqual(a)
    expect(sequenceFor('memory:L8', 24, 6)).not.toEqual(a)
    expect(a.every(n => n >= 0 && n < 6)).toBe(true)
    for (let seed = 0; seed < 50; seed++) {
      const s = sequenceFor(`t${seed}`, 30, 4)
      for (let i = 2; i < s.length; i++) expect(s[i] === s[i - 1] && s[i] === s[i - 2]).toBe(false)
    }
  })

  it('a shorter sequence is a prefix of the longer one (each round adds a step)', () => {
    expect(sequenceFor('x', 24, 9).slice(0, 10)).toEqual(sequenceFor('x', 10, 9))
  })

  it('difficulty grows: more pads, longer targets, faster playback, then shuffling', () => {
    const [l1, l5, l10, l12, l30] = [1, 5, 10, 12, 30].map(paramsFor)
    expect([l1.pads, l5.pads, l10.pads]).toEqual([4, 6, 9])
    expect(l1).toMatchObject({ start: 1, target: 5, shuffle: false })
    expect(l10.target).toBeGreaterThan(l5.target)
    expect(l10.target - l10.start).toBe(5)
    expect(l10.flash).toBeLessThan(l1.flash)
    expect(l12.shuffle).toBe(true)
    expect(l30.flash).toBeGreaterThanOrEqual(190)
    expect(l30.target).toBe(24)
    expect(Math.max(...[1, 5, 10, 30].map(l => paramsFor(l).pads))).toBeLessThanOrEqual(PADS.length)
  })

  it('layouts are fixed until shuffling, then a permutation per round', () => {
    expect(layoutFor('s', 3, 4, false)).toEqual([0, 1, 2, 3])
    expect(layoutFor('s', 0, 9, true)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    const l = layoutFor('s', 3, 9, true)
    expect([...l].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(layoutFor('s', 3, 9, true)).toEqual(l)
  })
})
