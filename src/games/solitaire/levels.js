// Solitaire progression: how hard each level's deal is, how deals are picked, and the game-engine interface.
//
// Shuffle order alone says little about how hard a deal is, so a deal's difficulty (evaluateDifficulty, 0-100) is
// measured from four things:
//   hidden      how deeply the low cards (Aces to Fours) are buried under other cards, face-down ones included,
//               how hard the stock makes them to reach (in draw-three, most stock cards are not on top at first),
//               and how many Kings sit on top of face-down cards (30)
//   mobility    how few useful moves the opening position offers (15)
//   effort      how much searching the solver needed to find a win (log of positions explored) (35)
//   complexity  how many card moves the solver's win takes, and how many times it had to go through the stock (20)
// The first two are read from the deal; the last two come from actually solving it.
//
// Every level has a target on a smooth ramp (platform/engine.js rampTarget). To build a level, the generator shuffles
// a set of candidate deals from the level's seed, tries the ones whose layout looks closest to the target first, and
// keeps the first deal the solver can win whose difficulty is inside the level's band. Deals the solver cannot win,
// and deals harder than the band allows, are rejected outright. If no candidate lands in the band, the closest
// winnable deal *below* it is used, so a level can come out a little easier than planned but never harder. After
// MAX_LEVEL the target stops rising: every later level is a new deal at the same maximum difficulty.
import { rampTarget, clampDifficulty } from '../../platform/engine'
import { KING, canStack, rankOf } from './cards'
import { dealFromSeed, isValidDeal } from './deal'
import {
  applyMove, autoFinishMove, canAutoFinish, createGame, foundationFor, hiddenCount, isWon, listMoves, reachableTalon, replay, topOf,
} from './rules'
import { solve } from './solver'

export const MAX_LEVEL = 50
/**
 * Difficulty ramp per draw mode. Draw-three is harder by nature (most stock cards start out of reach), so its ramp
 * starts and ends higher, but both are capped:
 *   start  level 1's target   end  the target from MAX_LEVEL on   cap  no deal is ever accepted above this
 * The numbers were set from the measured spread of winnable random deals: a draw-one deal's difficulty is about 8
 * at the easiest 5%, 32 in the middle and 58 at the hardest 5%; draw-three runs about 30 / 47 / 70.
 */
export const RAMPS = {
  1: { start: 10, end: 50, cap: 58 },
  3: { start: 30, end: 62, cap: 70 },
}
/** How far above / below its target a level's deal may be. Easier is more acceptable than harder. */
export const BAND_ABOVE = 4
export const BAND_BELOW = 6

/** Solver budget when generating (positions per deal). Deals the solver can't win within it are rejected. */
export const SOLVER_BUDGET = { 1: 8000, 3: 10000 }
const CANDIDATES = 100
const MAX_SOLVES = 10
const MAX_EXTRA_SOLVES = 12

const rampOf = draw => RAMPS[draw === 3 ? 3 : 1]
/** The hardest a campaign or random deal in this draw mode may ever be. */
export const maxDifficulty = draw => rampOf(draw).cap

const clamp01 = x => Math.min(1, Math.max(0, x))
const round1 = x => Math.round(x * 10) / 10

/* ───────────── Measuring a deal ───────────── */

const LOW_WEIGHT = [0, 4, 3, 2, 1] // Ace … Four: the earlier a card is needed, the more its burial hurts

/**
 * Facts about the opening position, without solving.
 *   burial    weighted count of cards on top of the low cards (and the cost of digging them out of the stock)
 *   mobility  number of useful opening moves: cards that can go up, runs that uncover a card, stock cards that fit
 *   kingsHigh Kings sitting on top of face-down cards (they need an empty column before those cards are free)
 */
export function staticMetrics(deal, draw = 1) {
  const game = createGame(deal, draw)
  let burial = 0
  deal.tableau.forEach(col => {
    col.forEach((card, k) => {
      const w = LOW_WEIGHT[rankOf(card)] || 0
      if (w) burial += w * (col.length - 1 - k)
    })
  })
  // Stock order: the first card turned is the top of the stock (last element).
  const order = [...deal.stock].reverse()
  order.forEach((card, i) => {
    const w = LOW_WEIGHT[rankOf(card)] || 0
    if (!w) return
    const onTopAtFirst = draw === 1 || (i + 1) % draw === 0 || i === order.length - 1
    burial += w * (onTopAtFirst ? 0.5 : 2.5)
  })

  let mobility = 0
  game.tableau.forEach(col => {
    if (foundationFor(game, topOf(col)) >= 0) mobility++
    if (game.tableau.some(other => other !== col && other.length && canStack(topOf(col), topOf(other)))) mobility++
  })
  for (const card of reachableTalon(game)) {
    if (foundationFor(game, card) >= 0 || game.tableau.some(col => canStack(card, topOf(col)))) mobility++
  }
  const kingsHigh = deal.tableau.reduce((t, col) => t + col.slice(1).filter(c => rankOf(c) === KING).length, 0)
  return { burial: round1(burial), mobility, kingsHigh }
}

