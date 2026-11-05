import { describe, expect, it } from 'vitest'
import { BANK } from './levels'
import { decode, encode, hintFor, isSolved, levelFor, livesLost, movesFrom, nextLossAt, puzzleForHash, range, solve } from './logic'

// Red car (A) on row 3 with a vertical car (B) blocking column 5 and a truck (C) underneath it.
const SMALL = [
  '......',
  '....B.',
  'AA..B.',
  '....C.',
  '....C.',
  '....C.',
].join('')

describe('rules', () => {
  it('decodes and re-encodes grids', () => {
    const p = decode(SMALL)
    expect(p.cars).toHaveLength(3)
    expect(p.cars[0]).toMatchObject({ len: 2, horiz: true, lane: 2, color: 'red' })
    expect(p.cars[1]).toMatchObject({ len: 2, horiz: false, lane: 4 })
    expect(p.cars[2]).toMatchObject({ len: 3, horiz: false, lane: 4 })
    expect(encode(p)).toBe(SMALL)
  })

  it('cars slide only along their lane and stop at other cars', () => {
    const p = decode(SMALL)
    expect(range(p, p.start, 0)).toEqual([0, 2])  // red stops at B
    expect(range(p, p.start, 1)).toEqual([0, 1])  // B can go up but not down into C
    expect(range(p, p.start, 2)).toEqual([3, 3])  // truck is wedged
    expect(movesFrom(p, p.start)).toEqual([[0, 1], [0, 2], [1, 0]])
  })

  it('solves optimally and replays to a solved state', () => {
    const p = decode(SMALL)
    const path = solve(p, p.start)
    expect(path).toEqual([{ car: 1, to: 0 }, { car: 0, to: 4 }])
    const end = p.start.slice()
    path.forEach(({ car, to }) => { end[car] = to })
    expect(isSolved(p, end)).toBe(true)
    expect(hintFor(p, p.start)).toEqual({ car: 1, to: 0, left: 2 })
  })

  it('reports impossible positions', () => {
    // Truck B can never leave row 3: the bottom row is jammed by two trucks that can't move.
    const p = decode(['....B.', '....B.', 'AA..B.', '......', '......', 'CCCDDD'].join(''))
    expect(solve(p, p.start)).toBeNull()
  })

  it('move budget: a life goes every `slack` moves past par', () => {
    // par 10 → slack 5: lives go after 15, 20, 25 moves
    expect(livesLost(10, 15)).toBe(0)
    expect(livesLost(10, 16)).toBe(1)
    expect(livesLost(10, 21)).toBe(2)
    expect(livesLost(10, 99)).toBe(3)
    expect(nextLossAt(10, 0)).toBe(16)
    expect(nextLossAt(10, 16)).toBe(21)
  })
})

describe('level bank', () => {
  it('has many levels sorted easy → hard', () => {
    expect(BANK.length).toBeGreaterThanOrEqual(50)
    for (let i = 1; i < BANK.length; i++) expect(BANK[i][1]).toBeGreaterThanOrEqual(BANK[i - 1][1])
    expect(BANK.at(-1)[1]).toBeGreaterThan(BANK[0][1] * 4)
  })

  it('every banked par is the true optimum', () => {
    for (const [grid, par] of BANK) {
      const p = decode(grid, par)
      expect(p.cars[0]).toMatchObject({ horiz: true, lane: 2 })
      expect(solve(p, p.start).length).toBe(par)
    }
  })

  it('serves campaign levels past the bank end and daily puzzles from a hash', () => {
    expect(levelFor(1).par).toBe(BANK[0][1])
    expect(levelFor(BANK.length + 5).par).toBeGreaterThan(0)
    expect(puzzleForHash(12345)).toEqual(puzzleForHash(12345))
  })
})
