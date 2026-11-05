import { describe, expect, it } from 'vitest'
import { createRng } from '../../platform/rng'
import {
  adjacent, applySolution, extendStroke, generateLevel, hamiltonianPath, isConnected, livesLost,
  mergeStroke, nextHintColor, paramsFor, progress, startStroke,
} from './logic'

describe('generator', () => {
  it('builds a path through every cell', () => {
    for (const n of [5, 7, 9]) {
      const path = hamiltonianPath(n, createRng(`h${n}`))
      expect(new Set(path).size).toBe(n * n)
      for (let i = 1; i < path.length; i++) expect(adjacent(n, path[i - 1], path[i])).toBe(true)
    }
  })

  it('levels are deterministic and their solution fills the grid exactly', () => {
    for (const level of [1, 4, 9, 15, 23]) {
      const p = generateLevel(`connect:L${level}`, level)
      expect(generateLevel(`connect:L${level}`, level)).toBe(p)
      const { n, colors } = paramsFor(level)
      expect(p.n).toBe(n)
      expect(p.dots).toHaveLength(colors)
      expect(new Set(p.solution.flat()).size).toBe(n * n)
      p.solution.forEach((s, c) => {
        expect(s.length).toBeGreaterThanOrEqual(3)
        expect([s[0], s.at(-1)]).toEqual(p.dots[c])
      })
      expect(progress(p, p.solution).solved).toBe(true)
    }
  })

  it('grids grow with the level', () => {
    expect([1, 4, 9, 15, 23].map(l => paramsFor(l).n)).toEqual([5, 6, 7, 8, 9])
  })
})

describe('drawing rules', () => {
  // 3×3 by hand: colour 0 joins 0→7 down the left and along the bottom, colour 1 joins 2→8 through the middle.
  const p = { n: 3, dots: [[0, 7], [2, 8]], solution: [[0, 3, 6, 7], [2, 1, 4, 5, 8]] }
  const empty = [[], []]

  it('starts only on dots or existing pipes', () => {
    expect(startStroke(p, empty, 4)).toBeNull()
    expect(startStroke(p, empty, 0)).toEqual({ color: 0, path: [0] })
    expect(startStroke(p, [[0, 3, 6, 7], []], 3)).toEqual({ color: 0, path: [0, 3] })
  })

  it('extends to neighbours, treats other dots as walls, and stops once joined', () => {
    let s = startStroke(p, empty, 0)
    expect(extendStroke(p, s, 4)).toBeNull()             // not adjacent
    s = extendStroke(p, s, 1)
    expect(extendStroke(p, s, 2)).toBeNull()             // colour 1's dot
    s = extendStroke(p, s, 0)                            // back-track
    expect(s.path).toEqual([0])
    s = extendStroke(p, extendStroke(p, extendStroke(p, s, 3), 6), 7)
    expect(isConnected(p, 0, s.path)).toBe(true)
    expect(extendStroke(p, s, 8)).toBeNull()             // joined: no further
  })

  it('drawing across another pipe cuts it, and backing off restores it', () => {
    const paths = [[], [2, 1, 4, 5, 8]]
    const s = { color: 0, path: [0, 3, 4] }
    expect(mergeStroke(paths, s)[1]).toEqual([2, 1])
    expect(mergeStroke(paths, { color: 0, path: [0, 3] })[1]).toEqual([2, 1, 4, 5, 8])
  })

  it('needs every pair joined and every square filled', () => {
    expect(progress(p, [[0, 3, 6, 7], [2, 5, 8]])).toMatchObject({ connected: 2, solved: false })
    expect(progress(p, p.solution)).toMatchObject({ connected: 2, solved: true, filled: 1 })
  })

  it('hints draw the first colour that is not yet right', () => {
    expect(nextHintColor(p, empty)).toBe(0)
    const after = applySolution(p, [[], [2, 1, 4, 3]], 0)
    expect(after).toEqual([[0, 3, 6, 7], [2, 1, 4]])
    expect(nextHintColor(p, [[7, 6, 3, 0], p.solution[1]])).toBe(-1) // reversed path still counts
  })

  it('move budget', () => {
    expect(livesLost(5, 10)).toBe(0)
    expect(livesLost(5, 11)).toBe(1)
    expect(livesLost(5, 99)).toBe(3)
  })
})