/**
 * Solves a deal and measures the win: positions searched, card moves (draws not counted), draws, and how many times
 * the stock had to be turned over.
 */
export function analyzeDeal(deal, draw = 1, maxNodes = SOLVER_BUDGET[draw] || SOLVER_BUDGET[1]) {
  const result = solve(createGame(deal, draw), { maxNodes })
  const analysis = { status: result.status, nodes: result.nodes, moves: 0, draws: 0, recycles: 0, solution: result.moves }
  if (result.status === 'solved') {
    let state = createGame(deal, draw)
    for (const m of result.moves) {
      if (m.type === 'draw') {
        if (state.stock.length === 0) analysis.recycles++
        analysis.draws++
      } else analysis.moves++
      state = applyMove(state, m).state
    }
  }
  return analysis
}

/**
 * The four parts of a deal's difficulty, each already scaled to its weight. Each input is mapped linearly from
 * "easy end" to "hard end" of what real deals show (see RAMPS), then clamped.
 */
export function difficultyParts(metrics, analysis) {
  const hidden = clamp01((metrics.burial - 25) / 75) * 24 + clamp01(metrics.kingsHigh / 4) * 6
  const mobility = clamp01((12 - metrics.mobility) / 10) * 15
  if (!analysis || analysis.status !== 'solved') {
    // Unsolved (or not solved yet): only the layout is known, and the search part counts as hard.
    return { hidden, mobility, effort: analysis ? 35 : 0, complexity: analysis ? 20 : 0 }
  }
  const effort = clamp01((Math.log10(Math.max(1, analysis.nodes)) - 1.65) / 2.2) * 35
  const complexity = clamp01((analysis.moves - 65) / 40) * 10 + clamp01(analysis.recycles / 10) * 10
  return { hidden, mobility, effort, complexity }
}

/** A deal's difficulty from 0 to 100. Without `analysis` only the layout parts count. */
export function evaluateDifficulty(metrics, analysis = null) {
  const p = difficultyParts(metrics, analysis)
  return round1(clampDifficulty(p.hidden + p.mobility + p.effort + p.complexity))
}

const BANDS = [
  [18, 'Gentle'],
  [30, 'Easy'],
  [42, 'Medium'],
  [54, 'Hard'],
  [Infinity, 'Expert'],
]
export const difficultyLabel = score => BANDS.find(([max]) => score < max)[1]
/** 1-5 for the difficulty dots. */
export const difficultyBand = score => BANDS.findIndex(([max]) => score < max) + 1

/* ───────────── Levels ───────────── */

const levelNumber = level => Math.max(1, Math.floor(Number(level)) || 1)

/** The difficulty a level aims for in a draw mode. Stops rising at MAX_LEVEL. */
export const levelTarget = (level, draw = 1) => {
  const { start, end } = rampOf(draw)
  return round1(rampTarget(levelNumber(level), { start, end, maxLevel: MAX_LEVEL }))
}

/** Range a level's deal must fall in, never above the draw mode's cap. Level 1 accepts anything easy. */
export function levelBand(level, draw = 1) {
  const target = levelTarget(level, draw)
  const L = levelNumber(level)
  return {
    target,
    min: L === 1 ? 0 : round1(Math.max(0, target - BAND_BELOW)),
    max: round1(Math.min(rampOf(draw).cap, target + BAND_ABOVE)),
  }
}

/** Seconds for the "fast finish" star: a relaxed pace of about 3 s per card move, plus time to look around. */
export const parTime = moves => Math.round(60 + 3 * Math.max(60, moves || 0))

/** Points added on a win for finishing quickly: worth more the further under twice the par time, nothing after. */
export const timeBonus = (time, par) => Math.max(0, Math.round((2 * par - time) * 1.5))

/* ───────────── Generating deals ───────────── */

const MEMO_LIMIT = 16
const memo = new Map()

/**
 * Picks a deal for a seed and a difficulty band. Pure: the same arguments always give the same deal.
 * @param {string} seed
 * @param {Object} o
 * @param {1|3} [o.draw]
 * @param {number} [o.target]          difficulty to aim for
 * @param {number} [o.min] @param {number} [o.max]  accepted range
 * @param {number} [o.candidates]      shuffles to consider
 * @param {number} [o.maxSolves]       most of them to run the solver on
 * @returns {{deal, seed, dealSeed, draw, metrics, analysis, difficulty, solvable:boolean, inBand:boolean, attempts:number}}
 */
