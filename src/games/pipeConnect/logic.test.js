import { describe, expect, it } from 'vitest'
import { createRng } from '../../platform/rng'
import {
  E, N, S, SIDES, W, flowStatus, generateLevel, hintCell, isFixed, openSides, paramsFor, rotateMask,
  spanningTree, step, timeFor, turnsToSolve,
} from './logic'

const solvedRot = p => p.start.map((r, i) => r + turnsToSolve(p, p.start, i))

describe('pieces', () => {
  it('rotates masks clockwise', () => {
    expect(rotateMask(N)).toBe(E)
    expect(rotateMask(W)).toBe(N)
    expect(rotateMask(N | E, 1)).toBe(E | S)
    expect(rotateMask(N | S, 2)).toBe(N | S)
    expect(rotateMask(N | E | S, -1)).toBe(W | N | E)
    expect(rotateMask(15, 3)).toBe(15)
  })
})

describe('generator', () => {
  it('builds a spanning tree: n²−1 matching edges, everything connected', () => {
    for (const n of [4, 6, 8]) {
      const masks = spanningTree(n, createRng(`t${n}`))
      let edges = 0
      masks.forEach((m, i) => SIDES.forEach(s => {
        if (!(m & s.bit)) return
        const x = step(n, i, s)
        expect(x).toBeGreaterThanOrEqual(0)
        expect(masks[x] & s.opp).toBeTruthy()
        edges++
      }))
      expect(edges / 2).toBe(n * n - 1)
      const p = { n, solution: masks, source: 0, drains: [], locked: [], path: [] }
      expect(flowStatus(p, masks.map(() => 0)).wetCount).toBe(n * n)
    }
  })

  it('levels are deterministic, start unsolved, and solve when every piece is turned back', () => {
    for (const level of [1, 4, 8, 12, 18, 25, 32]) {
      const p = generateLevel(`pipe:L${level}`, level)
      expect(generateLevel(`pipe:L${level}`, level)).toBe(p)
      const { n, drains } = paramsFor(level)
      expect(p.n).toBe(n)
      expect(p.drains).toHaveLength(drains)
      expect(new Set([p.source, ...p.drains]).size).toBe(drains + 1)
      for (const x of [p.source, ...p.drains]) expect(openSides(p.solution[x])).toBe(1)
      expect(flowStatus(p, p.start).solved).toBe(false)
      expect(p.path[0]).toBe(p.source)
      for (const d of p.drains) expect(p.path).toContain(d)
      // Fixed pieces start in place.
      p.solution.forEach((_, i) => { if (isFixed(p, i)) expect(p.start[i]).toBe(0) })
      expect(flowStatus(p, solvedRot(p)).solved).toBe(true)
    }
  })

  it('grids and drains grow with the level; bolts appear from level 4', () => {
    expect([1, 4, 10, 15, 21].map(l => paramsFor(l).n)).toEqual([4, 5, 6, 7, 8])
    expect([1, 6, 15, 29].map(l => paramsFor(l).drains)).toEqual([1, 2, 3, 4])
    expect(generateLevel('pipe:L2', 2).locked.some(Boolean)).toBe(false)
    expect(generateLevel('pipe:L8', 8).locked.filter(Boolean)).toHaveLength(3)
  })
})

describe('flow and hints', () => {
  // 1×3 by hand: source (opens E) → straight (E–W, starts N–S) → drain (opens W).
  const p = { n: 3, solution: [E, E | W, W, 0, 0, 0, 0, 0, 0], source: 0, drains: [2], locked: [], path: [0, 1, 2], start: [0, 1, 0, 0, 0, 0, 0, 0, 0] }

  it('water only passes where both pipes open toward each other', () => {
    const before = flowStatus(p, p.start)
    expect([...before.wet.slice(0, 3)]).toEqual([1, 0, 0])
    expect(before.solved).toBe(false)
    const after = flowStatus(p, [0, 2, 0, 0, 0, 0, 0, 0, 0])
    expect(after).toMatchObject({ wetCount: 3, reached: 1, solved: true })
  })

  it('hints pick the first wrong route piece that can still turn', () => {
    expect(turnsToSolve(p, p.start, 1)).toBe(1)
    expect(hintCell(p, p.start)).toBe(1)
    expect(hintCell(p, p.start, new Set([1]))).toBe(-1)
    expect(hintCell(p, [0, 2, 0, 0, 0, 0, 0, 0, 0])).toBe(-1)
  })

  it('gives more time for more work, less as levels go up', () => {
    const a = generateLevel('pipe:L1', 1), b = generateLevel('pipe:L25', 25)
    expect(timeFor(a, 1)).toBeGreaterThan(15)
    expect(timeFor(b, 25)).toBeGreaterThan(timeFor(a, 1))
    expect(timeFor(b, 25)).toBeLessThan(timeFor(b, 1))
  })
})
