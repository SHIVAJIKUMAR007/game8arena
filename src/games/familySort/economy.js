// Coins, rewards and the unlock shop. Plain data and pure functions so the numbers are easy to test and tune.

export const START_COINS = 150
export const HINT_COST = 30
export const BOTTLE_COST = 100
export const MAX_EXTRA_BOTTLES = 2

/** Coins for finishing a level. A level cleared without hints pays a bonus on top. */
export function levelReward({ level, hints }) {
  const L = Math.max(1, Math.floor(Number(level)) || 1)
  const base = 40 + 3 * Math.min(L, 60)
  const bonus = hints === 0 ? 25 + Math.min(L, 60) : 0
  return { base, bonus, total: base + bonus }
}

/** 1-3 stars from how close the player stayed to the shortest solution, and whether they used hints. */
export function starRating({ moves, par, hints }) {
  const p = Math.max(1, par || 1)
  if (hints === 0 && moves <= p + Math.ceil(p * 0.25)) return 3
  if (moves <= p * 2 + 2) return 2
  return 1
}

/** Score for a level: rewards efficiency, and costs a little for every hint. Never below 100. */
export function levelScore({ moves, par, hints, colors }) {
  const over = Math.max(0, moves - Math.max(1, par || 1))
  return Math.max(100, 1000 + 50 * colors - 10 * over - 100 * hints)
}

export const BOTTLE_STYLES = [
  { id: 'classic', name: 'Classic glass', price: 0 },
  { id: 'frosted', name: 'Frosted glass', price: 200 },
  { id: 'crystal', name: 'Crystal flask', price: 350 },
  { id: 'potion', name: 'Round potion', price: 500 },
]

export const BACKGROUNDS = [
  { id: 'garden', name: 'Sunny garden', price: 0 },
  { id: 'sunset', name: 'Golden sunset', price: 250 },
  { id: 'night', name: 'Moonlit meadow', price: 450 },
]

export const SHOP = { bottles: BOTTLE_STYLES, backgrounds: BACKGROUNDS }

export const shopItem = (kind, id) => SHOP[kind]?.find(i => i.id === id) || null
