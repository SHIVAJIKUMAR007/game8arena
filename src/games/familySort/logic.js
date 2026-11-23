// Family Sort rules. Pure functions on plain data, no React and no randomness.
// A bottle is an array of colour ids (integers from 0), bottom first. A position is an array of bottles.

export const CAPACITY = 4

export const cloneBottles = bottles => bottles.map(b => b.slice())

/** Colour on top of a bottle, or -1 when it is empty. */
export const topColor = bottle => (bottle.length ? bottle[bottle.length - 1] : -1)

/** How many units of the top colour sit together on top of a bottle. */
export function topRun(bottle) {
  let n = 0
  const c = topColor(bottle)
  for (let i = bottle.length - 1; i >= 0 && bottle[i] === c; i--) n++
  return n
}

/** Full of one colour. */
export const isBottleDone = (bottle, capacity = CAPACITY) => bottle.length === capacity && topRun(bottle) === capacity

/**
 * How many units a pour from `from` into `to` moves: 0 when it is not allowed.
 * Only the top run of one colour moves, onto an empty bottle or onto the same colour, up to the free space.
 */
export function pourAmount(bottles, from, to, capacity = CAPACITY) {
  if (from === to) return 0
  const src = bottles[from]
  const dst = bottles[to]
  if (!src || !dst || src.length === 0 || dst.length >= capacity) return 0
  if (dst.length > 0 && topColor(dst) !== topColor(src)) return 0
  return Math.min(topRun(src), capacity - dst.length)
}

export const canPour = (bottles, from, to, capacity = CAPACITY) => pourAmount(bottles, from, to, capacity) > 0

/** Pours without touching the input. Returns { bottles, amount, color } or null when the pour is not legal. */
export function applyMove(bottles, from, to, capacity = CAPACITY) {
  const amount = pourAmount(bottles, from, to, capacity)
  if (!amount) return null
  const next = cloneBottles(bottles)
  const color = topColor(next[from])
  next[from].length -= amount
  for (let i = 0; i < amount; i++) next[to].push(color)
  return { bottles: next, amount, color }
}

/** Every legal pour as [from, to]. */
export function legalMoves(bottles, capacity = CAPACITY) {
  const moves = []
  for (let f = 0; f < bottles.length; f++) {
    for (let t = 0; t < bottles.length; t++) if (canPour(bottles, f, t, capacity)) moves.push([f, t])
  }
  return moves
}

/** Solved: every bottle is empty or full of a single colour. */
export const isSolved = (bottles, capacity = CAPACITY) => bottles.every(b => b.length === 0 || isBottleDone(b, capacity))

/** Neighbouring units of different colours inside bottles: how mixed a position is. */
export function transitions(bottles) {
  let n = 0
  for (const b of bottles) for (let i = 1; i < b.length; i++) if (b[i] !== b[i - 1]) n++
  return n
}

export const countColors = bottles => new Set(bottles.flat()).size

/** True when every bottle is full or empty, the shape of a fresh level. */
export const isTidy = (bottles, capacity = CAPACITY) => bottles.every(b => b.length === 0 || b.length === capacity)

/**
 * Structural check of a position: arrays of whole colour ids, no bottle over capacity, and every colour present
 * has exactly `capacity` units. Returns { ok, errors } and never throws.
 */
export function validateBottles(bottles, capacity = CAPACITY) {
  const errors = []
  if (!Array.isArray(bottles) || bottles.length === 0) return { ok: false, errors: ['bottles must be a non-empty array'] }
  const counts = new Map()
  bottles.forEach((b, i) => {
    if (!Array.isArray(b)) return errors.push(`bottle ${i} must be an array`)
    if (b.length > capacity) errors.push(`bottle ${i} holds ${b.length} units, over the capacity of ${capacity}`)
    for (const c of b) {
      if (!Number.isInteger(c) || c < 0) errors.push(`bottle ${i} has an invalid colour`)
      else counts.set(c, (counts.get(c) || 0) + 1)
    }
  })
  for (const [c, n] of counts) if (n !== capacity) errors.push(`colour ${c} has ${n} units instead of ${capacity}`)
  return { ok: errors.length === 0, errors }
}
