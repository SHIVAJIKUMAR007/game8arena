// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_PREFIX, createPersistentStore, createStore, readJSON, removeKey, writeJSON } from './storage'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('safe storage', () => {
  it('round-trips JSON and returns the fallback for a missing key', () => {
    expect(readJSON('t', 'fallback')).toBe('fallback')
    expect(writeJSON('t', { a: 1 })).toBe(true)
    expect(readJSON('t', null)).toEqual({ a: 1 })
    removeKey('t')
    expect(readJSON('t', 'gone')).toBe('gone')
  })

  it('returns the fallback for corrupted or truncated data instead of throwing', () => {
    for (const bad of ['{not json', '{"a":', '', 'undefined', '\u0000']) {
      localStorage.setItem(`${STORAGE_PREFIX}bad`, bad)
      expect(() => readJSON('bad', 'safe')).not.toThrow()
      expect(readJSON('bad', 'safe')).toBe('safe')
    }
  })

  it('survives storage that is blocked, full or missing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked') })
    expect(readJSON('x', 7)).toBe(7)
    expect(writeJSON('x', 1)).toBe(false)
    expect(() => removeKey('x')).not.toThrow()
  })
})

describe('persistent store', () => {
  const merge = (d, s) => ({ ...d, n: Number.isFinite(s?.n) ? s.n : d.n })

  it('loads saved values through merge, so bad data falls back to the defaults', () => {
    localStorage.setItem(`${STORAGE_PREFIX}p`, JSON.stringify({ n: 'many' }))
    expect(createPersistentStore('p', { n: 1 }, merge).get()).toEqual({ n: 1 })
    localStorage.setItem(`${STORAGE_PREFIX}p2`, JSON.stringify({ n: 5 }))
    expect(createPersistentStore('p2', { n: 1 }, merge).get()).toEqual({ n: 5 })
  })

  it('saves every change and tells subscribers', () => {
    const store = createPersistentStore('p3', { n: 0 }, merge)
    const seen = []
    const off = store.subscribe(() => seen.push(store.get().n))
    store.set(s => ({ ...s, n: s.n + 1 }))
    store.set({ n: 9 })
    off()
    store.set({ n: 10 })
    expect(seen).toEqual([1, 9])
    expect(readJSON('p3', null)).toEqual({ n: 10 })
  })

  it('does not notify when the state is unchanged', () => {
    const store = createStore({ a: 1 })
    let calls = 0
    store.subscribe(() => calls++)
    store.set(s => s)
    expect(calls).toBe(0)
  })
})
