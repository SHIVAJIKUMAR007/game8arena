// Safe, versioned localStorage + tiny external stores usable with React.
// Every access is wrapped in try/catch: private mode / blocked storage must never crash a game.
import { useSyncExternalStore } from 'react'

export const STORAGE_PREFIX = 'arcadehub:v1:'

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(key) {
  try { localStorage.removeItem(STORAGE_PREFIX + key) } catch { /* ignore */ }
}

/** In-memory observable store. State objects must be replaced, never mutated. */
export function createStore(initial) {
  let state = initial
  const listeners = new Set()
  return {
    get: () => state,
    set(next) {
      const value = typeof next === 'function' ? next(state) : next
      if (Object.is(value, state)) return
      state = value
      listeners.forEach(l => l())
    },
    subscribe(l) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
}

/** Store that persists to localStorage and syncs across tabs. `merge` fills in fields added in newer versions. */
export function createPersistentStore(key, initial, merge = (d, s) => ({ ...d, ...s })) {
  const store = createStore(merge(initial, readJSON(key, {})))
  const rawSet = store.set
  store.set = next => {
    rawSet(next)
    writeJSON(key, store.get())
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', e => {
      if (e.key === STORAGE_PREFIX + key) rawSet(merge(initial, readJSON(key, {})))
    })
  }
  return store
}

export const useStore = store => useSyncExternalStore(store.subscribe, store.get)
