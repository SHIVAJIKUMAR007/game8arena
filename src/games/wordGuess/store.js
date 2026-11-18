// Word Guess saved data. It lives inside the shared per-game progress store (platform/progress.js), next to
// the standard fields (level, best, stars, highScore, daily…), under three extra keys:
//   wordStats  { played, wins, streak, maxStreak, guessTotal, dist[6] }
//   wordHard   hard-mode preference (boolean)
//   wordSaves  { campaign, daily }: the word in progress (or today's finished daily), so a reload resumes it
// Everything read back is sanitised: missing or corrupted values fall back to safe defaults.
import { MAX_GUESSES, WORD_LENGTH, isValidGuess, normalize } from './logic'

export const GAME_ID = 'word'

const count = v => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)

export function readStats(p) {
  const s = p?.wordStats && typeof p.wordStats === 'object' ? p.wordStats : {}
  const dist = Array.from({ length: MAX_GUESSES }, (_, i) => count(Array.isArray(s.dist) ? s.dist[i] : 0))
  const wins = count(s.wins)
  return {
    played: Math.max(count(s.played), wins),
    wins,
    streak: Math.min(count(s.streak), wins),
    maxStreak: Math.max(Math.min(count(s.maxStreak), wins), Math.min(count(s.streak), wins)),
    guessTotal: count(s.guessTotal),
    dist,
  }
}

/** Stats after one finished word. */
export function recordResult(stats, { won, guesses }) {
  const s = readStats({ wordStats: stats })
  const streak = won ? s.streak + 1 : 0
  const dist = s.dist.slice()
  if (won && guesses >= 1 && guesses <= MAX_GUESSES) dist[guesses - 1]++
  return {
    played: s.played + 1,
    wins: s.wins + (won ? 1 : 0),
    streak,
    maxStreak: Math.max(s.maxStreak, streak),
    guessTotal: s.guessTotal + (won ? guesses : 0),
    dist,
  }
}

/** Display numbers: win percentage and average guesses per win. */
export function summarize(stats) {
  const s = readStats({ wordStats: stats })
  return {
    ...s,
    winPct: s.played ? Math.round((100 * s.wins) / s.played) : 0,
    average: s.wins ? Math.round((10 * s.guessTotal) / s.wins) / 10 : 0,
  }
}

/** A saved round, or null if missing / corrupted / for a different puzzle key. */
export function readSave(p, slot, key) {
  const s = p?.wordSaves?.[slot]
  if (!s || typeof s !== 'object' || s.key !== key) return null
  const guesses = (Array.isArray(s.guesses) ? s.guesses : [])
    .map(normalize).filter(isValidGuess).slice(0, MAX_GUESSES)
  const given = [...new Set((Array.isArray(s.given) ? s.given : [])
    .filter(i => Number.isInteger(i) && i >= 0 && i < WORD_LENGTH))]
  return { key, guesses, given, hard: Boolean(s.hard), recorded: Boolean(s.recorded) }
}

export const readHard = p => Boolean(p?.wordHard)
