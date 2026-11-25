// Tambola level engine: seeded level generation, validation, difficulty and hints.
//
// A level is a complete, deterministic round: the tickets you hold, the order the caller will announce the 90
// numbers, and the computer players ("bots") who race you for the same goal. The same seed and config always give
// the same level. Bots are chosen so that the player can always win by marking promptly: no bot can claim before
// the player's goal is complete plus `lead` calls.
import { createRng } from '../../platform/rng'
import { clampDifficulty, rampTarget } from '../../platform/engine'
import {
  GOAL_IDS, MAX_NUMBER, completionCall, generateTicket, positionsOf, validateTicket, winningNumbers,
} from './ticket'

export const LEVEL_VERSION = 1

/** Difficulty climbs from 6 to 88 over the first 40 levels, then stays there: later levels are new variations. */
export const RAMP = { start: 6, end: 88, maxLevel: 40 }

export const BOT_NAMES = ['Asha', 'Ravi', 'Meera', 'Kabir', 'Zoya']
export const MAX_TICKETS = 3
export const MAX_BOTS = 3
export const SLOWEST_MS = 6000
export const FASTEST_MS = 2000
const LEAD_EASY = 7
const LEAD_HARD = 3
const BOT_TRIES = 300
const BOT_SLACK = 6 // a bot that finishes within this many calls of the earliest allowed time is "close enough"

// Where the player's own goal should complete, as a call number range. Fullhouse needs ~half the numbers called.
const COMPLETE_AT = { earlyFive: [7, 12], line: [12, 24], fullHouse: [48, 62] }

const lerp = (a, b, t) => a + (b - a) * t

/** The goal for a difficulty fraction t (0–1). Bigger patterns come later. */
const goalFor = t => (t < 0.3 ? 'earlyFive' : t < 0.6 ? 'line' : 'fullHouse')

/** The knobs for one level. Every one rises (or tightens) with t, so no level is a sudden jump from the last. */
function paramsFor(t) {
  return {
    goal: goalFor(t),
    interval: Math.round(lerp(SLOWEST_MS, FASTEST_MS, t) / 100) * 100,
    tickets: t < 0.34 ? 1 : t < 0.67 ? 2 : MAX_TICKETS,
    bots: Math.min(MAX_BOTS, Math.round(t * MAX_BOTS)),
    lead: Math.round(lerp(LEAD_EASY, LEAD_HARD, t)),
  }
}

/**
 * The game's difficulty evaluator: 0 (trivial) to 100. Faster calling, more tickets to watch, more rivals,
 * a thinner lead over them and a bigger pattern all make a level harder.
 * @param {Object} level  A level from generateLevel (or anything with the same `params`).
 */
export function evaluateDifficulty(level) {
  const p = level?.params
  if (!p) return 0
  const speed = (SLOWEST_MS - p.interval) / (SLOWEST_MS - FASTEST_MS)
  const load = (p.tickets - 1) / (MAX_TICKETS - 1)
  const rivals = p.bots / MAX_BOTS
  const margin = (LEAD_EASY - p.lead) / (LEAD_EASY - LEAD_HARD)
  const goal = { earlyFive: 0, line: 0.5, fullHouse: 1 }[p.goal] ?? 0
  const raw = 100 * (0.35 * speed + 0.15 * load + 0.25 * rivals + 0.15 * margin + 0.1 * goal)
  return clampDifficulty(raw, level.maxDifficulty ?? 100)
}

/** The difficulty a level number is aiming for, never above `maxDifficulty`. */
export function targetDifficulty(level, maxDifficulty = 100) {
  return clampDifficulty(rampTarget(level, RAMP), maxDifficulty)
}

function chooseParams(config) {
  const cap = clampDifficulty(config.maxDifficulty ?? 100)
  const target = targetDifficulty(config.level ?? 1, cap)
  const params = paramsFor(target / 100)
  // Whole-number knobs can overshoot the cap a little; calling a touch slower brings it back under.
  const probe = () => evaluateDifficulty({ params, maxDifficulty: 1e9 })
  while (probe() > cap && params.interval < SLOWEST_MS) params.interval += 100
  return { cap, params: { ...params, ...config.overrides } }
}

function buildCalls(rng, tickets, goal) {
  const own = rng.int(0, tickets.length - 1)
  const probe = positionsOf(Array.from({ length: MAX_NUMBER }, (_, i) => i + 1))
  const need = winningNumbers(goal, tickets[own], probe)
  const [lo, hi] = COMPLETE_AT[goal]
  const target = Math.max(need.length, rng.int(lo, hi))
  const last = rng.pick(need)
  const rest = need.filter(n => n !== last)
  const others = rng.shuffle(Array.from({ length: MAX_NUMBER }, (_, i) => i + 1).filter(n => !need.includes(n)))
  const early = rng.shuffle([...rest, ...others.splice(0, target - need.length)])
  return [...early, last, ...others]
}

