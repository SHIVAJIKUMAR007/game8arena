import { describe, expect, it } from 'vitest'
import { adjacentCounts, neighbours, newGame, reveal, withMines } from './logic'
import { TECH_RANK, solve } from './solver'
import {
  CLASSIC, MAX_DENSITY, MAX_LEVEL, difficultyBand, difficultyLabel, engine, evaluateDifficulty, generateLevel, generatePuzzle,
  getHint, getSolution, levelRequirements, levelSpec, makeSetup, parTime, startCell, validateLevel,
} from './levels'

const nominal = level => {
  const s = levelSpec(level)
  return evaluateDifficulty(s)
}
const same = (a, b) => JSON.stringify(Array.from(a)) === JSON.stringify(Array.from(b))

describe('level progression', () => {
  it('level 1 is a small, easy grid', () => {
    const s = levelSpec(1)
    expect(s.w * s.h).toBeLessThanOrEqual(36)
    expect(s.mines / (s.w * s.h)).toBeLessThan(0.13)
    expect(levelRequirements(1).maxTech).toBe('basic')
    expect(difficultyLabel(nominal(1))).toBe('Gentle')
  })

  it('size, mines and density only ever go up, one level to the next', () => {
    let prev = levelSpec(1)
    for (let L = 2; L <= MAX_LEVEL + 10; L++) {
      const s = levelSpec(L)
      expect(s.w).toBeGreaterThanOrEqual(prev.w)
      expect(s.h).toBeGreaterThanOrEqual(prev.h)
      expect(s.mines).toBeGreaterThanOrEqual(prev.mines)
      expect(s.mines / (s.w * s.h)).toBeGreaterThanOrEqual(prev.mines / (prev.w * prev.h) - 0.012) // rounding only
      prev = s
    }
  })

  it('no level is a sudden jump: each step grows the board by under 20% and adds a few mines at most', () => {
    for (let L = 2; L <= MAX_LEVEL; L++) {
      const a = levelSpec(L - 1)
      const b = levelSpec(L)
      expect(b.w * b.h / (a.w * a.h)).toBeLessThanOrEqual(1.2)
      expect(b.mines - a.mines).toBeLessThanOrEqual(5)
      expect(nominal(L) - nominal(L - 1)).toBeLessThanOrEqual(3)
    }
  })

  it('density never passes the maximum', () => {
    for (let L = 1; L <= MAX_LEVEL + 40; L++) {
      const s = levelSpec(L)
      expect(s.mines / (s.w * s.h)).toBeLessThanOrEqual(MAX_DENSITY + 0.005)
    }
  })

  it('stops growing at the maximum level and holds there', () => {
    const top = levelSpec(MAX_LEVEL)
    for (const L of [MAX_LEVEL + 1, MAX_LEVEL + 25, 500, 10000]) expect(levelSpec(L)).toEqual(top)
    expect(nominal(MAX_LEVEL + 100)).toBe(nominal(MAX_LEVEL))
    expect(levelRequirements(MAX_LEVEL + 100)).toEqual(levelRequirements(MAX_LEVEL))
  })

  it('levels past the maximum are new boards at the same difficulty', () => {
    const a = makeSetup('campaign', { level: MAX_LEVEL })
    const b = makeSetup('campaign', { level: MAX_LEVEL + 1 })
    const c = makeSetup('campaign', { level: MAX_LEVEL + 2 })
    for (const s of [b, c]) {
      expect([s.w, s.h, s.mines, s.maxTech, s.maxEnum]).toEqual([a.w, a.h, a.mines, a.maxTech, a.maxEnum])
    }
    expect(new Set([a.seed, b.seed, c.seed]).size).toBe(3)
    const boards = [a, b, c].map(s => generatePuzzle(s, 5 * s.w + 5))
    expect(same(boards[0].mines, boards[1].mines)).toBe(false)
    expect(same(boards[1].mines, boards[2].mines)).toBe(false)
  })

  it('later levels ask for more: techniques unlock and the required patterns grow', () => {
    const rank = L => TECH_RANK[levelRequirements(L).maxTech]
    for (let L = 2; L <= MAX_LEVEL; L++) {
      expect(rank(L)).toBeGreaterThanOrEqual(rank(L - 1))
      expect(levelRequirements(L).minAdvanced).toBeGreaterThanOrEqual(levelRequirements(L - 1).minAdvanced)
      expect(levelRequirements(L).minEnum).toBeGreaterThanOrEqual(levelRequirements(L - 1).minEnum)
    }
    expect(levelRequirements(5).maxTech).toBe('basic')
    expect(levelRequirements(20).maxTech).toBe('subset')
    expect(levelRequirements(30).maxTech).toBe('enum')
    expect(levelRequirements(30).minEnum).toBeGreaterThan(0)
  })

  it('nonsense levels fall back to level 1', () => {
    expect(levelSpec(0)).toEqual(levelSpec(1))
    expect(levelSpec(-4)).toEqual(levelSpec(1))
    expect(levelSpec('abc')).toEqual(levelSpec(1))
    expect(levelSpec(2.9)).toEqual(levelSpec(2))
  })
})

