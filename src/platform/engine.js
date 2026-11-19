// The shared game-engine contract and a reusable difficulty ramp.
//
// A level-based game keeps its rules and generator in plain modules and exposes them as one `engine` object, so
// shared UI, tools and tests can drive any game the same way. Minesweeper and Word Guess already export engines of
// this shape; validateEngine() checks it at runtime.

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} ok
 * @property {string[]} errors
 */

/**
 * @interface GameEngine
 * @typedef {Object} GameEngine
 * @property {(seed: string|number, config?: Object) => Object} generateLevel
 *   Builds a level. The same seed and config must always give the same level.
 * @property {(levelState: Object) => ValidationResult} validateLevel
 *   Checks a level against the game's rules.
 * @property {(levelState: Object) => number} evaluateDifficulty
 *   The game's own difficulty evaluator: a number from 0 (trivial) to 100.
 * @property {(levelState: Object) => *} [getSolution]  A full solution, where the game has one.
 * @property {(levelState: Object) => *} [getHint]      One helpful next step, or null.
 */

export const REQUIRED_METHODS = ['generateLevel', 'validateLevel', 'evaluateDifficulty']
export const OPTIONAL_METHODS = ['getSolution', 'getHint']

/** Checks that an object implements the engine contract. Returns { ok, errors } and never throws. */
export function validateEngine(engine) {
  if (!engine || typeof engine !== 'object') return { ok: false, errors: ['engine must be an object'] }
  const errors = []
  for (const m of REQUIRED_METHODS) if (typeof engine[m] !== 'function') errors.push(`${m} must be a function`)
  for (const m of OPTIONAL_METHODS) if (m in engine && typeof engine[m] !== 'function') errors.push(`${m} must be a function when present`)
  return { ok: errors.length === 0, errors }
}

/** Like validateEngine, but throws with the engine's name. Returns the engine so it can wrap an export. */
export function assertEngine(engine, name = 'engine') {
  const { ok, errors } = validateEngine(engine)
  if (!ok) throw new TypeError(`${name} does not implement the game-engine contract: ${errors.join('; ')}`)
  return engine
}

/** Clamps a difficulty score into [0, max]. Non-numbers become 0. */
export function clampDifficulty(value, max = 100) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(max, Math.max(0, n))
}

/**
 * Target difficulty for a level on a smooth, capped ramp.
 *   level 1 → `start`; level `maxLevel` and every level after it → `end`.
 * The curve eases in, so the first levels rise slowly, and no step between two levels is ever bigger than
 * 2 × (end - start) / (maxLevel - 1). Levels past maxLevel keep the same target, so a game can keep making new
 * variations at its maximum difficulty without ever going above it.
 * @param {number} level
 * @param {{start:number, end:number, maxLevel:number}} ramp
 */
export function rampTarget(level, { start, end, maxLevel }) {
  const L = Math.max(1, Math.floor(Number(level)) || 1)
  if (maxLevel <= 1) return end
  const t = Math.min(1, (L - 1) / (maxLevel - 1))
  const eased = t * t * (3 - 2 * t) * 0.5 + t * 0.5 // half smoothstep, half linear: gentle start, never flat
  return start + (end - start) * eased
}
