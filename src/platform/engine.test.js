import { describe, expect, it } from 'vitest'
import { assertEngine, clampDifficulty, rampTarget, validateEngine } from './engine'
import { createRng } from './rng'
import { engine as minesweeper } from '../games/minesweeper/levels'
import { engine as wordGuess } from '../games/wordGuess/levels'
import { engine as solitaire } from '../games/solitaire/levels'

describe('game-engine contract', () => {
  it('accepts engines with the required methods', () => {
    const ok = { generateLevel() {}, validateLevel() {}, evaluateDifficulty() {} }
    expect(validateEngine(ok)).toEqual({ ok: true, errors: [] })
    expect(validateEngine({ ...ok, getHint() {}, getSolution() {} }).ok).toBe(true)
    expect(assertEngine(ok, 'test')).toBe(ok)
  })

  it('reports what is missing or wrong, without throwing', () => {
    expect(validateEngine(null)).toEqual({ ok: false, errors: ['engine must be an object'] })
    expect(validateEngine({ generateLevel() {} }).errors).toEqual(['validateLevel must be a function', 'evaluateDifficulty must be a function'])
    expect(validateEngine({ generateLevel() {}, validateLevel() {}, evaluateDifficulty() {}, getHint: 3 }).errors).toEqual(['getHint must be a function when present'])
    expect(() => assertEngine({}, 'broken')).toThrow(/broken does not implement/)
  })

  it('is met by every game that exports an engine', () => {
    for (const e of [minesweeper, wordGuess, solitaire]) expect(validateEngine(e)).toEqual({ ok: true, errors: [] })
  })
})

describe('difficulty helpers', () => {
  it('clamps difficulty into range', () => {
    expect(clampDifficulty(150)).toBe(100)
    expect(clampDifficulty(-3)).toBe(0)
    expect(clampDifficulty(70, 60)).toBe(60)
    expect(clampDifficulty('x')).toBe(0)
    expect(clampDifficulty(NaN)).toBe(0)
  })

  it('ramps from start to end with no big steps, then holds at the cap', () => {
    const ramp = { start: 10, end: 60, maxLevel: 40 }
    expect(rampTarget(1, ramp)).toBe(10)
    expect(rampTarget(40, ramp)).toBe(60)
    expect(rampTarget(41, ramp)).toBe(60)
    expect(rampTarget(9999, ramp)).toBe(60)
    expect(rampTarget(0, ramp)).toBe(10)
    const maxStep = (2 * (ramp.end - ramp.start)) / (ramp.maxLevel - 1)
    for (let L = 2; L <= 60; L++) {
      const step = rampTarget(L, ramp) - rampTarget(L - 1, ramp)
      expect(step).toBeGreaterThanOrEqual(0)
      expect(step).toBeLessThanOrEqual(maxStep)
    }
  })
})

describe('seeded random numbers', () => {
  it('repeat exactly for the same seed', () => {
    const a = createRng('engine:seed')
    const b = createRng('engine:seed')
    const xs = Array.from({ length: 20 }, () => a.next())
    expect(Array.from({ length: 20 }, () => b.next())).toEqual(xs)
    expect(createRng('engine:other').next()).not.toBe(xs[0])
    expect(createRng(7).shuffle([1, 2, 3, 4, 5])).toEqual(createRng(7).shuffle([1, 2, 3, 4, 5]))
  })
})