export function generateDeal(seed, { draw = 1, target, min = 0, max, candidates = CANDIDATES, maxSolves = MAX_SOLVES } = {}) {
  const d = draw === 3 ? 3 : 1
  const ramp = rampOf(d)
  const goal = Number.isFinite(target) ? target : (ramp.start + ramp.end) / 2
  const ceiling = Math.min(ramp.cap, Number.isFinite(max) ? max : ramp.cap)
  const key = JSON.stringify([seed, d, goal, min, ceiling, candidates, maxSolves])
  if (memo.has(key)) return memo.get(key)

  // 1. Lay out the candidates (cheap: no solving) and sort them by how hard their layout looks.
  const pool = Array.from({ length: Math.max(1, candidates) }, (_, i) => {
    const dealSeed = `${seed}#${i}`
    const deal = dealFromSeed(dealSeed)
    const metrics = staticMetrics(deal, d)
    return { i, dealSeed, deal, metrics, layout: evaluateDifficulty(metrics) }
  }).sort((a, b) => a.layout - b.layout || a.i - b.i)

  // 2. Solve them starting from where the target sits in that order, working outwards.
  const where = clamp01((goal - ramp.start) / (ramp.end - ramp.start)) * 0.9
  const start = Math.round(where * (pool.length - 1))
  const order = [pool[start]]
  for (let step = 1; order.length < pool.length; step++) {
    if (start + step < pool.length) order.push(pool[start + step])
    if (start - step >= 0) order.push(pool[start - step])
  }

  const tried = new Set()
  let attempts = 0
  const measure = c => {
    tried.add(c.i)
    attempts++
    const analysis = analyzeDeal(c.deal, d)
    return { deal: c.deal, seed, dealSeed: c.dealSeed, draw: d, metrics: c.metrics, analysis, difficulty: evaluateDifficulty(c.metrics, analysis), solvable: analysis.status === 'solved' }
  }

  let best = null
  let fallback = null
  for (const c of order.slice(0, maxSolves)) {
    const m = measure(c)
    if (!m.solvable) { fallback ??= m; continue }
    if (m.difficulty > ceiling) continue // too hard: rejected outright
    if (m.difficulty >= min) { best = { ...m, inBand: true }; break }
    // Winnable and not too hard, just easier than asked: keep the closest in case nothing lands in the band.
    if (!best || Math.abs(m.difficulty - goal) < Math.abs(best.difficulty - goal)) best = { ...m, inBand: false }
  }
  // Nothing winnable at or under the ceiling yet: try the easiest-looking layouts left.
  if (!best) {
    for (const c of pool.filter(c => !tried.has(c.i)).slice(0, MAX_EXTRA_SOLVES)) {
      const m = measure(c)
      if (m.solvable && m.difficulty <= ceiling) { best = { ...m, inBand: m.difficulty >= min }; break }
      if (!m.solvable) fallback ??= m
    }
  }
  const result = { ...(best || { ...fallback, inBand: false }), attempts }
  if (memo.size >= MEMO_LIMIT) memo.delete(memo.keys().next().value)
  memo.set(key, result)
  return result
}

/* ───────────── Setups for each mode ───────────── */

