// Solitaire saved data. Like Minesweeper, it lives inside the shared per-game progress store (platform/progress.js),
// next to the standard fields (level, best, stars, highScore, stats…), under three extra keys:
//   solStats  { played, won, streak, maxStreak, open, totalTime,
//               modes: { d1, d3 }: { played, won, times[], fewestMoves, bestScore } }   (per draw mode)
//   solSaves  { campaign, random }: the game in progress for each slot, so a reload resumes it
//   solPrefs  { draw: 1 | 3, autoFinish: boolean }
// A save holds the deal's seed and the list of moves, not the cards: the game is rebuilt by replaying the moves
// (rules.replay), which also rejects any save that would lead to an impossible position.
// Everything read back is sanitised: missing, corrupted or old-version values fall back to safe defaults.
import { isMoveShape } from './rules'

export const GAME_ID = 'solitaire'
export const SAVE_VERSION = 1
export const MODE_KEYS = ['d1', 'd3']
export const BEST_TIMES_KEPT = 5
const MAX_SAVED_MOVES = 5000
const MAX_SECONDS = 24 * 3600

const count = v => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)
const object = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})
const positiveOrNull = v => (Number.isFinite(v) && v > 0 ? Math.floor(v) : null)

export const modeKey = draw => (draw === 3 ? 'd3' : 'd1')

function readModeStats(m) {
  m = object(m)
  const won = count(m.won)
  const times = (Array.isArray(m.times) ? m.times : [])
    .filter(t => Number.isFinite(t) && t > 0 && t <= MAX_SECONDS)
    .map(Math.round)
    .sort((a, b) => a - b)
    .slice(0, BEST_TIMES_KEPT)
  return {
    played: Math.max(count(m.played), won),
    won,
    times,
    fewestMoves: won ? positiveOrNull(m.fewestMoves) : null,
    bestScore: count(m.bestScore),
  }
}

/** Statistics from a progress object, always well-formed. */
export function readStats(p) {
  const s = object(p?.solStats)
  const modes = Object.fromEntries(MODE_KEYS.map(k => [k, readModeStats(object(s.modes)[k])]))
  const won = MODE_KEYS.reduce((t, k) => t + modes[k].won, 0)
  const played = MODE_KEYS.reduce((t, k) => t + modes[k].played, 0)
  const streak = Math.min(count(s.streak), won)
  return {
    played,
    won,
    streak,
    maxStreak: Math.max(Math.min(count(s.maxStreak), won), streak),
    open: s.open === true,
    totalTime: count(s.totalTime),
    modes,
  }
}

/**
 * Stats after a game is started (first move made). Starting while the previous game was left unfinished ends the
 * win streak, since that game was given up.
 */
export function recordStart(stats, { draw }) {
  const s = readStats({ solStats: stats })
  const k = modeKey(draw)
  return { ...s, streak: s.open ? 0 : s.streak, open: true, modes: { ...s.modes, [k]: { ...s.modes[k], played: s.modes[k].played + 1 } } }
}

/** Stats after a win. `time` is in seconds. */
export function recordWin(stats, { draw, time, moves, score }) {
  const s = readStats({ solStats: stats })
  const k = modeKey(draw)
  const m = s.modes[k]
  const streak = s.streak + 1
  return {
    ...s,
    won: s.won + 1,
    streak,
    maxStreak: Math.max(s.maxStreak, streak),
    open: false,
    totalTime: s.totalTime + Math.round(time || 0),
    modes: {
      ...s.modes,
      [k]: {
        played: Math.max(m.played, m.won + 1),
        won: m.won + 1,
        times: [...m.times, Math.max(1, Math.round(time))].sort((a, b) => a - b).slice(0, BEST_TIMES_KEPT),
        fewestMoves: m.fewestMoves === null ? moves : Math.min(m.fewestMoves, moves),
        bestScore: Math.max(m.bestScore, score),
      },
    },
  }
}

/** Display numbers: win percentage, average win time, and per-mode bests. */
export function summarize(stats) {
  const s = readStats({ solStats: stats })
  return {
    ...s,
    winPct: s.played ? Math.round((100 * s.won) / s.played) : 0,
    averageTime: s.won ? Math.round(s.totalTime / s.won) : 0,
    bestTime: Object.fromEntries(MODE_KEYS.map(k => [k, s.modes[k].times[0] ?? null])),
  }
}

/** Player preferences for this game. */
export function readPrefs(p) {
  const s = object(p?.solPrefs)
  return { draw: s.draw === 3 ? 3 : 1, autoFinish: s.autoFinish !== false }
}

/**
 * A saved game, or null if missing, corrupted or from another save version. When `key` is given it must match, so a
 * level-7 save is never loaded into level 8, nor a draw-one save into a draw-three game. Moves are only checked for
 * shape here; replaying them (rules.replay) checks that each one is legal.
 */
export function readSave(p, slot, key) {
  const s = object(p?.solSaves)[slot]
  if (!s || typeof s !== 'object' || s.v !== SAVE_VERSION || typeof s.key !== 'string') return null
  if (key !== undefined && s.key !== key) return null
  if (!Array.isArray(s.moves) || s.moves.length > MAX_SAVED_MOVES || !s.moves.every(isMoveShape)) return null
  return {
    v: SAVE_VERSION,
    key: s.key,
    seed: typeof s.seed === 'string' ? s.seed : '',
    moves: s.moves.map(m => (m.type === 'draw' ? { type: 'draw' } : { type: 'move', from: m.from, to: m.to, count: m.count ?? 1 })),
    elapsed: Math.min(count(s.elapsed), MAX_SECONDS),
    hints: Math.min(count(s.hints), 999),
    undos: Math.min(count(s.undos), 99999),
  }
}

/** Seconds as m:ss (or h:mm:ss) for display. */
export function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
