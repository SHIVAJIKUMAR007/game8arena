import { describe, expect, it } from 'vitest'
import { ANSWERS, MAX_GUESSES, VALID_WORDS, evaluateGuess, patternKey } from './logic'
import {
  DAILY_POOL, DAILY_TIERS, TIERS, TIER_COUNT, TIER_STARTS, dailyPuzzle, dayNumber, engine, evaluateDifficulty,
  generateLevel, neighbours, tierForLevel, validateLevel,
} from './levels'
import { patternCode, solveDepths } from './solver'
import { COMMON } from './dictionary'

describe('difficulty', () => {
  it('scores familiarity, rare letters, repeats and ambiguity', () => {
    const easy = evaluateDifficulty('raise')
    expect(easy).toMatchObject({ familiarity: 1, repeats: 0 })
    expect(evaluateDifficulty('jolly').repeats).toBe(1) // the double L
    expect(evaluateDifficulty('fudge').familiarity).toBe(3)
    expect(evaluateDifficulty('fudge').rarity).toBeGreaterThan(easy.rarity)
    expect(neighbours('light')).toBeGreaterThanOrEqual(3) // fight, might, night, right, sight, tight, eight…
    expect(evaluateDifficulty('light').score).toBeGreaterThan(evaluateDifficulty('heart').score)
  })

  it('tiers split every answer once, ordered from easy to hard', () => {
    expect(TIERS).toHaveLength(TIER_COUNT)
    expect(TIERS.flat().sort()).toEqual([...ANSWERS].sort())
    const avg = t => t.reduce((s, w) => s + evaluateDifficulty(w).score, 0) / t.length
    for (let t = 1; t < TIER_COUNT; t++) expect(avg(TIERS[t])).toBeGreaterThan(avg(TIERS[t - 1]))
  })

  it('the first tier is everyday words only', () => {
    expect(TIERS[0].every(w => COMMON.includes(w))).toBe(true)
  })
})

describe('level generation', () => {
  it('is deterministic', () => {
    for (const L of [1, 7, 20, 43, 500]) expect(generateLevel(L)).toEqual(generateLevel(L))
  })

  it('every generated level passes validation', () => {
    for (let L = 1; L <= 400; L++) {
      const p = generateLevel(L)
      expect(validateLevel(p), `level ${L}`).toEqual({ ok: true, errors: [] })
    }
  })

  it('difficulty rises gradually and stops at the maximum', () => {
    const tiers = Array.from({ length: 300 }, (_, i) => tierForLevel(i + 1))
    for (let i = 1; i < tiers.length; i++) expect(tiers[i] - tiers[i - 1]).toBeGreaterThanOrEqual(0)
    for (let i = 1; i < tiers.length; i++) expect(tiers[i] - tiers[i - 1]).toBeLessThanOrEqual(1)
    expect(tierForLevel(1)).toBe(1)
    expect(tierForLevel(TIER_STARTS.at(-1))).toBe(TIER_COUNT)
    expect(tierForLevel(10_000)).toBe(TIER_COUNT)
    expect(tierForLevel(0)).toBe(1)
  })

  it('never repeats an answer until the pool is exhausted, and keeps going after', () => {
    const maxStart = TIER_STARTS.at(-1)
    const pool = TIERS[TIER_COUNT - 1]
    const seen = []
    for (let L = 1; L < maxStart + pool.length; L++) seen.push(generateLevel(L).answer)
    expect(new Set(seen).size).toBe(seen.length) // whole campaign up to one full pass of the max tier
    // The next pass reuses the max-tier words in a fresh order, with no back-to-back repeat.
    const pass2 = Array.from({ length: pool.length }, (_, i) => generateLevel(maxStart + pool.length + i).answer)
    expect(new Set(pass2)).toEqual(new Set(pool))
    expect(pass2[0]).not.toBe(seen.at(-1))
  })

  it('validateLevel rejects bad puzzles', () => {
    expect(validateLevel({ answer: 'zzzzz', tier: 1 }).ok).toBe(false)
    expect(validateLevel({ answer: 'books', tier: 1 }).errors).toContain('answer is not in the approved answer list')
    expect(validateLevel({ answer: TIERS[0][0], tier: 9 }).errors).toContain('tier out of range')
    expect(validateLevel({ answer: TIERS[5][0], tier: 1 }).errors).toContain('answer is not in its tier')
    expect(validateLevel(null).ok).toBe(false)
  })

  it('exposes the shared engine interface', () => {
    const p = engine.generateLevel(3)
    expect(engine.getSolution(p)).toBe(p.answer)
    expect(engine.getHint(p, [], [])).toEqual({ index: 0, letter: p.answer[0] })
    expect(engine.validateLevel(p).ok).toBe(true)
    expect(engine.evaluateDifficulty(p.answer)).toEqual(p.difficulty)
  })
})

describe('daily word', () => {
  it('is the same for a given date and comes from the middle tiers', () => {
    const a = dailyPuzzle('2026-11-18')
    expect(dailyPuzzle('2026-11-18')).toEqual(a)
    expect(DAILY_TIERS).toContain(a.tier)
    expect(validateLevel(a).ok).toBe(true)
  })

  it('does not repeat until the daily pool runs out', () => {
    const size = DAILY_POOL.length
    const keyFor = n => new Date(n * 86400000).toISOString().slice(0, 10)
    const first = Math.ceil(dayNumber('2026-01-01') / size) * size // first day of a pass
    expect(dayNumber(keyFor(first))).toBe(first)
    const pass = Array.from({ length: size }, (_, i) => dailyPuzzle(keyFor(first + i)).answer)
    expect(new Set(pass)).toEqual(new Set(DAILY_POOL)) // each pool word exactly once
    expect(dailyPuzzle(keyFor(first + size)).answer).not.toBe(pass.at(-1)) // no back-to-back repeat between passes
  })
})

describe('solvability (every answer can be found within six guesses)', () => {
  it('the solver scores guesses exactly like the game', () => {
    const words = [...VALID_WORDS]
    const codes = w => Array.from(w, c => c.charCodeAt(0) - 97)
    for (let i = 0; i < 3000; i++) {
      const g = words[(i * 7919) % words.length], a = ANSWERS[(i * 104729) % ANSWERS.length]
      const key = patternKey(evaluateGuess(g, a))
      expect(patternCode(codes(g), codes(a)), `${g} vs ${a}`).toBe(parseInt(key, 3))
    }
  })

  it('normal mode: every answer within six guesses', () => {
    const depths = solveDepths()
    expect(depths.size).toBe(ANSWERS.length)
    const tooDeep = [...depths].filter(([, d]) => d > MAX_GUESSES).map(([w]) => w)
    expect(tooDeep).toEqual([])
  }, 60_000)

  it('hard mode: every answer within six guesses using only clue-consistent guesses', () => {
    const depths = solveDepths({ hard: true })
    const tooDeep = [...depths].filter(([, d]) => d > MAX_GUESSES).map(([w]) => w)
    expect(tooDeep).toEqual([])
  }, 60_000)
})
