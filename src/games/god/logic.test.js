import { describe, expect, it } from 'vitest'
import {
  GODS, blockedBy, countSolutions, generateLevel, hintFor, isValidSolution, neighbours8,
  realmsConnected, sizeFor, solveByLogic,
} from './logic'

const check = p => {
  const { n, regions, solution, gods, target } = p
  expect(regions).toHaveLength(n * n)
  expect(new Set(regions).size).toBe(n)                    // n realms
  expect(realmsConnected(regions, n)).toBe(true)          // each realm is one blob
  expect(solution.every((cell, g) => regions[cell] === g)).toBe(true) // god under own colour
  expect(isValidSolution(solution, regions, n)).toBe(true) // rows / cols / no touching
  expect(countSolutions(regions, n, 2)).toBe(1)            // exactly one answer
  const logic = solveByLogic(regions, n)                   // reachable without guessing
  expect(logic.solved).toBe(true)
  expect(logic.gods).toEqual([...solution].sort((a, b) => a - b))
  expect(new Set(gods.map(g => g.id)).size).toBe(n)
  expect(target).toBeGreaterThanOrEqual(0)
  expect(target).toBeLessThan(n)
}

describe('find god rules', () => {
  it('sizes grow from 5×5 to 9×9', () => {
    expect([1, 2, 3, 5, 6, 9, 10, 14, 15, 99].map(sizeFor)).toEqual([5, 5, 6, 6, 7, 7, 8, 8, 9, 9])
    expect(GODS.length).toBeGreaterThanOrEqual(9)
  })

  it('a god blocks its row, column, realm and all 8 neighbours', () => {
    const n = 5
    const regions = Array.from({ length: 25 }, (_, i) => i % 5) // columns as realms
    const b = blockedBy(12, regions, n)
    for (const j of neighbours8(12, n)) expect(b.has(j)).toBe(true)
    expect(b.has(10) && b.has(2) && b.has(22)).toBe(true)
    expect(b.has(0) || b.has(12)).toBe(false)
  })
})

describe('level generator', () => {
  it('is deterministic per seed', () => {
    const a = generateLevel('god:L4', 4), b = generateLevel('god:L4', 4)
    expect(a.regions).toEqual(b.regions)
    expect(a.solution).toEqual(b.solution)
    expect(a.target).toBe(b.target)
  })

  it('builds valid, unique, logic-solvable boards for campaign levels 1–20', () => {
    for (let level = 1; level <= 20; level++) check(generateLevel(`god:L${level}`, level))
  })

  it('builds valid boards across many seeds and every size', () => {
    for (const level of [1, 3, 6, 10, 15]) {
      for (let s = 0; s < 12; s++) check(generateLevel(`seed-${s}`, level))
    }
  }, 60000)
})

describe('hints', () => {
  const p = generateLevel('god:L6', 6)
  const none = new Map()

  it('first hint is a correct deduction', () => {
    const h = hintFor(p, new Set(), none)
    if (h.type === 'clear') expect(p.solution[p.regions[h.cell]]).not.toBe(h.cell)
    else expect(h.type === 'god' && p.solution[p.regions[h.cell]]).toBe(h.cell)
  })

  it('flags a discarded god cell first', () => {
    const godCell = p.solution[0]
    expect(hintFor(p, new Set([godCell]), none)).toMatchObject({ type: 'wrongMark', cell: godCell })
  })

  it('following hints alone always reaches the requested god', () => {
    const marks = new Set(), found = new Map()
    for (let i = 0; i < p.n * p.n * 2; i++) {
      const h = hintFor(p, marks, found)
      expect(h.type).not.toBe('wrongMark')
      if (h.type === 'clear') { expect(p.solution[p.regions[h.cell]]).not.toBe(h.cell); marks.add(h.cell); continue }
      expect(p.solution[p.regions[h.cell]]).toBe(h.cell)
      if (p.regions[h.cell] === p.target) return
      found.set(p.regions[h.cell], h.cell)
    }
    throw new Error('hints never led to the god')
  })
})
