import { describe, expect, it } from 'vitest'
import { createRng } from '../../platform/rng'
import { adjacentCounts, neighbours, placeMines } from './logic'
import { generateBoard } from './generator'
import { solve } from './solver'

const base = { w: 9, h: 9, mines: 10, seed: 'gen-test', firstIdx: 40 }
const sum = a => a.reduce((t, m) => t + m, 0)

describe('generateBoard', () => {
  it('is deterministic: the layout is exactly what the reported sub-seed produces', () => {
    const b = generateBoard(base)
    // Rebuild the layout from the documented seed scheme, independent of the generator's own cache.
    const again = placeMines(9, 9, b.mineCount, createRng(`gen-test@40#0.${b.attempt}`), 40)
    expect(Array.from(b.mines)).toEqual(Array.from(again))
    expect(Array.from(b.counts)).toEqual(Array.from(adjacentCounts(again, 9, 9)))
  })

  it('a different seed or a different first click gives a different board', () => {
    const a = generateBoard(base)
    const otherSeed = generateBoard({ ...base, seed: 'gen-test-2' })
    const otherClick = generateBoard({ ...base, firstIdx: 10 })
    expect(Array.from(otherSeed.mines)).not.toEqual(Array.from(a.mines))
    expect(Array.from(otherClick.mines)).not.toEqual(Array.from(a.mines))
  })

  it('always keeps the first click and its neighbours clear', () => {
    for (const first of [0, 8, 40, 80, 4, 36, 44]) {
      const b = generateBoard({ ...base, firstIdx: first, seed: `clear-${first}` })
      expect(b.mines[first]).toBe(0)
      neighbours(first, 9, 9).forEach(j => expect(b.mines[j]).toBe(0))
    }
  })

  it('returns a board the solver finishes without guessing, and says so', () => {
    for (let s = 0; s < 12; s++) {
      const b = generateBoard({ ...base, seed: `solvable-${s}`, firstIdx: 4 + s * 3 })
      expect(b.solvable).toBe(true)
      const check = solve({ w: 9, h: 9, mineCount: b.mineCount, mines: b.mines, counts: b.counts }, 4 + s * 3)
      expect(check.solved).toBe(true)
    }
  })

  it('rejects boards above the technique cap: a basic-only request never needs more than basic', () => {
    const b = generateBoard({ ...base, w: 8, h: 8, mines: 8, seed: 'basic-only', firstIdx: 27, maxTech: 'basic' })
    expect(b.analysis.hardest).toBe('basic')
    expect(b.analysis.techniques.subset + b.analysis.techniques.enum).toBe(0)
  })

  it('rejects boards that miss the required deductions when a better one exists', () => {
    const b = generateBoard({ w: 12, h: 12, mines: 22, seed: 'needs-advanced', firstIdx: 70, maxTech: 'subset', minAdvanced: 3, attempts: 120 })
    expect(b.requirementsMet).toBe(true)
    expect(b.analysis.advanced).toBeGreaterThanOrEqual(3)
  })

  it('honours the cap on exhaustive-search deductions', () => {
    const b = generateBoard({ w: 13, h: 13, mines: 28, seed: 'enum-cap', firstIdx: 84, maxTech: 'enum', minEnum: 1, maxEnum: 4, attempts: 120 })
    expect(b.analysis.techniques.enum).toBeLessThanOrEqual(4)
    expect(b.solvable).toBe(true)
  })

  it('takes mines off, never adds them, when a size cannot be made guess-free', () => {
    // 5x5 with 18 mines cannot be solved without guessing; the generator lowers the count until it can.
    const b = generateBoard({ w: 5, h: 5, mines: 18, seed: 'too-dense', firstIdx: 12, attempts: 8 })
    expect(b.mineCount).toBeLessThan(18)
    expect(sum(b.mines)).toBe(b.mineCount)
    expect(b.solvable).toBe(true)
  })

  it('classic boards keep their official mine count, and say when no guess-free layout was found', () => {
    const b = generateBoard({ w: 5, h: 5, mines: 18, seed: 'classic-dense', firstIdx: 12, attempts: 6, keepMines: true })
    expect(b.mineCount).toBe(18)
    expect(b.solvable).toBe(false)
    expect(sum(b.mines)).toBe(18)
  })

  it('handles the biggest classic board in reasonable time', () => {
    const start = Date.now()
    const b = generateBoard({ w: 30, h: 16, mines: 99, seed: 'expert-test', firstIdx: 15 * 30 / 2 + 8, attempts: 20, keepMines: true })
    expect(b.mineCount).toBe(99)
    expect(Date.now() - start).toBeLessThan(5000)
  })
})
