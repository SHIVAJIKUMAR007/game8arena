import { describe, expect, it } from 'vitest'
import { validateEngine } from '../../platform/engine'
import { dealFromSeed } from './deal'
import { applyMove, canAutoFinish, createGame, hiddenCount, isWon, replay, validateMove } from './rules'
import {
  MAX_LEVEL, RAMPS, analyzeDeal, difficultyBand, difficultyLabel, engine, evaluateDifficulty, findHint, generateDeal,
  generateLevel, levelBand, levelTarget, makeSetup, maxDifficulty, parTime, planFinish, staticMetrics, timeBonus, validateLevel,
} from './levels'

describe('difficulty ramp', () => {
  it('starts easy and rises gradually up to a cap, in both draw modes', () => {
    for (const draw of [1, 3]) {
      expect(levelTarget(1, draw)).toBe(RAMPS[draw].start)
      expect(levelTarget(MAX_LEVEL, draw)).toBe(RAMPS[draw].end)
      for (let L = 2; L <= MAX_LEVEL + 20; L++) {
        const step = levelTarget(L, draw) - levelTarget(L - 1, draw)
        expect(step).toBeGreaterThanOrEqual(0)
        expect(step).toBeLessThanOrEqual(1.5) // no spikes between neighbouring levels
        expect(levelBand(L, draw).max).toBeLessThanOrEqual(maxDifficulty(draw))
      }
    }
  })

  it('keeps the same target after the last level', () => {
    expect(levelBand(MAX_LEVEL + 1)).toEqual(levelBand(MAX_LEVEL))
    expect(levelBand(MAX_LEVEL + 500, 3)).toEqual(levelBand(MAX_LEVEL, 3))
  })

  it('treats nonsense levels as level 1', () => {
    expect(levelBand(0)).toEqual(levelBand(1))
    expect(levelBand('x')).toEqual(levelBand(1))
    expect(levelBand(-4)).toEqual(levelBand(1))
  })

  it('labels scores and gives a sensible par time and bonus', () => {
    expect(difficultyLabel(5)).toBe('Gentle')
    expect(difficultyLabel(70)).toBe('Expert')
    expect(difficultyBand(5)).toBe(1)
    expect(difficultyBand(99)).toBe(5)
    expect(parTime(100)).toBe(360)
    expect(parTime(0)).toBe(240)
    expect(timeBonus(100, 300)).toBe(750)
    expect(timeBonus(900, 300)).toBe(0)
  })
})

describe('evaluating a deal', () => {
  it('measures hidden cards, opening moves and solver effort', () => {
    const deal = dealFromSeed('levels:eval')
    const m = staticMetrics(deal, 1)
    expect(m.burial).toBeGreaterThan(0)
    expect(m.mobility).toBeGreaterThanOrEqual(0)
    const a = analyzeDeal(deal, 1)
    expect(['solved', 'unsolved', 'unknown']).toContain(a.status)
    const score = evaluateDifficulty(m, a)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
    // the layout alone never scores higher than the layout plus the search
    expect(evaluateDifficulty(m)).toBeLessThanOrEqual(score)
  })

  it('rates draw three harder than draw one for the same cards', () => {
    let harder = 0
    for (let s = 0; s < 6; s++) {
      const deal = dealFromSeed(`levels:d3:${s}`)
      if (evaluateDifficulty(staticMetrics(deal, 3)) > evaluateDifficulty(staticMetrics(deal, 1))) harder++
    }
    expect(harder).toBeGreaterThanOrEqual(5)
  })
})

describe('generated levels', { timeout: 30000 }, () => {
  it('are the same every time for the same seed and settings', () => {
    const a = generateDeal('levels:det', { draw: 1, target: 20, min: 10, max: 30 })
    const b = generateDeal('levels:det', { draw: 1, target: 20, min: 10, max: 30 })
    expect(a.deal).toEqual(b.deal)
    expect(a.difficulty).toBe(b.difficulty)
    expect(engine.generateLevel('levels:engine', { target: 20 }).deal).toEqual(engine.generateLevel('levels:engine', { target: 20 }).deal)
  })

  it('level 1 is a gentle, winnable deal in draw one', () => {
    const p = generateLevel(1, 1)
    expect(p.solvable).toBe(true)
    expect(p.difficulty).toBeLessThanOrEqual(levelBand(1, 1).max)
    expect(difficultyBand(p.difficulty)).toBe(1)
    expect(validateLevel(p)).toEqual({ ok: true, errors: [] })
  })

  it('every level is winnable and never harder than its band allows', () => {
    for (const [L, draw] of [[1, 3], [2, 1], [7, 1], [15, 3], [30, 1], [MAX_LEVEL, 1], [MAX_LEVEL, 3]]) {
      const p = generateLevel(L, draw)
      expect(p.solvable, `level ${L} draw ${draw}`).toBe(true)
      expect(p.difficulty, `level ${L} draw ${draw}`).toBeLessThanOrEqual(levelBand(L, draw).max)
      expect(p.difficulty).toBeLessThanOrEqual(maxDifficulty(draw))
      const won = replay(p.deal, draw, p.analysis.solution)
      expect(isWon(won.state)).toBe(true)
    }
  })

  it('gets harder over the levels', () => {
    const early = [1, 2, 3].map(L => generateLevel(L, 1).difficulty)
    const late = [MAX_LEVEL - 1, MAX_LEVEL, MAX_LEVEL + 1].map(L => generateLevel(L, 1).difficulty)
    const avg = xs => xs.reduce((t, x) => t + x, 0) / xs.length
    expect(avg(late)).toBeGreaterThan(avg(early) + 15)
  })

  it('keeps making new deals past the last level, at the capped difficulty', () => {
    const deals = new Set()
    for (let L = MAX_LEVEL + 1; L <= MAX_LEVEL + 4; L++) {
      const p = generateLevel(L, 1)
      expect(p.solvable).toBe(true)
      expect(p.difficulty).toBeLessThanOrEqual(maxDifficulty(1))
      deals.add(JSON.stringify(p.deal))
    }
    expect(deals.size).toBe(4)
  })

  it('gives each mode, level and draw its own seed', () => {
    expect(makeSetup('campaign', { level: 4, draw: 1 }).seed).not.toBe(makeSetup('campaign', { level: 4, draw: 3 }).seed)
    expect(makeSetup('campaign', { level: 4 }).key).toBe('campaign:d1:L4')
    expect(makeSetup('random', { seed: 'abc', draw: 3 })).toMatchObject({ key: 'random:d3:abc', seedId: 'abc', draw: 3 })
    expect(() => makeSetup('daily')).toThrow()
  })
})