function makeBots(rng, goal, position, ownAt, lead, count) {
  const bots = []
  const earliest = ownAt + lead
  for (let i = 0; i < count; i++) {
    let best = null
    for (let t = 0; t < BOT_TRIES; t++) {
      const ticket = generateTicket(rng)
      const at = completionCall(goal, ticket, position)
      if (at < earliest) continue
      if (!best || at < best.claimAt) best = { ticket, claimAt: at }
      if (at - earliest <= BOT_SLACK) break
    }
    if (best) bots.push({ name: BOT_NAMES[i % BOT_NAMES.length], ...best }) // no fair ticket found: that bot sits out
  }
  return bots
}

/**
 * Builds a level. Deterministic: the same seed and config always give the same result.
 * @param {string|number} seed
 * @param {{level?:number, maxDifficulty?:number, overrides?:Object}} [config]
 *   `level` sets the position on the ramp; `maxDifficulty` caps it; `overrides` can pin goal, interval, tickets,
 *   bots or lead (for tests and custom modes).
 */
export function generateLevel(seed, config = {}) {
  const level = Math.max(1, Math.floor(Number(config.level)) || 1)
  const { cap, params } = chooseParams({ ...config, level })
  const rng = createRng(`tambola:${seed}:${level}`)
  const tickets = Array.from({ length: params.tickets }, () => generateTicket(rng))
  const calls = buildCalls(rng, tickets, params.goal)
  const position = positionsOf(calls)
  const arrivals = tickets.map(t => completionCall(params.goal, t, position))
  const winAt = Math.min(...arrivals)
  const winTicket = arrivals.indexOf(winAt)
  const bots = makeBots(rng, params.goal, position, winAt, params.lead, params.bots)
  const state = {
    version: LEVEL_VERSION, seed: String(seed), level, maxDifficulty: cap,
    params: { ...params, bots: bots.length },
    goal: params.goal, interval: params.interval, tickets, calls, winAt, winTicket, bots,
  }
  state.difficulty = evaluateDifficulty(state)
  return state
}

/** Checks a level against the rules of the game. Returns { ok, errors } and never throws. */
export function validateLevel(level) {
  const errors = []
  if (!level || typeof level !== 'object') return { ok: false, errors: ['level must be an object'] }
  if (!GOAL_IDS.includes(level.goal)) errors.push(`unknown goal "${level.goal}"`)
  if (!Array.isArray(level.tickets) || level.tickets.length < 1 || level.tickets.length > MAX_TICKETS) {
    errors.push(`a level has 1 to ${MAX_TICKETS} tickets`)
  } else {
    level.tickets.forEach((t, i) => validateTicket(t).errors.forEach(e => errors.push(`ticket ${i + 1}: ${e}`)))
  }
  const calls = level.calls
  const isPermutation = Array.isArray(calls) && calls.length === MAX_NUMBER && new Set(calls).size === MAX_NUMBER &&
    calls.every(n => Number.isInteger(n) && n >= 1 && n <= MAX_NUMBER)
  if (!isPermutation) errors.push(`calls must be every number from 1 to ${MAX_NUMBER} exactly once`)
  if (!(level.interval >= FASTEST_MS && level.interval <= SLOWEST_MS)) errors.push('call interval is out of range')
  if (errors.length) return { ok: false, errors }

  const position = positionsOf(calls)
  const winAt = Math.min(...level.tickets.map(t => completionCall(level.goal, t, position)))
  if (winAt !== level.winAt) errors.push('winAt does not match the tickets and the call order')
  for (const bot of level.bots || []) {
    if (!validateTicket(bot.ticket).ok) errors.push(`${bot.name}'s ticket is invalid`)
    if (bot.claimAt !== completionCall(level.goal, bot.ticket, position)) errors.push(`${bot.name}'s claim time is wrong`)
    if (bot.claimAt < winAt + (level.params?.lead ?? 1)) errors.push(`${bot.name} would claim before the player can`)
  }
  const d = evaluateDifficulty(level)
  if (d > (level.maxDifficulty ?? 100)) errors.push('difficulty is above the maximum')
  return { ok: errors.length === 0, errors }
}

/** The full solution: which ticket to play, which numbers it needs, and the call after which to claim. */
export function getSolution(level) {
  const position = positionsOf(level.calls)
  const numbers = winningNumbers(level.goal, level.tickets[level.winTicket], position)
  return { ticket: level.winTicket, numbers, claimAfter: level.winAt }
}

/**
 * One helpful next step.
 * @param {Object} level
 * @param {{called?:number, marked?:number[]}} [state]  how many numbers have been called, and the ones you marked
 *   on the winning ticket. Without state, returns the first number to mark.
 * @returns {{type:'mark', ticket:number, number:number}|{type:'claim'}|null}
 */
export function getHint(level, state = {}) {
  const { called = level.calls.length, marked = [] } = state
  const { ticket, numbers } = getSolution(level)
  const have = new Set(marked)
  const position = positionsOf(level.calls)
  const next = numbers.find(n => !have.has(n) && position[n] <= called)
  if (next !== undefined) return { type: 'mark', ticket, number: next }
  if (numbers.every(n => have.has(n))) return { type: 'claim' }
  return null // everything you can mark right now is marked: wait for the next call
}

/** The shared engine interface (see platform/engine.js). */
export const engine = { generateLevel, validateLevel, evaluateDifficulty, getSolution, getHint }
