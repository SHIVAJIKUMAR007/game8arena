// Family Sort level generation and difficulty.
//
// Levels are built by running the game backwards. We start from a solved position (full single-colour bottles plus
// empty ones) and apply random *reverse* pours, each chosen so that its forward counterpart is exactly a legal pour.
// Played in reverse order, those pours are a solution, so every level is solvable by construction. validateLevel
// replays that solution to prove it, and the solver in solver.js is the independent second check.
// The same seed and config always give the same level: all randomness comes from the shared seeded PRNG.
import { clampDifficulty, rampTarget } from '../../platform/engine'
import { createRng } from '../../platform/rng'
import {
  CAPACITY, applyMove, cloneBottles, countColors, isSolved, isTidy, topColor, topRun, transitions, validateBottles,
} from './logic'

export const MAX_COLORS = 10
/** The ramp reaches full strength at this level and holds there for every level after it. */
export const RAMP_END_LEVEL = 100
export const MAX_DIFFICULTY = 100

// [last level of the tier, colours, empty bottles]. Bottle counts: 1-5 → 4, 6-15 → 5-6, 16-30 → 6-7,
// 31-50 → 7-8, 51-100 → 8-10. Levels 1-2 start with two empty bottles so the first puzzles are forgiving.
const TIERS = [
  [2, 2, 2], [5, 3, 1], [10, 3, 2], [22, 4, 2], [40, 5, 2], [50, 6, 2], [66, 6, 2], [83, 7, 2], [100, 8, 2],
]

/** Bottle set-up for a level number. From level 101 a colour is added every 15 levels, up to MAX_COLORS. */
export function levelParams(level) {
  const L = Math.max(1, Math.floor(Number(level)) || 1)
  let colors
  let empties
  const tier = TIERS.find(([upTo]) => L <= upTo)
  if (tier) {
    ;[, colors, empties] = tier
  } else {
    colors = Math.min(MAX_COLORS, 8 + Math.floor((L - 101) / 15))
    empties = colors === 8 || colors === 9 ? 3 : 2
  }
  return { level: L, colors, empties, bottles: colors + empties, capacity: CAPACITY }
}

/** Share of the largest possible mix that a level must reach: eases from 0.3 up to 0.62, then stays. */
export const mixTarget = level => rampTarget(level, { start: 0.3, end: 0.62, maxLevel: RAMP_END_LEVEL })

/** The config handed to generateLevel for a level number. */
export function levelConfig(level) {
  const p = levelParams(level)
  const minTransitions = Math.max(1, Math.ceil(mixTarget(p.level) * p.colors * (p.capacity - 1)))
  const minSteps = Math.ceil(p.colors * (1 + 3 * mixTarget(p.level))) // longer scrambles make longer solutions
  // A level may be a little more mixed than the target but never much: this keeps one level from jumping ahead of its neighbours.
  const maxDifficulty = scoreDifficulty({ colors: p.colors, mixed: minTransitions + 2, empties: p.empties, capacity: p.capacity })
  return { colors: p.colors, empties: p.empties, capacity: p.capacity, minTransitions, minSteps, maxDifficulty }
}

/** The seed for a level number. Stable forever so a level is the same for everyone. */
export const seedFor = level => `family-sort:L${Math.max(1, Math.floor(Number(level)) || 1)}`

/** A solved position: `colors` full bottles, then `empties` empty ones. */
export function solvedPosition(colors, empties, capacity = CAPACITY) {
  const bottles = []
  for (let c = 0; c < colors; c++) bottles.push(new Array(capacity).fill(c))
  for (let e = 0; e < empties; e++) bottles.push([])
  return bottles
}

/**
 * Reverse pours available from a position: [from, to, count]. Moving `count` units of the top colour from `from`
 * onto `to` is reversible (the forward pour `to` → `from` moves exactly those units) when
 *   - `to` has room and a different colour on top (or is empty), so the forward pour moves no more than `count`, and
 *   - `from` still has that colour on top afterwards (or is empty), so the forward pour onto it is legal.
 */
export function reversePours(bottles, capacity = CAPACITY) {
  const out = []
  for (let from = 0; from < bottles.length; from++) {
    const src = bottles[from]
    if (!src.length) continue
    const color = topColor(src)
    const run = topRun(src)
    for (let to = 0; to < bottles.length; to++) {
      if (to === from) continue
      const dst = bottles[to]
      if (dst.length >= capacity) continue
      if (topColor(dst) === color && src.length !== capacity) continue
      const most = Math.min(run, capacity - dst.length)
      for (let k = 1; k <= most; k++) {
        if (k === run && src.length !== k) continue // would leave a different colour on top of `from`
        if (dst.length === 0 && src.length === k) continue // just swaps two bottles
        out.push([from, to, k])
      }
    }
  }
  return out
}

