// Word Guess progression: how hard each answer is, which answer each level uses, and today's daily word.
//
// Difficulty of a word (evaluateDifficulty) combines four things:
//   familiarity  - its curated band in dictionary.js (everyday → familiar → fair)
//   letter rarity - how uncommon its letters are across all answers (Q, X, Z, J are hard to find)
//   repeats      - repeated letters ("sheep", "jolly") are easy to miss
//   ambiguity    - how many other answers differ from it in only one spot ("light", "night", "fight"…),
//                  which is what makes a word take many guesses even when you know most of it
// Answers are ranked by that score and cut into TIERS. Levels move through the tiers slowly, the last tier
// repeats forever, and within a tier the order is a seeded shuffle, so every player gets the same word for
// the same level and no answer repeats until that tier's pool has been used up.
import { createRng } from '../../platform/rng'
import { ANSWERS, VALID_WORDS, WORD_LENGTH, getHint as hintFor, isWellFormed } from './logic'
import { COMMON, FAIR, FAMILIAR } from './dictionary'

export const TIER_COUNT = 6
/** First level of each tier. Tier 6 (the maximum) starts at level 43 and never ends. */
export const TIER_STARTS = [1, 6, 13, 21, 31, 43]
/** Tiers the daily word is drawn from: middle difficulty, so it suits everyone. */
export const DAILY_TIERS = [2, 3, 4]

const FAMILIARITY = new Map([
  ...FAIR.map(w => [w, 3]),
  ...FAMILIAR.map(w => [w, 2]),
  ...COMMON.map(w => [w, 1]),
])

// Letter frequency: in how many answers each letter appears.
const LETTER_FREQ = (() => {
  const f = {}
  for (const w of ANSWERS) for (const c of new Set(w)) f[c] = (f[c] || 0) + 1
  return f
})()
const MAX_FREQ = Math.max(...Object.values(LETTER_FREQ))

const ANSWER_SET = new Set(ANSWERS)

// Ambiguity: answers that match a word in 4 of its 5 spots. "_ight" → fight, light, might, night…
const SLOT_COUNTS = (() => {
  const m = new Map()
  for (const w of ANSWERS) for (let i = 0; i < WORD_LENGTH; i++) {
    const k = `${w.slice(0, i)}_${w.slice(i + 1)}`
    m.set(k, (m.get(k) || 0) + 1)
  }
  return m
})()

/** Number of other answers that differ from `word` in exactly one position. */
export function neighbours(word) {
  const self = ANSWER_SET.has(word) ? 1 : 0 // the word's own entry in each slot bucket
  let n = 0
  for (let i = 0; i < WORD_LENGTH; i++) n += (SLOT_COUNTS.get(`${word.slice(0, i)}_${word.slice(i + 1)}`) || 0) - self
  return n
}

/** Difficulty breakdown and total score for a word. Higher = harder. */
export function evaluateDifficulty(word) {
  const familiarity = FAMILIARITY.get(word) ?? 3
  const unique = new Set(word)
  const rarity = [...unique].reduce((t, c) => t + (1 - (LETTER_FREQ[c] || 0) / MAX_FREQ), 0) / unique.size
  const repeats = WORD_LENGTH - unique.size
  const ambiguity = neighbours(word)
  const score = 1.6 * (familiarity - 1) + 2 * rarity + 1 * repeats + 0.45 * Math.min(ambiguity, 6)
  return { familiarity, rarity: Math.round(rarity * 100) / 100, repeats, ambiguity, score: Math.round(score * 100) / 100 }
}

/** All answers sorted from easiest to hardest, cut into TIER_COUNT tiers of near-equal size. */
export const TIERS = (() => {
  const ranked = ANSWERS
    .map(word => ({ word, score: evaluateDifficulty(word).score }))
    .sort((a, b) => a.score - b.score || (a.word < b.word ? -1 : 1))
  const size = Math.ceil(ranked.length / TIER_COUNT)
  return Array.from({ length: TIER_COUNT }, (_, t) => ranked.slice(t * size, (t + 1) * size).map(r => r.word))
})()

/** Tier (1-based) a campaign level draws from; never above the maximum. */
export function tierForLevel(level) {
  const L = Math.max(1, Math.floor(level) || 1)
  let t = 1
  for (let i = 0; i < TIER_STARTS.length; i++) if (L >= TIER_STARTS[i]) t = i + 1
  return Math.min(t, TIER_COUNT)
}

/** A seeded shuffle of `pool` for one pass through it. Consecutive passes never start with the word the last one ended on. */
function cycleOrder(pool, seed, cycle) {
  const order = createRng(`${seed}:c${cycle}`).shuffle([...pool])
  if (cycle > 0 && order.length > 1) {
    const prev = createRng(`${seed}:c${cycle - 1}`).shuffle([...pool])
    if (order[0] === prev[prev.length - 1]) [order[0], order[1]] = [order[1], order[0]]
  }
  return order
}

/** The n-th word (0-based) from an endless, non-repeating-per-pass sequence over `pool`. */
function nthWord(pool, seed, n) {
  const cycle = Math.floor(n / pool.length)
  return cycleOrder(pool, seed, cycle)[n % pool.length]
}

/** The puzzle for a campaign level: { mode, level, tier, answer, difficulty }. Deterministic. */
export function generateLevel(level) {
  const L = Math.max(1, Math.floor(level) || 1)
  const tier = tierForLevel(L)
  const answer = nthWord(TIERS[tier - 1], `word:tier${tier}`, L - TIER_STARTS[tier - 1])
  return { mode: 'campaign', level: L, tier, answer, difficulty: evaluateDifficulty(answer) }
}

export const DAILY_POOL = DAILY_TIERS.flatMap(t => TIERS[t - 1])
/** Days since 1970-01-01 for a YYYY-MM-DD key (a calendar date, so time zones don't matter). */
export const dayNumber = key => {
  const [y, m, d] = String(key).split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

/** The daily puzzle for a YYYY-MM-DD key: the same word for everyone, no repeats until the pool runs out. */
export function dailyPuzzle(dateKey) {
  const answer = nthWord(DAILY_POOL, 'word:daily', dayNumber(dateKey))
  return { mode: 'daily', date: dateKey, tier: TIERS.findIndex(t => t.includes(answer)) + 1, answer, difficulty: evaluateDifficulty(answer) }
}

/** Checks a puzzle against the game's rules. Returns { ok, errors }. */
export function validateLevel(puzzle) {
  const errors = []
  const a = puzzle?.answer
  if (!isWellFormed(a)) errors.push('answer must be five lowercase letters')
  if (!ANSWERS.includes(a)) errors.push('answer is not in the approved answer list')
  if (!VALID_WORDS.has(a)) errors.push('answer is not an accepted guess')
  if (!(puzzle?.tier >= 1 && puzzle.tier <= TIER_COUNT)) errors.push('tier out of range')
  else if (!TIERS[puzzle.tier - 1].includes(a)) errors.push('answer is not in its tier')
  return { ok: errors.length === 0, errors }
}

export const getSolution = puzzle => puzzle.answer
export const getHint = (puzzle, rows, given) => hintFor(puzzle.answer, rows, given)

/** The game-engine interface shared with other level-based games. */
export const engine = { generateLevel, validateLevel, evaluateDifficulty, getSolution, getHint }
