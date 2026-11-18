// Minesweeper saved data. Like Word Guess, it lives inside the shared per-game progress store
// (platform/progress.js), next to the standard fields (level, best, stars, highScore, daily…), under two extra keys:
//   msStats  { played, won, streak, maxStreak, totalTime, modes: { [mode]: { played, won, times[] } } }
//            modes: beginner | intermediate | expert | level | daily. `times` holds the five best win times (seconds).
//   msSaves  { campaign, daily, classic }: the game in progress for each slot, so a reload resumes it.
// Everything read back is sanitised: missing or corrupted values fall back to safe defaults.

export const GAME_ID = 'minesweeper'
export const MODES = ['beginner', 'intermediate', 'expert', 'level', 'daily']
export const BEST_TIMES_KEPT = 5
const MAX_CELLS = 2000 // far above any real grid; stops absurd saved arrays being trusted

const count = v => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)
const object = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})

function readModeStats(m) {
  m = object(m)
  const won = count(m.won)
  const times = (Array.isArray(m.times) ? m.times : [])
    .filter(t => Number.isFinite(t) && t > 0)
    .map(t => Math.round(t * 10) / 10)
    .sort((a, b) => a - b)
    .slice(0, BEST_TIMES_KEPT)
  return { played: Math.max(count(m.played), won), won, times }
}

export function readStats(p) {
  const s = object(p?.msStats)
  const modes = Object.fromEntries(MODES.map(id => [id, readModeStats(object(s.modes)[id])]))
  const won = Object.values(modes).reduce((t, m) => t + m.won, 0)
  const played = Object.values(modes).reduce((t, m) => t + m.played, 0)
  const streak = Math.min(count(s.streak), won)
  return { played, won, streak, maxStreak: Math.max(Math.min(count(s.maxStreak), won), streak), totalTime: count(s.totalTime), modes }
}

/** Stats after one finished game. `time` is in seconds. */
export function recordResult(stats, { mode, won, time }) {
  const s = readStats({ msStats: stats })
  const m = s.modes[mode] || readModeStats(null)
  const times = won ? [...m.times, time].sort((a, b) => a - b).slice(0, BEST_TIMES_KEPT) : m.times
  const streak = won ? s.streak + 1 : 0
  return {
    played: s.played + 1,
    won: s.won + (won ? 1 : 0),
    streak,
    maxStreak: Math.max(s.maxStreak, streak),
    totalTime: s.totalTime + Math.round(time || 0),
    modes: { ...s.modes, [mode]: { played: m.played + 1, won: m.won + (won ? 1 : 0), times } },
  }
}

/** Display numbers: win percentage, average win time, and the best time per mode. */
export function summarize(stats) {
  const s = readStats({ msStats: stats })
  return {
    ...s,
    winPct: s.played ? Math.round((100 * s.won) / s.played) : 0,
    averageTime: s.won ? Math.round(s.totalTime / s.won) : 0,
    best: Object.fromEntries(MODES.map(id => [id, s.modes[id].times[0] ?? null])),
  }
}

const indexList = v =>
  [...new Set((Array.isArray(v) ? v : []).filter(i => Number.isInteger(i) && i >= 0 && i < MAX_CELLS))].sort((a, b) => a - b)

/**
 * A saved game, or null if missing or corrupted. When `key` is given it must match (so a level-7 save is never
 * loaded into level 8, or yesterday's daily into today's). Indexes are only checked against the real grid later,
 * by logic.restore().
 */
export function readSave(p, slot, key) {
  const s = object(p?.msSaves)[slot]
  if (!s || typeof s !== 'object' || typeof s.key !== 'string') return null
  if (key !== undefined && s.key !== key) return null
  if (!Number.isInteger(s.firstIdx) || s.firstIdx < 0 || s.firstIdx >= MAX_CELLS) return null
  return {
    key: s.key,
    mode: typeof s.mode === 'string' ? s.mode : '',
    seed: typeof s.seed === 'string' ? s.seed : '',
    firstIdx: s.firstIdx,
    revealed: indexList(s.revealed),
    flags: indexList(s.flags),
    elapsed: Math.min(count(s.elapsed), 24 * 3600),
    hints: Math.min(count(s.hints), 99),
  }
}

/** Seconds as m:ss for display. */
export const formatTime = sec => {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
