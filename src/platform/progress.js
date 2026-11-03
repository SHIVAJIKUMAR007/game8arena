// Per-game saved progress (levels, stars, scores, stats, achievements, daily streak).
// Stored in localStorage today; the store interface is small so it can be swapped for a backend later.
import { createPersistentStore, useStore, STORAGE_PREFIX } from './storage'

const DEFAULT = {
  level: 1, // next level to play in campaign
  best: 0, // highest level cleared
  stars: {}, // { [level]: 1..3 }
  highScore: 0,
  extraLives: 0, // banked by flawless levels
  tutorialSeen: false,
  stats: { cleared: 0, flawless: 0, launches: 0, blocked: 0, bestCombo: 0, hints: 0 },
  achievements: {}, // { [id]: unlockedAtMs }
  daily: { last: null, streak: 0, best: 0, history: {} },
}

const merge = (d, s) => ({
  ...d,
  ...s,
  stars: { ...s.stars },
  achievements: { ...s.achievements },
  stats: { ...d.stats, ...s.stats },
  daily: { ...d.daily, ...s.daily },
})

const stores = new Map()
export function progressStore(gameId) {
  if (!stores.has(gameId)) stores.set(gameId, createPersistentStore(`progress:${gameId}`, DEFAULT, merge))
  return stores.get(gameId)
}

export const useProgress = gameId => useStore(progressStore(gameId))
export const getProgress = gameId => progressStore(gameId).get()
export const updateProgress = (gameId, fn) => progressStore(gameId).set(fn)

export const totalStars = p => Object.values(p.stars).reduce((t, n) => t + n, 0)

export function resetAllProgress() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(`${STORAGE_PREFIX}progress:`))
      .forEach(k => localStorage.removeItem(k))
  } catch { /* ignore */ }
  location.reload()
}
