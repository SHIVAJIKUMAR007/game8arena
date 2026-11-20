// Where the player left off: the level to play and the score carried into it. Stars and the best score live in the
// shared progress store (platform/progress.js) so the home card and side panel show them like for every game.
import { createPersistentStore } from '../../platform/storage'

const DEFAULT = { level: 1, score: 0 }

const merge = (d, s) => ({
  level: Number.isInteger(s?.level) && s.level >= 1 && s.level < 100000 ? s.level : d.level,
  score: Number.isFinite(s?.score) && s.score >= 0 ? Math.floor(s.score) : d.score,
})

export const surgeStore = createPersistentStore('bubbles', DEFAULT, merge)

export const saveSurge = (level, score) => surgeStore.set({ level, score })
export const resetSurge = () => surgeStore.set(DEFAULT)
