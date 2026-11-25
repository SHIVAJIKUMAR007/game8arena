// Saved state for Stickman Fight: coins, what is unlocked and equipped, campaign progress and the music setting.
// The shared sound toggle and volume stay in platform/settings.js. A save that is missing, malformed, from another
// version or full of unknown ids falls back to safe defaults field by field, so a bad save can never crash the game.
import { createPersistentStore, useStore } from '../../platform/storage'
import { COLORS, DESIGNS, EFFECTS, SKINS, WEAPON_ORDER, WEAPONS, byId } from './data'

export const SAVE_VERSION = 1

const free = list => list.filter(x => x.price === 0).map(x => x.id)

export const DEFAULT_SAVE = Object.freeze({
  v: SAVE_VERSION,
  coins: 0,
  level: 1, // next level to play
  best: 0, // highest level cleared
  stars: {},
  weapons: ['sword'],
  skins: ['classic'],
  colors: free(COLORS),
  effects: ['none'],
  designs: [], // `${weapon}:${design}` for bought designs ('classic' is always owned)
  equipped: { weapon: 'sword', skin: 'classic', color: 'blue', effect: 'none', designs: {} },
  music: true,
  wins: { single: 0, p1: 0, p2: 0 },
})

const isObj = v => v && typeof v === 'object' && !Array.isArray(v)
const int = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : d)
const ids = (list, valid, base) => {
  const out = new Set(base)
  if (Array.isArray(list)) for (const x of list) if (typeof x === 'string' && valid(x)) out.add(x)
  return [...out]
}
const designKey = x => {
  const [w, d] = x.split(':')
  return Boolean(WEAPONS[w] && byId(DESIGNS, d) && d !== 'classic')
}

/** Rebuilds a save from untrusted data. Never throws. */
export function sanitizeSave(raw) {
  const d = DEFAULT_SAVE
  if (!isObj(raw) || raw.v !== SAVE_VERSION) return { ...d, stars: {}, colors: [...d.colors], equipped: { ...d.equipped, designs: {} }, wins: { ...d.wins } }
  const weapons = ids(raw.weapons, x => Boolean(WEAPONS[x]), d.weapons)
  const skins = ids(raw.skins, x => Boolean(byId(SKINS, x)), d.skins)
  const colors = ids(raw.colors, x => Boolean(byId(COLORS, x)), d.colors)
  const effects = ids(raw.effects, x => Boolean(byId(EFFECTS, x)), d.effects)
  const designs = ids(raw.designs, x => typeof x === 'string' && designKey(x), [])
  const eq = isObj(raw.equipped) ? raw.equipped : {}
  const pick = (v, owned, fallback) => (typeof v === 'string' && owned.includes(v) ? v : fallback)
  const equippedDesigns = {}
  if (isObj(eq.designs)) {
    for (const [w, des] of Object.entries(eq.designs)) {
      if (WEAPONS[w] && (des === 'classic' || designs.includes(`${w}:${des}`))) equippedDesigns[w] = des
    }
  }
  const stars = {}
  if (isObj(raw.stars)) {
    for (const [k, v] of Object.entries(raw.stars)) {
      const lv = Number(k)
      if (Number.isInteger(lv) && lv >= 1 && lv < 100000 && Number.isFinite(v)) stars[lv] = int(v, 1, 3, 1)
    }
  }
  const best = int(raw.best, 0, 99999, 0)
  const wins = isObj(raw.wins) ? raw.wins : {}
  return {
    v: SAVE_VERSION,
    coins: int(raw.coins, 0, 1e9, 0),
    level: int(raw.level, 1, 100000, best + 1),
    best,
    stars,
    weapons,
    skins,
    colors,
    effects,
    designs,
    equipped: {
      weapon: pick(eq.weapon, weapons, d.equipped.weapon),
      skin: pick(eq.skin, skins, d.equipped.skin),
      color: pick(eq.color, colors, d.equipped.color),
      effect: pick(eq.effect, effects, d.equipped.effect),
      designs: equippedDesigns,
    },
    music: typeof raw.music === 'boolean' ? raw.music : d.music,
    wins: { single: int(wins.single, 0, 1e9, 0), p1: int(wins.p1, 0, 1e9, 0), p2: int(wins.p2, 0, 1e9, 0) },
  }
}

export const stickStore = createPersistentStore('stickman', DEFAULT_SAVE, (d, s) => sanitizeSave(s))
export const useStick = () => useStore(stickStore)
export const getStick = () => stickStore.get()
export const updateStick = fn => stickStore.set(s => sanitizeSave(fn(s)))

// ───────────── pure helpers (return a new save, never mutate) ─────────────
const CATALOG = {
  weapon: { list: WEAPON_ORDER.map(id => WEAPONS[id]), own: 'weapons' },
  skin: { list: SKINS, own: 'skins' },
  color: { list: COLORS, own: 'colors' },
  effect: { list: EFFECTS, own: 'effects' },
}

export function priceOf(kind, id) {
  if (kind === 'design') {
    const [, d] = String(id).split(':')
    return byId(DESIGNS, d)?.price ?? Infinity
  }
  return byId(CATALOG[kind]?.list || [], id)?.price ?? Infinity
}

export function owns(save, kind, id) {
  if (kind === 'design') {
    const [w, d] = String(id).split(':')
    return d === 'classic' || save.designs.includes(id)
      ? Boolean(WEAPONS[w]) && save.weapons.includes(w)
      : false
  }
  return Boolean(CATALOG[kind] && save[CATALOG[kind].own].includes(id))
}

/** Spends coins to unlock something. Returns the new save, or null if unknown, already owned or too expensive. */
export function buy(save, kind, id) {
  const price = priceOf(kind, id)
  if (!Number.isFinite(price) || save.coins < price) return null
  if (kind === 'design') {
    const [w] = String(id).split(':')
    if (!save.weapons.includes(w) || save.designs.includes(id)) return null
    return { ...save, coins: save.coins - price, designs: [...save.designs, id] }
  }
  const own = CATALOG[kind].own
  if (save[own].includes(id)) return null
  return { ...save, coins: save.coins - price, [own]: [...save[own], id] }
}

/** Equips something you own. Returns the new save, or null if you do not own it. */
export function equip(save, kind, id) {
  if (!owns(save, kind, id)) return null
  if (kind === 'design') {
    const [w, d] = id.split(':')
    return { ...save, equipped: { ...save.equipped, designs: { ...save.equipped.designs, [w]: d } } }
  }
  return { ...save, equipped: { ...save.equipped, [kind]: id } }
}

/** Records a campaign win: coins, best stars, next level. */
export function applyVictory(save, level, stars, coins) {
  const prev = save.stars[level] || 0
  return {
    ...save,
    coins: save.coins + coins,
    best: Math.max(save.best, level),
    level: Math.max(save.level, level + 1),
    stars: { ...save.stars, [level]: Math.max(prev, stars) },
    wins: { ...save.wins, single: save.wins.single + 1 },
  }
}

export const starsFor = (hp, hpMax) => {
  const r = hp / hpMax
  return r >= 0.7 ? 3 : r >= 0.35 ? 2 : 1
}

export const designOf = (save, weapon) => save.equipped.designs[weapon] || 'classic'

export const GAME_ID = 'stickman'

/** What a menu preview or a fight needs to dress a fighter from the save. */
export const loadoutOf = save => ({
  weapon: save.equipped.weapon,
  color: save.equipped.color,
  skin: save.equipped.skin,
  effect: save.equipped.effect,
  design: designOf(save, save.equipped.weapon),
})
