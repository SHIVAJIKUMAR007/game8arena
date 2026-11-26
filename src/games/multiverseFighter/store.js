// Saved state for Multiverse Fighter: coins, level and XP, unlocked fighters, upgrades, the selected fighter and the
// daily-reward timestamp. Sound on/off and volume stay in the shared platform/settings store.
// Every load goes through sanitizeSave(), so a missing, malformed, wrong-version or hand-edited save falls back to safe
// defaults field by field and can never crash the game. The helpers below are pure: they take a save and return a new one.
import { createPersistentStore, useStore } from '../../platform/storage'
import { MAX_UPGRADE, START_UNLOCKED, fighterById, isFighterId, upgradeCost } from './roster'

export const GAME_ID = 'multiverse'
export const SAVE_VERSION = 1
export const START_COINS = 65
export const XP_PER_LEVEL = 100
export const WIN_REWARD = 30
export const LOSS_REWARD = 10
export const DAILY_REWARD = 50
export const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000
export const AD_REWARD = 25
export const AD_SECONDS = 3

export const DEFAULT_SAVE = Object.freeze({
  v: SAVE_VERSION,
  coins: START_COINS,
  level: 1,
  xp: 0,
  selected: 'cap',
  unlocked: [...START_UNLOCKED],
  upgrades: {},
  lastDaily: 0,
  wins: 0,
  losses: 0,
  onlineWins: 0,
})

const isObj = v => v && typeof v === 'object' && !Array.isArray(v)
const int = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : d)

const fresh = () => ({ ...DEFAULT_SAVE, unlocked: [...START_UNLOCKED], upgrades: {} })

/** Rebuilds a save from untrusted data. Never throws. */
export function sanitizeSave(raw) {
  if (!isObj(raw) || raw.v !== SAVE_VERSION) return fresh()
  const unlocked = new Set(START_UNLOCKED)
  if (Array.isArray(raw.unlocked)) for (const id of raw.unlocked) if (isFighterId(id)) unlocked.add(id)
  const upgrades = {}
  if (isObj(raw.upgrades)) {
    for (const [id, u] of Object.entries(raw.upgrades)) {
      if (!isFighterId(id) || !isObj(u)) continue
      const power = int(u.power, 0, MAX_UPGRADE, 0)
      const health = int(u.health, 0, MAX_UPGRADE, 0)
      if (power || health) upgrades[id] = { power, health }
    }
  }
  const selected = isFighterId(raw.selected) && unlocked.has(raw.selected) ? raw.selected : 'cap'
  return {
    v: SAVE_VERSION,
    coins: int(raw.coins, 0, 9_999_999, START_COINS),
    level: int(raw.level, 1, 999, 1),
    xp: int(raw.xp, 0, XP_PER_LEVEL - 1, 0),
    selected,
    unlocked: [...unlocked],
    upgrades,
    lastDaily: Number.isFinite(raw.lastDaily) && raw.lastDaily > 0 ? Math.floor(raw.lastDaily) : 0,
    wins: int(raw.wins, 0, 1_000_000, 0),
    losses: int(raw.losses, 0, 1_000_000, 0),
    onlineWins: int(raw.onlineWins, 0, 1_000_000, 0),
  }
}

// ───────────── pure helpers ─────────────
export const upgradesOf = (save, id) => save.upgrades[id] || { power: 0, health: 0 }
export const isUnlocked = (save, id) => save.unlocked.includes(id)

/** Win +30 coins and XP, loss +10. A level is XP_PER_LEVEL XP. */
export function applyFightResult(save, { won }) {
  const gain = won ? WIN_REWARD : LOSS_REWARD
  let xp = save.xp + gain
  let level = save.level
  let levelUp = false
  while (xp >= XP_PER_LEVEL) {
    xp -= XP_PER_LEVEL
    level++
    levelUp = true
  }
  return {
    save: { ...save, coins: save.coins + gain, xp, level, wins: save.wins + (won ? 1 : 0), losses: save.losses + (won ? 0 : 1) },
    coins: gain,
    xp: gain,
    levelUp,
  }
}

export function buyFighter(save, id) {
  if (!isFighterId(id)) return { ok: false, reason: 'unknown', save }
  if (isUnlocked(save, id)) return { ok: true, reason: 'owned', save }
  const price = fighterById(id).price
  if (save.coins < price) return { ok: false, reason: 'coins', save }
  return { ok: true, reason: 'bought', save: { ...save, coins: save.coins - price, unlocked: [...save.unlocked, id] } }
}

/** @param {'power'|'health'} kind */
export function buyUpgrade(save, id, kind) {
  if (!isFighterId(id) || (kind !== 'power' && kind !== 'health') || !isUnlocked(save, id)) return { ok: false, reason: 'unknown', save }
  const u = upgradesOf(save, id)
  if (u[kind] >= MAX_UPGRADE) return { ok: false, reason: 'max', save }
  const cost = upgradeCost(u[kind])
  if (save.coins < cost) return { ok: false, reason: 'coins', save }
  return { ok: true, reason: 'bought', save: { ...save, coins: save.coins - cost, upgrades: { ...save.upgrades, [id]: { ...u, [kind]: u[kind] + 1 } } } }
}

export function selectFighter(save, id) {
  return isFighterId(id) && isUnlocked(save, id) ? { ...save, selected: id } : save
}

export const dailyRemaining = (save, now) => Math.max(0, save.lastDaily + DAILY_COOLDOWN_MS - now)

export function claimDaily(save, now) {
  const wait = dailyRemaining(save, now)
  if (wait > 0) return { ok: false, remainingMs: wait, save }
  return { ok: true, remainingMs: 0, coins: DAILY_REWARD, save: { ...save, coins: save.coins + DAILY_REWARD, lastDaily: now } }
}

export const addCoins = (save, n) => ({ ...save, coins: save.coins + Math.max(0, Math.floor(n)) })

/** The computer opponent's strength grows with the player's level and never past x1.6. */
export function aiProfile(level) {
  const l = Math.max(1, level)
  return { scale: Math.min(1.6, 1 + 0.04 * (l - 1)), card: Math.min(MAX_UPGRADE, 1 + Math.floor((l - 1) / 2)) }
}

/** A random fighter that is not the player's. `rand` returns a number in [0, 1). */
export function pickOpponent(playerId, rand = Math.random) {
  const pool = ['cap', 'ironman', 'thor', 'panther', 'hulk', 'spidey', 'paul', 'chani', 'stilgar', 'duncan', 'feyd', 'baron'].filter(id => id !== playerId)
  return pool[Math.floor(rand() * pool.length) % pool.length]
}

// ───────────── store ─────────────
export const mvStore = createPersistentStore(GAME_ID, fresh(), (_defaults, saved) => sanitizeSave(saved))
export const useMv = () => useStore(mvStore)
export const getMv = () => mvStore.get()
export const updateMv = fn => mvStore.set(s => sanitizeSave(typeof fn === 'function' ? fn(s) : { ...s, ...fn }))
