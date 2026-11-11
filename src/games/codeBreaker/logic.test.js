import { describe, expect, it } from 'vitest'
import { allCodes, brokenClue, fits, generateLevel, hintSpot, paramsFor, possibleCount, score } from './logic'

describe('scoring', () => {
  it('counts exact and close pegs, each secret peg once', () => {
    expect(score([0, 1, 2, 3], [0, 1, 2, 3])).toEqual({ exact: 4, close: 0 })
    expect(score([0, 1, 2, 3], [3, 2, 1, 0])).toEqual({ exact: 0, close: 4 })
    expect(score([0, 1, 2, 3], [0, 2, 4, 5])).toEqual({ exact: 1, close: 1 })
    expect(score([0, 0, 1, 1], [0, 1, 0, 0])).toEqual({ exact: 1, close: 2 })
    expect(score([1, 2, 2, 3], [2, 2, 2, 2])).toEqual({ exact: 2, close: 0 })
    expect(score([0, 1, 2], [5, 5, 5])).toEqual({ exact: 0, close: 0 })
  })
})

describe('levels', () => {
  it('codes are deterministic and follow the level rules', () => {
    for (const level of [1, 4, 8, 12, 18, 25]) {
      const p = generateLevel(`code:L${level}`, level)
      expect(generateLevel(`code:L${level}`, level).code).toEqual(p.code)
      const { length, colors, repeats } = paramsFor(level)
      expect(p.code).toHaveLength(length)
      p.code.forEach(c => { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThan(colors) })
      if (!repeats) expect(new Set(p.code).size).toBe(length)
    }
  })

  it('gets harder: longer codes, more colours, then repeats', () => {
    expect([1, 3, 6, 10, 16, 23].map(l => paramsFor(l)).map(x => `${x.length}/${x.colors}/${x.repeats}`))
      .toEqual(['3/4/false', '4/5/false', '4/6/false', '4/6/true', '5/7/true', '5/8/true'])
    expect(allCodes(paramsFor(1))).toHaveLength(4 * 3 * 2)
    expect(allCodes(paramsFor(23))).toHaveLength(8 ** 5)
  })
})

describe('deduction', () => {
  const p = { length: 3, colors: 4, repeats: false, code: [0, 1, 2] }
  const rows = [{ guess: [0, 2, 3], exact: 1, close: 1 }]

  it('keeps only codes that fit every clue', () => {
    expect(fits(p, rows, new Map(), p.code)).toBe(true)
    expect(fits(p, rows, new Map(), [0, 2, 3])).toBe(false)
    expect(possibleCount(p, [], new Map())).toBe(24)
    const n = possibleCount(p, rows, new Map())
    expect(n).toBeLessThan(24)
    expect(possibleCount(p, rows, new Map([[1, 1]]))).toBeLessThan(n)
  })

  it('names the clue a guess breaks', () => {
    expect(brokenClue(p, rows, new Map(), [0, 1, 2])).toBe(-1)
    expect(brokenClue(p, rows, new Map(), [0, 2, 3])).toBe(0) // repeating a scored guess
    expect(brokenClue(p, rows, new Map(), [1, 1, 2])).toBe(-2) // repeats not allowed
    expect(brokenClue(p, [], new Map([[0, 0]]), [1, 2, 3])).toBe(-2) // ignores a revealed spot
  })

  it('hints reveal left to right but never the whole code', () => {
    expect(hintSpot(p, new Map())).toBe(0)
    expect(hintSpot(p, new Map([[0, 0]]))).toBe(1)
    expect(hintSpot(p, new Map([[0, 0], [1, 1]]))).toBe(-1)
  })
})
