// Global player settings shared by every game.
import { createPersistentStore, useStore } from './storage'

export const THEMES = [
  { id: 'paper', label: 'Paper (light)' },
  { id: 'dark', label: 'Midnight (dark)' },
  { id: 'colorblind', label: 'Colour-blind friendly' },
]

export const settingsStore = createPersistentStore('settings', {
  sound: true,
  volume: 0.6,
  haptics: true,
  theme: 'paper',
  motion: 'system', // 'system' | 'reduce' | 'full'
})

export const useSettings = () => useStore(settingsStore)
export const updateSettings = patch => settingsStore.set(s => ({ ...s, ...patch }))

export function prefersReducedMotion() {
  const m = settingsStore.get().motion
  if (m === 'reduce') return true
  if (m === 'full') return false
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

function apply() {
  if (typeof document === 'undefined') return
  const s = settingsStore.get()
  document.documentElement.dataset.gameTheme = s.theme
  document.documentElement.dataset.reducedMotion = prefersReducedMotion() ? '1' : '0'
}
apply()
settingsStore.subscribe(apply)
