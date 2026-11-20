// How many times this player has opened each game. Stored on this device only (localStorage), never sent anywhere.
import { createPersistentStore, useStore } from './storage'

const store = createPersistentStore('plays', { counts: {} }, (d, s) => ({
  counts: s && typeof s.counts === 'object' && s.counts ? s.counts : d.counts,
}))

const recent = new Map()

/** Count one play. Repeat calls for the same game within 3s (React StrictMode, quick remounts) count once. */
export function recordPlay(gameId, now = Date.now()) {
  if (now - (recent.get(gameId) || 0) < 3000) return
  recent.set(gameId, now)
  store.set(s => ({ counts: { ...s.counts, [gameId]: (Number(s.counts[gameId]) || 0) + 1 } }))
}

export const usePlays = gameId => {
  const n = Number(useStore(store).counts[gameId])
  return Number.isFinite(n) && n > 0 ? n : 0
}
