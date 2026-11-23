// Family Sort as a game engine: the shared contract from platform/engine.js, plus a per-level helper.
import { assertEngine } from '../../platform/engine'
import { CAPACITY } from './logic'
import {
  evaluateDifficulty, generateLevel, getSolution as storedSolution, levelConfig, seedFor, validateLevel,
} from './generator'
import { findHint, solve } from './solver'

/** The shortest solution the solver can find within its search budget, else the one stored with the level. */
function getSolution(level) {
  const r = solve(level.bottles, { capacity: level.capacity ?? CAPACITY })
  return r.solved ? r.moves : storedSolution(level)
}

/** One helpful pour for a level state, or null when the solver cannot find one. */
const getHint = level => findHint(level.bottles, { capacity: level.capacity ?? CAPACITY })

export const engine = assertEngine({ generateLevel, validateLevel, evaluateDifficulty, getSolution, getHint }, 'Family Sort engine')

const cache = new Map()
/** Level N of the campaign. Deterministic, and remembered for the session because later levels take a moment. */
export function buildLevel(level) {
  const key = Math.max(1, Math.floor(Number(level)) || 1)
  if (!cache.has(key)) {
    if (cache.size > 20) cache.clear()
    cache.set(key, generateLevel(seedFor(key), levelConfig(key)))
  }
  return cache.get(key)
}
