import { describe, expect, it } from 'vitest'
import { assertEngine, validateEngine } from '../../platform/engine'
import { CAPACITY, countColors, isSolved, validateBottles } from './logic'
import {
  MAX_COLORS, MAX_DIFFICULTY, RAMP_END_LEVEL, evaluateDifficulty, generateLevel, levelConfig, levelParams, mixTarget,
  replaySolves, reversePours, seedFor, solvedPosition, validateLevel,
} from './generator'
import { buildLevel as build, engine } from './engine'
import { solve } from './solver'

// The engine keeps only a few levels in memory; these tests look at hundreds, so they keep their own.
const memo = new Map()
const buildLevel = n => {
  if (!memo.has(n)) memo.set(n, build(n))
  return memo.get(n)
}

describe('deterministic generation', () => {
  it('gives the identical level for the same seed and config', () => {
    const cfg = levelConfig(12)
    expect(generateLevel('seed-a', cfg)).toEqual(generateLevel('seed-a', cfg))
  })

  it('gives a different level for a different seed', () => {
    const cfg = levelConfig(30)
    expect(generateLevel('seed-a', cfg).bottles).not.toEqual(generateLevel('seed-b', cfg).bottles)
  })

  it('rejects impossible configs', () => {
    expect(() => generateLevel('x', { colors: 0 })).toThrow(RangeError)
    expect(() => generateLevel('x', { colors: MAX_COLORS + 1 })).toThrow(RangeError)
    expect(() => generateLevel('x', { empties: 0 })).toThrow(RangeError)
  })
})

describe('reverse pours', () => {
  it('each one has a forward pour that undoes it exactly', () => {
    const start = solvedPosition(3, 2)
    for (const [from, to, k] of reversePours(start)) {
      const mixed = start.map(b => b.slice())
      const color = mixed[from][mixed[from].length - 1]
      mixed[from].length -= k
      for (let i = 0; i < k; i++) mixed[to].push(color)
      // Playing the forward pour to -> from must put the same units back.
      expect(replaySolves(mixed, [[to, from]])).toBe(true)
    }
  })
})

describe('every generated level is valid and solvable', () => {
  const levels = [...Array.from({ length: 110 }, (_, i) => i + 1), 146, 250, 5000]
  it('passes the structural checks, is not solved, and has a replayable solution', () => {
    for (const n of levels) {
      const lv = buildLevel(n)
      const { colors, empties, capacity } = levelParams(n)
      expect(validateBottles(lv.bottles, capacity)).toEqual({ ok: true, errors: [] })
      expect(validateLevel(lv)).toEqual({ ok: true, errors: [] })
      expect(isSolved(lv.bottles, capacity)).toBe(false)
      expect(countColors(lv.bottles)).toBe(colors)
      expect(lv.bottles).toHaveLength(colors + empties)
      expect(lv.bottles.filter(b => b.length === 0)).toHaveLength(empties)
      expect(lv.bottles.every(b => b.length === 0 || b.length === CAPACITY)).toBe(true)
      expect(replaySolves(lv.bottles, lv.solution)).toBe(true)
    }
  })

  it('is also solved by the independent solver', () => {
    for (const n of levels) expect(solve(buildLevel(n).bottles).solved, `level ${n}`).toBe(true)
  })
})

describe('validateLevel', () => {
  const good = generateLevel('v', levelConfig(8))

  it('rejects solved, miscounted, cramped and solution-less levels', () => {
    expect(validateLevel(null).ok).toBe(false)
    expect(validateLevel({ ...good, bottles: solvedPosition(3, 2) }).errors).toContain('level is already solved')
    expect(validateLevel({ ...good, bottles: good.bottles.map((b, i) => (i === 0 ? b.slice(1) : b)) }).ok).toBe(false)
    expect(validateLevel({ ...good, solution: [] }).errors).toContain('level has no valid solution')
    expect(validateLevel({ ...good, solution: [[0, 0]] }).ok).toBe(false)
    const full = [[0, 1, 0, 1], [1, 0, 1, 0]]
    expect(validateLevel({ bottles: full, solution: [], colors: 2 }).errors).toContain('level needs at least one empty bottle')
  })
})