/** One scramble attempt. Returns { bottles, solution } or null when it could not reach the target mix. */
function scramble(rng, { colors, empties, capacity, minTransitions, minSteps, maxSteps }) {
  let bottles = solvedPosition(colors, empties, capacity)
  const trail = []
  for (let step = 1; step <= maxSteps; step++) {
    const options = reversePours(bottles, capacity)
    if (!options.length) return null
    const [from, to, k] = rng.pick(options)
    bottles = cloneBottles(bottles)
    const color = topColor(bottles[from])
    bottles[from].length -= k
    for (let i = 0; i < k; i++) bottles[to].push(color)
    trail.push([to, from]) // the forward pour that undoes this step
    if (step >= minSteps && isTidy(bottles, capacity) && transitions(bottles) >= minTransitions && !isSolved(bottles, capacity)) {
      return { bottles, solution: trail.reverse() }
    }
  }
  return null
}

const DEFAULTS = { colors: 3, empties: 2, capacity: CAPACITY, minTransitions: 3, minSteps: 4, maxDifficulty: MAX_DIFFICULTY, attempts: 300 }

/**
 * Builds a level. Same seed and config, same level, every time.
 * @param {string|number} seed
 * @param {{ colors?: number, empties?: number, capacity?: number, minTransitions?: number, minSteps?: number, maxDifficulty?: number, maxSteps?: number, attempts?: number }} [config]
 * @returns {{ seed: string, colors: number, empties: number, capacity: number, bottles: number[][], solution: Array<[number, number]>, difficulty: number }}
 */
export function generateLevel(seed, config = {}) {
  const cfg = { ...DEFAULTS, ...config }
  if (!(cfg.colors >= 1 && cfg.colors <= MAX_COLORS) || !Number.isInteger(cfg.colors)) throw new RangeError(`colors must be 1-${MAX_COLORS}`)
  if (!Number.isInteger(cfg.empties) || cfg.empties < 1) throw new RangeError('empties must be at least 1')
  const maxSteps = cfg.maxSteps ?? 60 + cfg.colors * 40
  for (let attempt = 0; attempt < cfg.attempts; attempt++) {
    // Late attempts relax the mix a little so an unlucky seed can never fail outright.
    const relax = Math.floor(attempt / 75)
    const minTransitions = Math.max(1, cfg.minTransitions - relax)
    const minSteps = Math.max(1, cfg.minSteps - 2 * relax)
    const res = scramble(createRng(`${seed}#${attempt}`), { ...cfg, minTransitions, minSteps, maxSteps })
    if (!res) continue
    const level = {
      seed: String(seed), colors: cfg.colors, empties: cfg.empties, capacity: cfg.capacity,
      bottles: res.bottles, solution: res.solution, difficulty: 0,
    }
    level.difficulty = evaluateDifficulty(level)
    if (level.difficulty <= cfg.maxDifficulty && validateLevel(level).ok) return level
  }
  throw new Error(`Could not generate a Family Sort level for seed "${seed}"`)
}

/** Replays a solution from a position. Returns true when every pour is legal and the end is solved. */
export function replaySolves(bottles, moves, capacity = CAPACITY) {
  let cur = bottles
  for (const [f, t] of moves) {
    const r = applyMove(cur, f, t, capacity)
    if (!r) return false
    cur = r.bottles
  }
  return isSolved(cur, capacity)
}

/**
 * Checks a level against the rules: whole bottles, exact colour counts, nothing over capacity, not already solved,
 * and a real solution (the one stored with the level is replayed, so a hand-edited level cannot slip through).
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateLevel(level) {
  const errors = []
  if (!level || typeof level !== 'object') return { ok: false, errors: ['level must be an object'] }
  const capacity = level.capacity ?? CAPACITY
  const base = validateBottles(level.bottles, capacity)
  errors.push(...base.errors)
  if (base.ok) {
    if (isSolved(level.bottles, capacity)) errors.push('level is already solved')
    if (level.colors != null && countColors(level.bottles) !== level.colors) errors.push('colour count does not match the level')
    if (!level.bottles.some(b => b.length === 0)) errors.push('level needs at least one empty bottle')
    if (!Array.isArray(level.solution) || !replaySolves(level.bottles, level.solution, capacity)) errors.push('level has no valid solution')
  }
  return { ok: errors.length === 0, errors }
}

/** The difficulty formula on raw numbers. Exposed so a level's cap can be worked out before it is generated. */
export function scoreDifficulty({ colors, mixed, empties, capacity = CAPACITY }, max = MAX_DIFFICULTY) {
  if (!colors) return 0
  const mix = mixed / (colors * (capacity - 1))
  const size = (colors - 2) / (MAX_COLORS - 2)
  const room = 1 - Math.min(1, Math.max(0, (empties - 1) / 2))
  return Math.round(clampDifficulty(100 * (0.45 * size + 0.4 * mix + 0.15 * room), max))
}

/**
 * Difficulty from 0 (trivial) to 100: more colours, a more mixed position and less spare room all raise it.
 * Clamped to [0, max] so it can never go over the configured cap.
 */
export function evaluateDifficulty(level, max = MAX_DIFFICULTY) {
  const bottles = level?.bottles
  if (!Array.isArray(bottles) || !bottles.length) return 0
  return scoreDifficulty({
    colors: countColors(bottles),
    mixed: transitions(bottles),
    empties: bottles.filter(b => b.length === 0).length,
    capacity: level.capacity ?? CAPACITY,
  }, max)
}

/** The level's own solution, as [from, to] pours. */
export const getSolution = level => (level?.solution ? level.solution.map(m => m.slice()) : [])