/** A fresh random seed for "random deal" games. */
export const randomSeed = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`

/** Level used for random deals: a fair middle difficulty. */
export const RANDOM_LEVEL = 18

/**
 * Everything needed to start a game, without generating the deal yet.
 *   mode 'campaign': { level, draw }  ·  mode 'random': { draw, seed }
 */
export function makeSetup(mode, { level = 1, draw = 1, seed } = {}) {
  const d = draw === 3 ? 3 : 1
  if (mode === 'campaign') {
    // The level number keeps counting after MAX_LEVEL (so seeds stay new) while the band stays at the cap.
    const L = levelNumber(level)
    return { mode, level: L, draw: d, seed: `solitaire:d${d}:L${L}`, key: `campaign:d${d}:L${L}`, title: `Level ${L}`, ...levelBand(L, d) }
  }
  if (mode === 'random') {
    const s = seed || randomSeed()
    return { mode, level: 0, draw: d, seedId: s, seed: `solitaire:random:${s}`, key: `random:d${d}:${s}`, title: 'Random deal', ...levelBand(RANDOM_LEVEL, d) }
  }
  throw new Error(`Unknown Solitaire mode: ${mode}`)
}

/** Generates the deal for a setup. Same setup, same deal. */
export function generatePuzzle(setup) {
  const g = generateDeal(setup.seed, { draw: setup.draw, target: setup.target, min: setup.min, max: setup.max })
  return { ...setup, ...g, par: parTime(g.analysis.moves), parMoves: g.analysis.moves }
}

/** Campaign puzzle for a level. */
export const generateLevel = (level, draw = 1) => generatePuzzle(makeSetup('campaign', { level, draw }))

/* ───────────── Engine contract ───────────── */

/** Checks a level against the rules. Returns { ok, errors }. */
export function validateLevel(puzzle) {
  const errors = []
  if (!puzzle || !isValidDeal(puzzle.deal)) return { ok: false, errors: ['deal must hold all 52 cards in the standard layout'] }
  if (puzzle.draw !== 1 && puzzle.draw !== 3) errors.push('draw must be 1 or 3')
  if (typeof puzzle.difficulty !== 'number' || puzzle.difficulty < 0 || puzzle.difficulty > 100) errors.push('difficulty must be between 0 and 100')
  if (puzzle.mode === 'campaign' || puzzle.mode === 'random') {
    if (puzzle.difficulty > maxDifficulty(puzzle.draw)) errors.push('deal is harder than the maximum difficulty')
    if (!puzzle.solvable) errors.push('deal has no known solution')
  }
  if (puzzle.solvable) {
    const sol = puzzle.analysis?.solution
    const r = Array.isArray(sol) ? replay(puzzle.deal, puzzle.draw, sol) : null
    if (!r || !isWon(r.state)) errors.push('stored solution does not win the deal')
  }
  return { ok: errors.length === 0, errors }
}

/** The winning line (rules.js moves, draws included) for a puzzle, or null when it has none. */
export const getSolution = puzzle => (puzzle?.solvable ? puzzle.analysis.solution : null)

/**
 * A good next move from the position `game`, in rules.js move format, or null when no move helps.
 * Uses the solver; if the solver cannot find a win from here in its budget, it falls back to the most useful
 * legal move (a card to a foundation, uncovering a card, a waste card to a column, then drawing).
 * Returns { move, winnable } where winnable is true / false / null (unknown).
 */
export function findHint(game, maxNodes = 15000) {
  if (isWon(game)) return null
  const r = solve(game, { maxNodes })
  if (r.status === 'solved' && r.moves.length) return { move: r.moves[0], winnable: true }
  const moves = listMoves(game)
  const score = m => {
    if (m.type === 'draw') return 1
    if (m.to === 'f') return 5
    const from = m.from
    if (from === 'waste') return 3
    if (from[0] === 't') {
      const i = Number(from[1])
      const start = game.tableau[i].length - m.count
      if (start > 0 && start === game.hidden[i]) return 4
      return 0
    }
    return -1
  }
  const best = moves.map(m => ({ m, s: score(m) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s)[0]
  return best ? { move: best.m, winnable: r.status === 'unsolved' ? false : null } : null
}

/**
 * Once every column card is face up, the rest of the game can usually be played out for the player. Returns the
 * moves that finish it (rules.js format, draws included), or null when that is not certain yet:
 *   • some column card is still face down, or
 *   • the solver can't find a win from here (rare: in draw-three a stock card can be stuck out of reach).
 * With the stock and waste empty this is just "send the lowest card up" each time; otherwise the solver's line is used,
 * so cards still in the stock or waste are drawn and played too.
 */
export function planFinish(game, maxNodes = 20000) {
  if (isWon(game) || hiddenCount(game) > 0) return null
  if (canAutoFinish(game)) {
    const line = []
    let s = game
    while (!isWon(s)) {
      const m = autoFinishMove(s)
      if (!m) return null
      line.push(m)
      s = applyMove(s, m).state
    }
    return line
  }
  const r = solve(game, { maxNodes })
  return r.status === 'solved' ? r.moves : null
}

/**
 * The shared game-engine contract (platform/engine.js).
 *   generateLevel(seed, config)  config: { draw?, target?, min?, max?, candidates?, maxSolves? }
 *   validateLevel(levelState)    { ok, errors }
 *   evaluateDifficulty(state)    0-100, from state.metrics and state.analysis (solved here if missing)
 *   getSolution(levelState)      the winning line, or null
 *   getHint(levelState)          { move, winnable } for levelState.game (the position in play, default: the deal)
 */
export const engine = {
  generateLevel(seed, config = {}) {
    const g = generateDeal(String(seed), config)
    return { mode: 'custom', ...g, par: parTime(g.analysis.moves), parMoves: g.analysis.moves }
  },
  validateLevel,
  evaluateDifficulty(state) {
    const draw = state.draw === 3 ? 3 : 1
    const metrics = state.metrics || staticMetrics(state.deal, draw)
    return evaluateDifficulty(metrics, state.analysis || analyzeDeal(state.deal, draw))
  },
  getSolution,
  getHint: state => findHint(state.game || createGame(state.deal, state.draw)),
}