describe('level set-up follows the difficulty table', () => {
  const inRange = (n, [lo, hi]) => n >= lo && n <= hi
  const tiers = [
    [1, 5, [3, 4], [2, 3], [1, 2]],
    [6, 15, [4, 6], [3, 4], [2, 2]],
    [16, 30, [5, 7], [4, 5], [2, 2]],
    [31, 50, [6, 8], [5, 6], [2, 2]],
    [51, 100, [7, 10], [6, 8], [2, 2]],
    [101, 400, [8, 12], [7, 10], [2, 3]],
  ]
  it('keeps bottles, colours and empty bottles in each tier range', () => {
    for (const [from, to, bottles, colors, empties] of tiers) {
      for (let n = from; n <= to; n++) {
        const p = levelParams(n)
        expect(inRange(p.bottles, bottles), `bottles at ${n}`).toBe(true)
        expect(inRange(p.colors, colors), `colours at ${n}`).toBe(true)
        expect(inRange(p.empties, empties), `empties at ${n}`).toBe(true)
      }
    }
  })

  it('starts with two empty bottles in the first levels and never adds colours going backwards', () => {
    expect(levelParams(1).empties).toBe(2)
    expect(levelParams(1).colors).toBe(2)
    let prev = 0
    for (let n = 1; n <= 400; n++) {
      expect(levelParams(n).colors).toBeGreaterThanOrEqual(prev)
      prev = levelParams(n).colors
    }
  })

  it('treats junk level numbers as level 1', () => {
    expect(levelParams(0).level).toBe(1)
    expect(levelParams(NaN).level).toBe(1)
    expect(levelParams('abc').level).toBe(1)
    expect(seedFor(-5)).toBe(seedFor(1))
  })
})

describe('progression curve', () => {
  it('starts easy, rises gently, and holds at its cap after the ramp ends', () => {
    expect(mixTarget(1)).toBeCloseTo(0.3)
    expect(mixTarget(RAMP_END_LEVEL)).toBeCloseTo(0.62)
    for (let n = 1; n < 400; n++) expect(mixTarget(n + 1) - mixTarget(n)).toBeLessThan(0.02)
    expect(mixTarget(RAMP_END_LEVEL + 50)).toBe(mixTarget(RAMP_END_LEVEL))
  })

  it('never lets a level go over its difficulty cap, and the first level is easy', () => {
    for (let n = 1; n <= 200; n++) {
      const cfg = levelConfig(n)
      expect(buildLevel(n).difficulty).toBeLessThanOrEqual(cfg.maxDifficulty)
      expect(buildLevel(n).difficulty).toBeLessThanOrEqual(MAX_DIFFICULTY)
    }
    expect(buildLevel(1).difficulty).toBeLessThan(40)
  })

  it('rises over the campaign on average', () => {
    const avg = (a, b) => {
      let t = 0
      for (let n = a; n <= b; n++) t += buildLevel(n).difficulty
      return t / (b - a + 1)
    }
    expect(avg(1, 10)).toBeLessThan(avg(31, 40))
    expect(avg(31, 40)).toBeLessThan(avg(91, 100))
  })

  it('keeps making new variations at the cap after the ramp', () => {
    const a = buildLevel(300).bottles
    const b = buildLevel(301).bottles
    expect(a).not.toEqual(b)
    expect(levelParams(300).colors).toBeLessThanOrEqual(MAX_COLORS)
    expect(levelConfig(300).minTransitions).toBe(Math.ceil(mixTarget(300) * levelParams(300).colors * 3))
  })

  it('has no big jump between neighbouring levels', () => {
    for (let n = 1; n < 150; n++) expect(Math.abs(buildLevel(n + 1).difficulty - buildLevel(n).difficulty)).toBeLessThan(25)
  })
})

describe('evaluateDifficulty', () => {
  it('is clamped to the max and survives bad input', () => {
    const lv = buildLevel(200)
    expect(evaluateDifficulty(lv, 20)).toBeLessThanOrEqual(20)
    expect(evaluateDifficulty(lv, 0)).toBe(0)
    expect(evaluateDifficulty(null)).toBe(0)
    expect(evaluateDifficulty({ bottles: [] })).toBe(0)
    expect(evaluateDifficulty({ bottles: [[], []] })).toBe(0)
  })

  it('scores more colours and a more mixed position higher', () => {
    expect(evaluateDifficulty({ bottles: [[0, 0, 0, 0], [1, 1, 1, 1], [], []] })).toBeLessThan(
      evaluateDifficulty({ bottles: [[0, 1, 0, 1], [1, 0, 1, 0], [], []] }),
    )
    expect(buildLevel(1).difficulty).toBeLessThan(buildLevel(150).difficulty)
  })
})

describe('game-engine contract', () => {
  it('is implemented in full', () => {
    expect(validateEngine(engine)).toEqual({ ok: true, errors: [] })
    expect(assertEngine(engine, 'family')).toBe(engine)
  })

  it('gives a solution and a hint that work on a real level', () => {
    const lv = buildLevel(20)
    const sol = engine.getSolution(lv)
    expect(replaySolves(lv.bottles, sol)).toBe(true)
    expect(sol[0]).toEqual(engine.getHint(lv))
  })
})
