// Saved game + colour theme for Blocky Blitz. Best score and level live in the shared progress store
// (platform/progress.js) so the home card and the side panel show them like for every other game.
import { createPersistentStore } from '../../platform/storage'
import { sanitizeState, serializeState } from './logic'

export const THEME_COUNT = 4
export const THEME_NAMES = ['Blue', 'Purple night', 'Green forest', 'Sunset']

const DEFAULT = { theme: 0, save: null }

const merge = (d, s) => ({
  theme: Number.isInteger(s?.theme) && s.theme >= 0 && s.theme < THEME_COUNT ? s.theme : d.theme,
  save: s && typeof s.save === 'object' ? s.save : d.save,
})

export const blockyStore = createPersistentStore('blocky', DEFAULT, merge)

/** The saved game if there is a valid one still in progress, otherwise null (corrupt or finished saves are dropped). */
export function loadSavedGame() {
  const state = sanitizeState(blockyStore.get().save)
  return state && !state.over ? state : null
}

export const saveGame = state => blockyStore.set(s => ({ ...s, save: serializeState(state) }))
export const clearSavedGame = () => blockyStore.set(s => (s.save === null ? s : { ...s, save: null }))
export const setTheme = theme => blockyStore.set(s => ({ ...s, theme: ((theme % THEME_COUNT) + THEME_COUNT) % THEME_COUNT }))