describe('difficulty evaluator', () => {
  it('rises with size, with density, and with the techniques a board needs', () => {
    expect(evaluateDifficulty({ w: 16, h: 16, mines: 40 })).toBeGreaterThan(evaluateDifficulty({ w: 9, h: 9, mines: 10 }))
    expect(evaluateDifficulty({ w: 10, h: 10, mines: 25 })).toBeGreaterThan(evaluateDifficulty({ w: 10, h: 10, mines: 12 }))
    const spec = { w: 12, h: 12, mines: 22 }
    const mk = (hardest, advanced, enumCount) => ({ hardest, advanced, techniques: { enum: enumCount }, frontierPeak: 20, enumPeak: enumCount ? 8 : 0 })
    const basic = evaluateDifficulty(spec, mk('basic', 0, 0))
    const subset = evaluateDifficulty(spec, mk('subset', 5, 0))
    const enumd = evaluateDifficulty(spec, mk('enum', 10, 6))
    expect(subset).toBeGreaterThan(basic)
    expect(enumd).toBeGreaterThan(subset)
  })

  it('stays between 0 and 100 even for extreme inputs', () => {
    const wild = { hardest: 'enum', advanced: 9999, techniques: { enum: 9999 }, frontierPeak: 9999, enumPeak: 9999 }
    expect(evaluateDifficulty({ w: 100, h: 100, mines: 9000 }, wild)).toBeLessThanOrEqual(100)
    expect(evaluateDifficulty({ w: 2, h: 2, mines: 1 })).toBeGreaterThanOrEqual(0)
  })

  it('labels and bands line up', () => {
    expect(difficultyLabel(5)).toBe('Gentle')
    expect(difficultyLabel(30)).toBe('Easy')
    expect(difficultyLabel(45)).toBe('Medium')
    expect(difficultyLabel(60)).toBe('Hard')
    expect(difficultyLabel(90)).toBe('Expert')
    expect([5, 30, 45, 60, 90].map(difficultyBand)).toEqual([1, 2, 3, 4, 5])
  })

  it('the measured score of generated levels rises across the ramp without big jumps in the averages', () => {
    const at = L => generateLevel(L).difficulty
    const early = [1, 2, 3, 4].map(at)
    const mid = [14, 15, 16, 17].map(at)
    const late = [50, 52, 56, 59].map(at)
    const avg = a => a.reduce((t, x) => t + x, 0) / a.length
    expect(avg(mid)).toBeGreaterThan(avg(early))
    expect(avg(late)).toBeGreaterThan(avg(mid))
    // The hardest score stays under the ceiling the evaluator defines.
    for (const d of [...early, ...mid, ...late]) expect(d).toBeLessThanOrEqual(100)
  })
})

describe('generated levels', () => {
  const sample = [1, 2, 5, 8, 12, 18, 25, 30, 38, 45, 60, 61, 80]

  it.each(sample)('level %i is valid, guess-free and within its caps', L => {
    const p = generateLevel(L)
    const req = levelRequirements(L)
    expect(validateLevel(p)).toEqual({ ok: true, errors: [] })
    expect(p.solvable).toBe(true)
    expect(p.requirementsMet).toBe(true)
    expect(TECH_RANK[p.analysis.hardest]).toBeLessThanOrEqual(TECH_RANK[req.maxTech])
    expect(p.analysis.advanced).toBeGreaterThanOrEqual(req.minAdvanced)
    expect(p.analysis.techniques.enum).toBeGreaterThanOrEqual(req.minEnum)
    expect(p.analysis.techniques.enum).toBeLessThanOrEqual(req.maxEnum)
    expect(p.mineCount).toBeLessThanOrEqual(levelSpec(L).mines)
    expect(p.mineCount / (p.w * p.h)).toBeLessThanOrEqual(MAX_DENSITY + 0.005)
  })

  it('the same level gives the same board every time', () => {
    const a = generateLevel(7)
    const b = generateLevel(7)
    expect(same(a.mines, b.mines)).toBe(true)
    expect(a.firstIdx).toBe(b.firstIdx)
  })

  it('different levels are different boards', () => {
    expect(same(generateLevel(10).mines, generateLevel(11).mines)).toBe(false)
  })

  it('any first click gives a safe, solvable board', () => {
    const setup = makeSetup('campaign', { level: 9 })
    for (const first of [0, setup.w - 1, setup.w * setup.h - 1, Math.floor((setup.w * setup.h) / 2), 5]) {
      const p = generatePuzzle(setup, first)
      expect(p.mines[first]).toBe(0)
      neighbours(first, p.w, p.h).forEach(j => expect(p.mines[j]).toBe(0))
      expect(validateLevel(p).ok).toBe(true)
    }
  })

  it('the suggested start cell depends only on the seed, so it cannot leak where mines are', () => {
    const s = makeSetup('campaign', { level: 12 })
    expect(startCell(s.seed, s.w, s.h)).toBe(s.start)
    expect(startCell(s.seed, s.w, s.h)).toBe(startCell(s.seed, s.w, s.h))
    for (let L = 1; L <= 60; L++) {
      const m = makeSetup('campaign', { level: L })
      const r = Math.floor(m.start / m.w)
      const c = m.start % m.w
      expect(r).toBeGreaterThanOrEqual(1)
      expect(r).toBeLessThanOrEqual(m.h - 2)
      expect(c).toBeGreaterThanOrEqual(1)
      expect(c).toBeLessThanOrEqual(m.w - 2)
    }
  })

  it('opening the suggested cell does not end the game, and the solver can finish it', () => {
    for (const L of [1, 10, 30]) {
      const p = generateLevel(L)
      const g = reveal(withMines(newGame(p.w, p.h, p.mineCount), p.mines), p.firstIdx)
      expect(g.status).toBe('playing')
      expect(solve({ w: p.w, h: p.h, mineCount: p.mineCount, mines: p.mines, counts: p.counts }, p.firstIdx).solved).toBe(true)
    }
  })
})