describe('validating levels', () => {
  it('rejects broken or impossible levels', () => {
    const p = generateLevel(1, 1)
    expect(validateLevel(null).ok).toBe(false)
    expect(validateLevel({ ...p, deal: { ...p.deal, stock: p.deal.stock.slice(1) } }).ok).toBe(false)
    expect(validateLevel({ ...p, draw: 2 }).errors).toContain('draw must be 1 or 3')
    expect(validateLevel({ ...p, difficulty: 99 }).errors).toContain('deal is harder than the maximum difficulty')
    expect(validateLevel({ ...p, solvable: false }).errors).toContain('deal has no known solution')
    const wrongLine = { ...p, analysis: { ...p.analysis, solution: p.analysis.solution.slice(0, 5) } }
    expect(validateLevel(wrongLine).errors).toContain('stored solution does not win the deal')
  })
})

describe('engine contract', { timeout: 30000 }, () => {
  it('implements the shared interface', () => {
    expect(validateEngine(engine)).toEqual({ ok: true, errors: [] })
    const level = engine.generateLevel('levels:contract', { draw: 1 })
    expect(engine.validateLevel(level).ok).toBe(true)
    expect(engine.evaluateDifficulty(level)).toBe(level.difficulty)
    expect(engine.getSolution(level)).toEqual(level.analysis.solution)
    const hint = engine.getHint(level)
    expect(validateMove(createGame(level.deal, 1), hint.move).ok).toBe(true)
    expect(hint.winnable).toBe(true)
  })

  it('gives hints that are legal moves from the current position', () => {
    const p = generateLevel(3, 1)
    const mid = replay(p.deal, 1, p.analysis.solution.slice(0, 20)).state
    const h = findHint(mid)
    expect(validateMove(mid, h.move).ok).toBe(true)
    expect(findHint(replay(p.deal, 1, p.analysis.solution).state)).toBeNull()
  })
})

describe('finishing for the player', { timeout: 30000 }, () => {
  /** The first position on a level's winning line where every column card is face up but cards are still in the stock or waste. */
  function faceUpWithStockLeft(level, draw) {
    const p = generateLevel(level, draw)
    let s = createGame(p.deal, draw)
    for (const m of p.analysis.solution) {
      if (hiddenCount(s) === 0 && (s.stock.length || s.waste.length)) return s
      s = applyMove(s, m).state
    }
    return null
  }
  const playOut = (s, line) => line.reduce((g, m) => { const r = applyMove(g, m); expect(r.ok).toBe(true); return r.state }, s)

  it('plans a finish once every column card is face up, even with cards left in the stock and waste', () => {
    for (const [level, draw] of [[1, 1], [4, 1], [2, 3]]) {
      const s = faceUpWithStockLeft(level, draw)
      expect(s, `level ${level} draw ${draw} reaches that position`).not.toBeNull()
      expect(canAutoFinish(s)).toBe(false) // the old rule would have waited for the stock and waste to empty
      const line = planFinish(s)
      expect(line).not.toBeNull()
      expect(isWon(playOut(s, line))).toBe(true)
    }
  })

  it('plays the last cards up one at a time when the stock is used up', () => {
    const p = generateLevel(1, 1)
    let s = createGame(p.deal, 1)
    for (const m of p.analysis.solution) { if (canAutoFinish(s)) break; s = applyMove(s, m).state }
    const line = planFinish(s)
    expect(line.every(m => m.type === 'move' && m.to === 'f' && m.count === 1)).toBe(true)
    expect(isWon(playOut(s, line))).toBe(true)
  })

  it('does not plan anything while a card is face down, or after the win', () => {
    const p = generateLevel(1, 1)
    expect(planFinish(createGame(p.deal, 1))).toBeNull()
    expect(planFinish(replay(p.deal, 1, p.analysis.solution).state)).toBeNull()
  })
})
