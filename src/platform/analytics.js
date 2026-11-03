// Vendor-neutral analytics. Nothing is recorded until the player consents.
// Events go to a local ring buffer and, if VITE_ANALYTICS_URL is set, to that endpoint via sendBeacon.
import { createPersistentStore, useStore, readJSON, writeJSON } from './storage'

export const consentStore = createPersistentStore('consent', { analytics: null }) // null = not asked yet
export const useConsent = () => useStore(consentStore)
export const setAnalyticsConsent = analytics => consentStore.set({ analytics })

const BUFFER_KEY = 'analytics:buffer'
const MAX_BUFFER = 200

export function track(name, props = {}) {
  if (consentStore.get().analytics !== true) return
  const event = { name, props, t: Date.now() }
  const buffer = readJSON(BUFFER_KEY, [])
  writeJSON(BUFFER_KEY, [...buffer, event].slice(-MAX_BUFFER))
  try {
    const url = import.meta.env?.VITE_ANALYTICS_URL
    if (url) navigator.sendBeacon?.(url, JSON.stringify(event))
    else if (import.meta.env?.DEV) console.debug('[analytics]', name, props)
  } catch { /* analytics must never break the game */ }
}
