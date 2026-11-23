// Saved Family Sort state: coins, level, completed levels, settings, unlocks and the game in progress.
// Everything read back from storage is checked field by field, so a corrupted, hand-edited, missing or
// older/newer save falls back to safe defaults and can never crash the game.
import { createPersistentStore } from '../../platform/storage'
import { updateProgress } from '../../platform/progress'
import { CAPACITY, validateBottles } from './logic'
import { START_COINS, shopItem } from './economy'

export const STORE_KEY = 'family'
export const GAME_ID = 'family'
/** Bump when the saved shape changes in a way old saves cannot be read: a mismatch resets to the defaults. */
export const STORE_VERSION = 1
const MAX_LEVEL = 100000
const MAX_COINS = 1e9
const MAX_COMPLETED = 5000

export const DEFAULT = {
  v: STORE_VERSION,
  level: 1,
  coins: START_COINS,
  bestScore: 0,
  hintsUsed: 0,
  completed: {}, // { [level]: { moves, hints, time, stars, score } }
  owned: { bottles: ['classic'], backgrounds: ['garden'] },
  equipped: { bottle: 'classic', background: 'garden' },
  settings: { music: false, symbols: false },
  session: null, // { level, bottles, moves, hints, elapsed }: the unfinished level
}

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const int = (v, min, max, fallback) => (Number.isFinite(v) && Math.floor(v) >= min && Math.floor(v) <= max ? Math.floor(v) : fallback)

function cleanOwned(raw, kind, free) {
  const list = Array.isArray(raw?.[kind]) ? raw[kind].filter(id => typeof id === 'string' && shopItem(kind, id)) : []
  return [...new Set([free, ...list])]
}

function cleanCompleted(raw) {
  const out = {}
  if (!isObj(raw)) return out
  for (const [k, r] of Object.entries(raw).slice(0, MAX_COMPLETED)) {
    const level = int(Number(k), 1, MAX_LEVEL, 0)
    if (!level || !isObj(r)) continue
    out[level] = {
      moves: int(r.moves, 0, 1e6, 0),
      hints: int(r.hints, 0, 1e6, 0),
      time: int(r.time, 0, 1e9, 0),
      stars: int(r.stars, 1, 3, 1),
      score: int(r.score, 0, 1e9, 0),
    }
  }
  return out
}

function cleanSession(raw, level) {
  if (!isObj(raw) || raw.level !== level || !Array.isArray(raw.bottles) || raw.bottles.length > 16) return null
  if (!validateBottles(raw.bottles, CAPACITY).ok) return null
  return {
    level,
    bottles: raw.bottles.map(b => b.slice()),
    moves: int(raw.moves, 0, 1e6, 0),
    hints: int(raw.hints, 0, 1e6, 0),
    elapsed: int(raw.elapsed, 0, 1e9, 0),
  }
}

const fresh = d => ({ ...d, completed: {}, owned: { ...d.owned }, equipped: { ...d.equipped }, settings: { ...d.settings } })

/** Fills in anything missing or invalid from the defaults. `s` is whatever came out of storage. */
export function merge(d, s) {
  if (!isObj(s) || s.v !== STORE_VERSION) return fresh(d)
  const owned = { bottles: cleanOwned(s.owned, 'bottles', 'classic'), backgrounds: cleanOwned(s.owned, 'backgrounds', 'garden') }
  const pick = (kind, key, fallback) => {
    const id = s.equipped?.[key]
    return typeof id === 'string' && owned[kind].includes(id) ? id : fallback
  }
  const level = int(s.level, 1, MAX_LEVEL, d.level)
  return {
    v: STORE_VERSION,
    level,
    coins: int(s.coins, 0, MAX_COINS, d.coins),
    bestScore: int(s.bestScore, 0, 1e9, 0),
    hintsUsed: int(s.hintsUsed, 0, 1e9, 0),
    completed: cleanCompleted(s.completed),
    owned,
    equipped: { bottle: pick('bottles', 'bottle', 'classic'), background: pick('backgrounds', 'background', 'garden') },
    settings: { music: s.settings?.music === true, symbols: s.settings?.symbols === true },
    session: cleanSession(s.session, level),
  }
}

export const familyStore = createPersistentStore(STORE_KEY, DEFAULT, merge)

// Every write goes back through merge, so nothing invalid can be saved either.
const update = fn => familyStore.set(s => merge(DEFAULT, { ...fn(s), v: STORE_VERSION }))

/** Adds coins (negative to spend). Returns false and changes nothing when the player cannot afford it. */
export function addCoins(amount) {
  if (familyStore.get().coins + amount < 0) return false
  update(s => ({ ...s, coins: s.coins + amount }))
  return true
}

export const recordHint = () => update(s => ({ ...s, hintsUsed: s.hintsUsed + 1 }))

/** Saves the unfinished level so a reload picks up where the player left off. */
export const saveSession = session => update(s => ({ ...s, session }))

const SLOT = { bottles: 'bottle', backgrounds: 'background' }

/** Buys a shop item and equips it. Returns false when unknown, already owned or too expensive. */
export function buyItem(kind, id) {
  const item = shopItem(kind, id)
  const s = familyStore.get()
  if (!item || s.owned[kind].includes(id) || s.coins < item.price) return false
  update(st => ({
    ...st,
    coins: st.coins - item.price,
    owned: { ...st.owned, [kind]: [...st.owned[kind], id] },
    equipped: { ...st.equipped, [SLOT[kind]]: id },
  }))
  return true
}

export function equipItem(kind, id) {
  if (!SLOT[kind] || !familyStore.get().owned[kind].includes(id)) return false
  update(st => ({ ...st, equipped: { ...st.equipped, [SLOT[kind]]: id } }))
  return true
}

export const setSetting = patch => update(s => ({ ...s, settings: { ...s.settings, ...patch } }))

/** Records a cleared level: pays the coins, keeps the best result, and unlocks the next level. */
export function completeLevel(level, { moves, hints, time, stars, score, reward }) {
  update(s => {
    const prev = s.completed[level]
    const better = !prev || stars > prev.stars || (stars === prev.stars && score > prev.score)
    return {
      ...s,
      level: Math.max(s.level, level + 1),
      coins: s.coins + reward,
      bestScore: Math.max(s.bestScore, score),
      completed: { ...s.completed, [level]: better ? { moves, hints, time, stars, score } : prev },
      session: null,
    }
  })
  // Feeds the shared progress store so the game page and home card show the best level, stars and score.
  updateProgress(GAME_ID, p => ({
    ...p,
    best: Math.max(p.best, level),
    level: Math.max(p.level, level + 1),
    highScore: Math.max(p.highScore, score),
    stars: { ...p.stars, [level]: Math.max(p.stars[level] || 0, stars) },
    stats: { ...p.stats, cleared: p.stats.cleared + (p.stars[level] ? 0 : 1), flawless: p.stats.flawless + (hints === 0 ? 1 : 0) },
  }))
}

/** Moves on to a level (used by Next Level) and drops any saved session. */
export const setLevel = level => update(s => ({ ...s, level: int(level, 1, MAX_LEVEL, s.level), session: null }))

export const resetFamily = () => familyStore.set(() => merge(DEFAULT, {}))
