import { settingsStore } from './settings'

export function vibrate(pattern = 40) {
  if (!settingsStore.get().haptics) return
  try { navigator.vibrate?.(pattern) } catch { /* unsupported */ }
}
