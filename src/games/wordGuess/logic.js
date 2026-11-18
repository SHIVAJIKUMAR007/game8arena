// Word Guess rules: scoring a guess, word validation, hard mode, keyboard colours and hints.
// Pure functions only, so they can be unit tested and reused by the solver.
import { COMMON, EXTRA_GUESSES, FAIR, FAMILIAR } from './dictionary'

export const WORD_LENGTH = 5
export const MAX_GUESSES = 6

/** Tile states, ordered from weakest to strongest clue. */
export const ABSENT = 'absent'
export const PRESENT = 'present'
export const CORRECT = 'correct'
const RANK = { [ABSENT]: 1, [PRESENT]: 2, [CORRECT]: 3 }

/** Every word that may be the answer. */
export const ANSWERS = [...new Set([...COMMON, ...FAMILIAR, ...FAIR])]
/** Every word the player may type: all answers plus the extra guess list. */
export const VALID_WORDS = new Set([...ANSWERS, ...EXTRA_GUESSES])

export const normalize = word => String(word ?? '').trim().toLowerCase()
export const isWellFormed = word => /^[a-z]{5}$/.test(word)
/** Can `word` be submitted as a guess? */
export const isValidGuess = word => VALID_WORDS.has(normalize(word))
export const isAnswerWord = word => ANSWERS.includes(normalize(word))

/**
 * Score `guess` against `answer`. Two passes, so repeated letters are handled correctly:
 * exact matches are claimed first, then each remaining answer letter can turn at most one other guess
 * letter yellow. Guessing "speed" against "abide" gives one yellow E, not two.
 */
export function evaluateGuess(guess, answer) {
  const g = normalize(guess), a = normalize(answer)
  const result = new Array(g.length).fill(ABSENT)
  const left = {}
  for (let i = 0; i < g.length; i++) {
    if (g[i] === a[i]) result[i] = CORRECT
    else left[a[i]] = (left[a[i]] || 0) + 1
  }
  for (let i = 0; i < g.length; i++) {
    if (result[i] === CORRECT || !left[g[i]]) continue
    result[i] = PRESENT
    left[g[i]]--
  }
  return result
}

/** A compact, comparable form of a result ("20100"), used by the solver. */
export const patternKey = result => result.map(s => RANK[s] - 1).join('')

export const isWin = result => result.every(s => s === CORRECT)

/**
 * Hard mode: every revealed hint must be used in later guesses. Green letters stay in place, and yellow
 * letters (as many copies as were revealed) must appear somewhere. Returns the first broken rule as a
 * player-facing sentence, or null when the guess is allowed.
 */
export function hardModeError(rows, guess) {
  const g = normalize(guess)
  const ordinal = n => ['1st', '2nd', '3rd', '4th', '5th'][n]
  for (const { word, result } of rows) {
    for (let i = 0; i < result.length; i++) {
      if (result[i] === CORRECT && g[i] !== word[i]) return `${ordinal(i)} letter must be ${word[i].toUpperCase()}`
    }
    const need = {}
    for (let i = 0; i < result.length; i++) if (result[i] !== ABSENT) need[word[i]] = (need[word[i]] || 0) + 1
    for (const [letter, n] of Object.entries(need)) {
      const have = [...g].filter(c => c === letter).length
      if (have < n) return n > 1 ? `Guess must contain ${n} ${letter.toUpperCase()}s` : `Guess must contain ${letter.toUpperCase()}`
    }
  }
  return null
}

/** Best known state of each letter across all scored rows, for colouring the keyboard. */
export function keyboardStates(rows) {
  const out = {}
  for (const { word, result } of rows) {
    for (let i = 0; i < word.length; i++) {
      const prev = out[word[i]]
      if (!prev || RANK[result[i]] > RANK[prev]) out[word[i]] = result[i]
    }
  }
  return out
}

/**
 * Hint: the leftmost position the player hasn't already found (green) or been given. Returns
 * { index, letter }, or null once only one unknown position is left (a hint never gives the word away).
 */
export function getHint(answer, rows, given = []) {
  const known = new Set(given)
  for (const { result } of rows) result.forEach((s, i) => s === CORRECT && known.add(i))
  if (known.size >= WORD_LENGTH - 1) return null
  for (let i = 0; i < WORD_LENGTH; i++) if (!known.has(i)) return { index: i, letter: answer[i] }
  return null
}

/** Why a typed word can't be submitted, or null if it can. Checks order: length, dictionary, hard mode. */
export function guessError(word, { rows = [], hard = false, given = [], answer } = {}) {
  const w = normalize(word)
  if (w.length < WORD_LENGTH) return 'Not enough letters'
  if (!isValidGuess(w)) return 'Not in word list'
  if (hard) {
    const broken = hardModeError(rows, w)
    if (broken) return broken
    for (const i of given) if (answer && w[i] !== answer[i]) return `${['1st', '2nd', '3rd', '4th', '5th'][i]} letter must be ${answer[i].toUpperCase()}`
  }
  return null
}

/** Stars for a solved word: 3 for ≤3 guesses, 2 for 4–5, 1 for 6. A hint caps it at 2. */
export function starsFor(guesses, hintsUsed = 0) {
  const s = guesses <= 3 ? 3 : guesses <= 5 ? 2 : 1
  return hintsUsed > 0 ? Math.min(s, 2) : s
}

/** Points for a solved word: fewer guesses score more; hard mode adds half again; each hint costs 50. */
export function scoreFor(guesses, { hard = false, hintsUsed = 0 } = {}) {
  const base = 100 * (MAX_GUESSES + 1 - guesses)
  return Math.max(50, Math.round(base * (hard ? 1.5 : 1)) - 50 * hintsUsed)
}

/** Spoiler-free share grid. */
export const shareGrid = rows =>
  rows.map(r => r.result.map(s => (s === CORRECT ? '🟩' : s === PRESENT ? '🟨' : '⬜')).join('')).join('\n')
