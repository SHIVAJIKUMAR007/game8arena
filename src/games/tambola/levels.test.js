import { describe, expect, it } from 'vitest'
import { assertEngine } from '../../platform/engine'
import { createRng } from '../../platform/rng'
import { RAMP, engine, evaluateDifficulty, generateLevel, getHint, getSolution, targetDifficulty, validateLevel } from './levels'
import { isGoalMet, ticketNumbers } from './ticket'

const LEVELS = Array.from({ length: 60 }, (_, i) => i + 1)
const cfg = level => ({ level })
const make = level => generateLevel(`tambola:L${level}`, cfg(level))

describe('tambola engine contract', () => {
  it('implements the shared engine interface', () => {
    expect(() => assertEngine(engine, 'tambola')).not.toThrow()
  })

  it('generates the same level for the same seed and config, and a different one for another seed', () => {
    expect(generateLevel('s', cfg(7))).toEqual(generateLevel('s', cfg(7)))
    expect(generateLevel('s', cfg(7))).not.toEqual(generateLevel('t', cfg(7)))
    expect(generateLevel('s', cfg(7)).calls).not.toEqual(generateLevel('s', cfg(8)).calls)
  })

  it('makes valid levels for every level on and past the ramp', () => {
    for (const l of [...LEVELS, 100, 500]) {
      const lv = make(l)
      expect(validateLevel(lv), `level ${l}`).toEqual({ ok: true, errors: [] })
    }
  })

  it('rejects broken levels without throwing', () => {
    const lv = make(10)
    expect(validateLevel(null).ok).toBe(false)
    expect(validateLevel({}).ok).toBe(false)
    expect(validateLevel({ ...lv, calls: lv.calls.slice(1) }).ok).toBe(false)
    expect(validateLevel({ ...lv, goal: 'bingo' }).ok).toBe(false)
    expect(validateLevel({ ...lv, winAt: lv.winAt + 1 }).ok).toBe(false)
    expect(validateLevel({ ...lv, interval: 10 }).ok).toBe(false)
  })

  it('can always be won: every bot claims after the player could, by at least the lead', () => {
    for (const l of LEVELS) {
      const lv = make(l)
      for (const bot of lv.bots) expect(bot.claimAt, `level ${l} ${bot.name}`).toBeGreaterThanOrEqual(lv.winAt + lv.params.lead)
    }
  })

  it('has a solution that completes the goal exactly at winAt', () => {
    for (const l of [1, 12, 25, 40, 55]) {
      const lv = make(l)
      const sol = getSolution(lv)
      const marked = new Set(sol.numbers)
      expect(isGoalMet(lv.goal, lv.tickets[sol.ticket], marked)).toBe(true)
      expect(Math.max(...sol.numbers.map(n => lv.calls.indexOf(n) + 1))).toBe(sol.claimAfter)
      expect(sol.claimAfter).toBe(lv.winAt)
    }
  })
})

describe('tambola progression', () => {
  it('starts easy: level 1 is a slow, small, solo earlyFive', () => {
    const lv = make(1)
    expect(lv.goal).toBe('earlyFive')
    expect(lv.tickets).toHaveLength(1)
    expect(lv.bots).toHaveLength(0)
    expect(lv.interval).toBeGreaterThanOrEqual(5500)
    expect(lv.difficulty).toBeLessThan(15)
  })

  it('never lets difficulty exceed the ramp end, and keeps making new levels at that cap', () => {
    const cap = evaluateDifficulty(make(RAMP.maxLevel)) // the hardest the ramp reaches
    expect(cap).toBeLessThanOrEqual(100)
    for (const l of [RAMP.maxLevel, 41, 80, 200, 1000]) {
      expect(make(l).difficulty).toBeCloseTo(cap, 5)
    }
    expect(make(41).calls).not.toEqual(make(80).calls) // still fresh variations
    expect(make(41).tickets).not.toEqual(make(80).tickets)
  })

  it('rises gradually: no step between consecutive levels is a spike, and the trend is up', () => {
    let prev = make(1).difficulty
    for (const l of LEVELS.slice(1)) {
      const d = make(l).difficulty
      expect(d - prev, `level ${l - 1} to ${l}`).toBeLessThanOrEqual(10)
      expect(d - prev, `level ${l - 1} to ${l}`).toBeGreaterThanOrEqual(-5) // small dips from rounding are fine
      prev = d
    }
    expect(make(40).difficulty).toBeGreaterThan(make(20).difficulty)
    expect(make(20).difficulty).toBeGreaterThan(make(5).difficulty)
  })

  it('respects a configured maximum difficulty at every level', () => {
    for (const maxDifficulty of [20, 45, 70]) {
      for (const l of LEVELS) {
        const lv = generateLevel(`cap:${l}`, { level: l, maxDifficulty })
        expect(lv.difficulty, `cap ${maxDifficulty} level ${l}`).toBeLessThanOrEqual(maxDifficulty)
        expect(validateLevel(lv).ok).toBe(true)
      }
    }
  })

  it('clamps targets and difficulty scores', () => {
    expect(targetDifficulty(1000, 50)).toBe(50)
    expect(targetDifficulty(-5)).toBeGreaterThanOrEqual(0)
    expect(evaluateDifficulty(null)).toBe(0)
    expect(evaluateDifficulty({ params: { goal: 'fullHouse', interval: 1, tickets: 99, bots: 99, lead: -9 }, maxDifficulty: 80 })).toBeLessThanOrEqual(80)
  })

  it('treats a bad level number as level 1', () => {
    expect(generateLevel('x', { level: 'abc' })).toEqual(generateLevel('x', { level: 1 }))
    expect(generateLevel('x', { level: -3 }).level).toBe(1)
  })
})

describe('tambola hints', () => {
  it('points at the next called number you still need, then at the claim, and waits otherwise', () => {
    const lv = make(3)
    const { numbers, claimAfter } = getSolution(lv)
    const first = getHint(lv, { called: 0, marked: [] })
    expect(first).toBeNull() // nothing called yet
    const hint = getHint(lv, { called: claimAfter, marked: [] })
    expect(hint.type).toBe('mark')
    expect(numbers).toContain(hint.number)
    expect(getHint(lv, { called: claimAfter, marked: numbers })).toEqual({ type: 'claim' })
    // Play it out with perfect marking: the hint sequence ends in a claim.
    const marked = []
    for (let i = 0; i < 20; i++) {
      const h = getHint(lv, { called: claimAfter, marked })
      if (h.type === 'claim') break
      marked.push(h.number)
    }
    expect(marked.slice().sort()).toEqual(numbers.slice().sort())
  })

  it('uses only a hint-free path that matches the ticket numbers', () => {
    const lv = make(30)
    const sol = getSolution(lv)
    const onTicket = new Set(ticketNumbers(lv.tickets[sol.ticket]))
    sol.numbers.forEach(n => expect(onTicket.has(n)).toBe(true))
  })
})

describe('seeded rng behind levels', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = createRng('seed'), b = createRng('seed')
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(Array.from({ length: 20 }, () => b.next()))
  })
})
