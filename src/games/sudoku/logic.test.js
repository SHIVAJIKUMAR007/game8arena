import { describe, expect, it } from 'vitest'
import { countSolutions, generateLevel, isValidSolution, paramsFor, solve, conflicts } from './logic'
import { createRng } from '../../platform/rng'
import { randomSolution } from './logic'

describe('solutions', () => {
  it('builds a valid grid: every row, column and box holds 1-9', () => {
    const g = randomSolution(createRng('t'))
    expect(isValidSolution(g)).toBe(true)
    expect(conflicts(g).size).toBe(0)
  })
})

describe('levels', () => {
  it('are deterministic, valid, and have exactly one solution', () => {
    for (const level of [1, 6, 15, 30]) {
      const a = generateLevel('s', level)
      const b = generateLevel('s', level)
      expect(a.puzzle).toEqual(b.puzzle)
      expect(isValidSolution(a.solution)).toBe(true)
      a.puzzle.forEach((n, i) => { if (n) expect(n).toBe(a.solution[i]) })
      expect(countSolutions(a.puzzle)).toBe(1)
      expect(solve(a.puzzle)).toEqual(a.solution)
      expect(a.given.filter(Boolean).length).toBe(a.clues)
    }
  })

  it('give fewer clues as the level rises', () => {
    expect(paramsFor(1).clues).toBeGreaterThan(paramsFor(30).clues)
    expect(generateLevel('s', 1).clues).toBeGreaterThanOrEqual(generateLevel('s', 30).clues)
  })
})