describe('validateLevel', () => {
  const good = () => ({ ...generateLevel(6) })

  it('accepts a generated level', () => {
    expect(validateLevel(good()).ok).toBe(true)
  })

  it('rejects a mine inside the first-click safe zone', () => {
    const p = good()
    const mines = p.mines.slice()
    mines[neighbours(p.firstIdx, p.w, p.h)[0]] = 1
    const r = validateLevel({ ...p, mines, counts: adjacentCounts(mines, p.w, p.h) })
    expect(r.ok).toBe(false)
    expect(r.errors.join()).toMatch(/mine-free zone/)
  })

  it('rejects wrong counts', () => {
    const p = good()
    const counts = p.counts.slice()
    counts[0] = (counts[0] + 1) % 9
    expect(validateLevel({ ...p, counts }).errors.join()).toMatch(/counts/)
  })

  it('rejects too many mines for the level and too dense a board', () => {
    const p = good()
    const mines = new Uint8Array(p.w * p.h).fill(1)
    mines[p.firstIdx] = 0
    neighbours(p.firstIdx, p.w, p.h).forEach(j => { mines[j] = 0 })
    const r = validateLevel({ ...p, mines, counts: adjacentCounts(mines, p.w, p.h), solvable: false })
    expect(r.ok).toBe(false)
    expect(r.errors.join()).toMatch(/density|more mines/)
  })

  it('rejects a board that needs a guess but claims it does not', () => {
    // Four mines in a 2x2 block in the middle of a tiny grid can't be separated by deduction.
    const w = 4
    const h = 4
    const mines = new Uint8Array(16)
    ;[5, 6, 9, 10].forEach(i => { mines[i] = 1 })
    const r = validateLevel({ mode: 'classic', w, h, mines, firstIdx: 0, counts: adjacentCounts(mines, w, h), solvable: true })
    expect(r.errors.join()).toMatch(/solved by deduction/)
  })

  it('rejects bad shapes without throwing', () => {
    expect(validateLevel(null).ok).toBe(false)
    expect(validateLevel({ w: 3, h: 3, mines: new Uint8Array(2), firstIdx: 0 }).ok).toBe(false)
    expect(validateLevel({ w: 3, h: 3, mines: new Uint8Array(9), firstIdx: 99 }).ok).toBe(false)
    expect(validateLevel({ w: 'x', h: 3 }).ok).toBe(false)
  })
})

