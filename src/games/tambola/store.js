// Tambola saved data. The shared progress store (platform/progress.js) already keeps the current level, cleared
// levels, stars and best score. Tambola adds one key next to them:
//   tbStats  { won, hints, bestTimes: { [level]: seconds } }   hints used overall, fastest win per level
// Everything read back is sanitised, so missing, malformed or hand-edited data falls back to safe defaults.
import { updateProgress } from '../../platform/progress'

export const GAME_ID = 'tambola'
const MAX_TIMES_KEPT = 200 // far above any real number of levels; stops absurd saved objects being trusted

const count = v => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)
const object = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})

export function readStats(p) {
  const s = object(p?.tbStats)
  const bestTimes = {}
  for (const [level, t] of Object.entries(object(s.bestTimes)).slice(0, MAX_TIMES_KEPT)) {
    if (/^[1-9]\d*$/.test(level) && Number.isFinite(t) && t > 0) bestTimes[level] = Math.round(t * 10) / 10
  }
  return { won: count(s.won), hints: count(s.hints), bestTimes }
}

/** Stats after a cleared level. `seconds` is how long the round took. */
export function withWin(stats, { level, seconds }) {
  const s = readStats({ tbStats: stats })
  const prev = s.bestTimes[level]
  const time = Math.round(seconds * 10) / 10
  const bestTimes = Number.isFinite(time) && time > 0 && (prev === undefined || time < prev) ? { ...s.bestTimes, [level]: time } : s.bestTimes
  return { ...s, won: s.won + 1, bestTimes }
}

export const withHint = stats => {
  const s = readStats({ tbStats: stats })
  return { ...s, hints: s.hints + 1 }
}

export const recordWin = (level, seconds) => updateProgress(GAME_ID, p => ({ ...p, tbStats: withWin(p.tbStats, { level, seconds }) }))
export const recordHint = () => updateProgress(GAME_ID, p => ({ ...p, tbStats: withHint(p.tbStats) }))
