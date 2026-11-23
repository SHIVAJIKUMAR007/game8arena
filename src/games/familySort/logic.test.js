import { describe, expect, it } from 'vitest'
import {
  applyMove, canPour, isBottleDone, isSolved, legalMoves, pourAmount, topRun, transitions, validateBottles,
} from './logic'
import { findHint, solve } from './solver'

describe('pouring rules', () => {
  it('moves only the top run of one colour', () => {
    // bottle 0 = [red, blue, blue] (bottom first); the two blues are the top run
    expect(topRun([0, 1, 1])).toBe(2)
    expect(pourAmount([[0, 1, 1], []], 0, 1)).toBe(2)
  })

  it('pours onto an empty bottle or the same colour, never onto another colour', () => {
    expect(canPour([[0, 1], [2]], 0, 1)).toBe(false)
    expect(canPour([[0, 1], [1]], 0, 1)).toBe(true)
    expect(canPour([[0, 1], []], 0, 1)).toBe(true)
  })

  it('never pours a bottle into itself, from an empty bottle, or into a full one', () => {
    expect(canPour([[0, 1]], 0, 0)).toBe(false)
    expect(canPour([[], [0]], 0, 1)).toBe(false)
    expect(canPour([[1], [1, 1, 1, 1]], 0, 1)).toBe(false)
  })

  it('pours only as much as fits, and leaves the rest behind', () => {
    const b = [[1, 1, 1], [0, 1]] // target has room for two, source holds three
    expect(pourAmount(b, 0, 1)).toBe(2)
    const r = applyMove(b, 0, 1)
    expect(r.bottles).toEqual([[1], [0, 1, 1, 1]])
    expect(r.amount).toBe(2)
    expect(r.color).toBe(1)
  })

  it('does not change the position it was given, and returns null for an illegal pour', () => {
    const b = [[0, 1], [2]]
    expect(applyMove(b, 0, 1)).toBeNull()
    applyMove([[0, 0], []], 0, 1)
    expect(b).toEqual([[0, 1], [2]])
  })

  it('lists every legal pour', () => {
    expect(legalMoves([[0], [0], []])).toEqual([[0, 1], [0, 2], [1, 0], [1, 2]])
  })
})

describe('solved positions', () => {
  it('needs every bottle full of one colour or empty', () => {
    expect(isBottleDone([2, 2, 2, 2])).toBe(true)
    expect(isBottleDone([2, 2, 2])).toBe(false)
    expect(isSolved([[0, 0, 0, 0], [], [1, 1, 1, 1]])).toBe(true)
    expect(isSolved([[0, 0, 0, 1], [0, 1, 1, 1]])).toBe(false)
  })

  it('measures how mixed a position is', () => {
    expect(transitions([[0, 0, 0, 0]])).toBe(0)
    expect(transitions([[0, 1, 0, 1], []])).toBe(3)
  })
})

describe('validateBottles', () => {
  it('accepts a well-formed position', () => {
    expect(validateBottles([[0, 1, 0, 1], [1, 0, 1, 0], []]).ok).toBe(true)
  })

  it('rejects wrong colour counts, overfull bottles and bad values', () => {
    expect(validateBottles([[0, 0, 0], []]).errors[0]).toMatch(/colour 0 has 3 units/)
    expect(validateBottles([[0, 0, 0, 0, 0]]).errors.join()).toMatch(/over the capacity/)
    expect(validateBottles([[0, 0, 0, 'x']]).ok).toBe(false)
    expect(validateBottles([]).ok).toBe(false)
    expect(validateBottles(null).ok).toBe(false)
  })
})

describe('solver', () => {
  it('solves a small position and the moves really sort it', () => {
    const start = [[0, 1, 0, 1], [1, 0, 1, 0], [], []]
    const r = solve(start)
    expect(r.solved).toBe(true)
    let cur = start
    for (const [f, t] of r.moves) cur = applyMove(cur, f, t).bottles
    expect(isSolved(cur)).toBe(true)
    expect(findHint(start)).toEqual(r.moves[0])
  })

  it('returns no moves for a solved position and gives up on a stuck one', () => {
    expect(solve([[0, 0, 0, 0], []])).toEqual({ solved: true, moves: [], nodes: 0 })
    // Two colours, no empty bottle and no matching tops: nothing can ever move.
    const stuck = [[0, 1, 0, 1], [1, 0, 1, 0]]
    expect(solve(stuck).solved).toBe(false)
    expect(findHint(stuck)).toBeNull()
  })

  it('stops at its search limit instead of running forever', () => {
    const r = solve([[0, 1, 2, 3], [3, 2, 1, 0], [1, 0, 3, 2], [2, 3, 0, 1], [], []], { maxNodes: 1 })
    expect(r.nodes).toBeLessThanOrEqual(1)
  })
})