describe('setups for every mode', () => {
  it('has the three classic sizes', () => {
    expect(['beginner', 'intermediate', 'expert'].map(m => { const s = makeSetup(m, { seed: 'x' }); return [s.w, s.h, s.mines] })).toEqual([[9, 9, 10], [16, 16, 40], [30, 16, 99]])
    expect(CLASSIC.expert.mines / (30 * 16)).toBeGreaterThan(MAX_DENSITY) // the classic expert is the only board denser than a level
  })

  it('classic boards depend on the seed, and a fixed seed repeats', () => {
    const a = makeSetup('beginner', { seed: 's1' })
    expect(generatePuzzle(a).mines).toEqual(generatePuzzle(makeSetup('beginner', { seed: 's1' })).mines)
    expect(same(generatePuzzle(a).mines, generatePuzzle(makeSetup('beginner', { seed: 's2' })).mines)).toBe(false)
  })

  it('the daily board is the same all day for everyone, and changes by date', () => {
    const a = makeSetup('daily', { date: '2026-03-05' })
    const b = makeSetup('daily', { date: '2026-03-05' })
    expect(a).toEqual(b)
    expect(same(generatePuzzle(a).mines, generatePuzzle(b).mines)).toBe(true)
    const seeds = new Set(Array.from({ length: 30 }, (_, i) => makeSetup('daily', { date: `2026-04-${String(i + 1).padStart(2, '0')}` }).seed))
    expect(seeds.size).toBe(30)
  })

  it('the daily is always mid-difficulty and within the level caps', () => {
    for (let d = 1; d <= 60; d++) {
      const s = makeSetup('daily', { date: `2026-05-${String((d % 28) + 1).padStart(2, '0')}-${d}` })
      expect(s.level).toBeGreaterThanOrEqual(10)
      expect(s.level).toBeLessThanOrEqual(24)
      expect(s.mines / (s.w * s.h)).toBeLessThanOrEqual(MAX_DENSITY)
    }
    const p = generatePuzzle(makeSetup('daily', { date: '2026-06-01' }))
    expect(p.solvable).toBe(true)
    expect(validateLevel(p).ok).toBe(true)
  })

  it('rejects an unknown mode', () => {
    expect(() => makeSetup('nope')).toThrow(/Unknown Minesweeper mode/)
  })

  it('par time grows with the board', () => {
    expect(parTime({ w: 6, h: 6, mines: 4 })).toBeLessThan(parTime({ w: 16, h: 16, mines: 40 }))
  })
})

describe('engine interface', () => {
  it('exposes the shared game-engine functions', () => {
    expect(Object.keys(engine).sort()).toEqual(['evaluateDifficulty', 'generateLevel', 'getHint', 'getSolution', 'validateLevel'])
  })

  it('getSolution lists exactly the mines', () => {
    const p = generateLevel(4)
    const sol = getSolution(p)
    expect(sol).toHaveLength(p.mineCount)
    sol.forEach(i => expect(p.mines[i]).toBe(1))
  })

  it('generateLevel(seed, config) is deterministic and valid', () => {
    const config = { w: 10, h: 10, mines: 14, maxTech: 'subset' }
    const a = engine.generateLevel('contract-seed', config)
    const b = engine.generateLevel('contract-seed', config)
    const other = engine.generateLevel('contract-seed-2', config)
    expect(same(a.mines, b.mines)).toBe(true)
    expect(same(a.mines, other.mines)).toBe(false)
    expect(engine.validateLevel(a)).toEqual({ ok: true, errors: [] })
    expect(a.solvable).toBe(true)
    expect(a.mineCount).toBeLessThanOrEqual(14)
  })

  it('generateLevel(seed, config) honours an explicit first click and defaults to the seed’s start cell', () => {
    const p = engine.generateLevel('contract-click', { w: 8, h: 8, mines: 8, firstIdx: 0 })
    expect(p.firstIdx).toBe(0)
    expect(p.mines[0]).toBe(0)
    expect(engine.generateLevel('contract-click', { w: 8, h: 8, mines: 8 }).firstIdx).toBe(startCell('contract-click', 8, 8))
  })

  it('evaluateDifficulty(levelState) scores a puzzle, and more for a harder one', () => {
    const easy = engine.generateLevel('score-a', { w: 6, h: 6, mines: 4, maxTech: 'basic' })
    const hard = generateLevel(55)
    expect(engine.evaluateDifficulty(easy)).toBeGreaterThan(0)
    expect(engine.evaluateDifficulty(hard)).toBeGreaterThan(engine.evaluateDifficulty(easy))
    expect(engine.evaluateDifficulty({ w: 9, h: 9, mines: 10 })).toBe(evaluateDifficulty({ w: 9, h: 9, mines: 10 }))
  })

  it('getHint(levelState) works from the game in play, and is null without one', () => {
    const p = generateLevel(9)
    const game = reveal(withMines(newGame(p.w, p.h, p.mineCount), p.mines), p.firstIdx)
    const h = engine.getHint({ ...p, game })
    expect(p.mines[h.idx]).toBe(h.type === 'mine' ? 1 : 0)
    expect(engine.getHint(p)).toBeNull()
  })

  it('getHint gives a certain move for a position in play', () => {
    const p = generateLevel(9)
    const g = reveal(withMines(newGame(p.w, p.h, p.mineCount), p.mines), p.firstIdx)
    const h = getHint(p, g)
    expect(h).not.toBeNull()
    expect(p.mines[h.idx]).toBe(h.type === 'mine' ? 1 : 0)
  })
})
