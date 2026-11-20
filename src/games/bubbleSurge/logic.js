// Pure rules for Bubble Surge: no DOM, no canvas, no timers. Randomness comes from an injected rng
// ({ next, int, pick, shuffle } from platform/rng.js), so a seed always rebuilds the same level.
import { CELL_DIST, CELL_X, CELL_Y, CX, CY, D, N, NEIGHBORS, RING_R, isAnchor } from './hex'

// ───────────── constants ─────────────
export const EMPTY = 0
export const RAINBOW = 6 // sits on the field; matches whatever it touches
export const BOMB = 7 // only ever in the shooter's hand
export const METER_SLOTS = 5
export const MAX_COLORS = 5

/** Bubble colours, index = value - 1. Red, green and blue come first; yellow and purple unlock later. */
export const PALETTE = ['#e8201c', '#3ddc2a', '#1428e8', '#ffd31a', '#a53df0']

const HOLE_RX = 225
const HOLE_RY = 150

/** @typedef {{ level: number, colors: number, hole: number, creepEvery: number, target: number, seeds: number, maxGroup: number, rainbow: number }} LevelParams */

/**
 * How a level is built. Level 1 is easy and each step is small; the values stop at fixed limits so a very high
 * level keeps producing fresh fields at the same top difficulty.
 * @returns {LevelParams}
 */
export function levelParams(level) {
  const l = Math.max(1, Math.floor(level))
  return {
    level: l,
    colors: l <= 2 ? 3 : l <= 4 ? 4 : MAX_COLORS,
    hole: Math.max(0.85, 1 - 0.015 * (l - 1)), // size of the starting hole, 1 = biggest
    creepEvery: Math.max(4, 8 - Math.floor((l - 1) / 3)), // shots without a pop before the field creeps in
    target: Math.min(0.85, 0.4 + 0.03 * (l - 1)), // share of the field to clear
    seeds: Math.min(110, 64 + 4 * (l - 1)), // more seeds = smaller colour clumps, so each pop clears fewer bubbles
    maxGroup: Math.max(14, 26 - Math.floor((l - 1) / 2)), // biggest same-colour group the field may start with
    rainbow: l >= 2 ? 0.04 : 0.02, // chance a fresh bubble is a rainbow
  }
}

/** @typedef {Int8Array} Cells  one value per cell: 0 empty, 1..5 colours, 6 rainbow */

// ───────────── level generation ─────────────
/** Cells inside the starting hole for a hole size (1 = biggest). */
export function holeMask(hole) {
  const rx = HOLE_RX * hole
  const ry = HOLE_RY * hole
  const mask = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    const dx = (CELL_X[i] - CX) / rx
    const dy = (CELL_Y[i] - CY) / ry
    if (dx * dx + dy * dy < 1) mask[i] = 1
  }
  return mask
}

/**
 * Fills the field with organic clumps of colour: random seed points each get a colour and a size, and every cell
 * takes the colour of the seed it is closest to (weighted by size, with a little jitter). Neighbouring seeds avoid
 * sharing a colour, so a clump is a group of roughly ten bubbles rather than one giant blob that a single shot
 * would clear. The hole stays empty.
 * @returns {Cells}
 */
export function generateField(params, rng) {
  const cells = new Int8Array(N)
  const mask = holeMask(params.hole)
  const palette = Array.from({ length: params.colors }, (_, k) => k + 1)
  const seeds = Array.from({ length: params.seeds }, () => ({
    x: rng.next() * (CX * 2),
    y: rng.next() * (CY * 2),
    color: 0,
    weight: 0.8 + rng.next() * 0.45,
  }))
  // colour each seed with whichever colour is rarest among the seeds already placed near it
  const near = Math.sqrt((CX * 2 * CY * 2) / params.seeds) * 1.9
  for (const k of rng.shuffle(seeds.map((_, i) => i))) {
    const seed = seeds[k]
    const used = new Map(palette.map(c => [c, 0]))
    for (const o of seeds) if (o.color && Math.hypot(o.x - seed.x, o.y - seed.y) < near) used.set(o.color, used.get(o.color) + 1)
    const fewest = Math.min(...used.values())
    const options = palette.filter(c => used.get(c) === fewest)
    seed.color = options[Math.floor(rng.next() * options.length)]
  }
  for (let i = 0; i < N; i++) {
    if (mask[i]) continue
    let best = Infinity
    let color = 1
    for (const s of seeds) {
      const d = (Math.hypot(CELL_X[i] - s.x, CELL_Y[i] - s.y) / s.weight) * (0.9 + rng.next() * 0.2)
      if (d < best) {
        best = d
        color = s.color
      }
    }
    cells[i] = color
  }
  splitBigGroups(cells, params.maxGroup, rng, params.colors)
  return cells
}

/** Connected cells of exactly one colour (no wildcards), starting from `start`. */
function componentOf(cells, start) {
  const color = cells[start]
  const seen = new Set([start])
  const stack = [start]
  while (stack.length) {
    const i = stack.pop()
    for (const n of NEIGHBORS[i]) if (!seen.has(n) && cells[n] === color) {
      seen.add(n)
      stack.push(n)
    }
  }
  return [...seen]
}

/**
 * Breaks up any same-colour group bigger than `maxGroup`: recolours one ring of bubbles through its middle, then checks
 * again. Without this, neighbouring clumps that happen to share a colour merge, and one shot could clear a quarter
 * of the field.
 */
function splitBigGroups(cells, maxGroup, rng, colors) {
  for (let pass = 0; pass < 80; pass++) {
    const seen = new Uint8Array(N)
    let changed = false
    for (let i = 0; i < N; i++) {
      if (!cells[i] || seen[i]) continue
      const group = componentOf(cells, i)
      group.forEach(k => (seen[k] = 1))
      if (group.length <= maxGroup) continue
      // distance of every member from a random member, then recolour the ring that cuts off about 60% of the cap
      const set = new Set(group)
      const start = group[Math.floor(rng.next() * group.length)]
      const depth = new Map([[start, 0]])
      const queue = [start]
      for (let q = 0; q < queue.length; q++) {
        for (const n of NEIGHBORS[queue[q]]) if (set.has(n) && !depth.has(n)) {
          depth.set(n, depth.get(queue[q]) + 1)
          queue.push(n)
        }
      }
      const byDepth = queue.map(k => depth.get(k))
      const cut = byDepth[Math.min(byDepth.length - 1, Math.floor(maxGroup * 0.6))]
      for (const k of queue) {
        if (depth.get(k) === cut) {
          const others = Array.from({ length: colors }, (_, c) => c + 1).filter(c => c !== cells[k])
          cells[k] = others[Math.floor(rng.next() * others.length)]
        }
      }
      changed = true
    }
    if (!changed) break
  }
}

export const countFilled = cells => {
  let n = 0
  for (let i = 0; i < N; i++) if (cells[i] !== EMPTY) n++
  return n
}

/** Colours (1..5) still on the field. Rainbows do not count as a colour. */
export function presentColors(cells) {
  const seen = new Set()
  for (let i = 0; i < N; i++) if (cells[i] >= 1 && cells[i] <= MAX_COLORS) seen.add(cells[i])
  return [...seen]
}

// ───────────── matching ─────────────
/**
 * The connected group of `color` that includes cell `start`. Rainbow bubbles join any group they touch.
 * @returns {number[]} cell indices
 */
export function matchGroup(cells, start, color) {
  const seen = new Set([start])
  const stack = [start]
  while (stack.length) {
    const i = stack.pop()
    for (const n of NEIGHBORS[i]) {
      if (seen.has(n)) continue
      const v = cells[n]
      if (v === color || v === RAINBOW) {
        seen.add(n)
        stack.push(n)
      }
    }
  }
  return [...seen]
}

/** Bubbles that are no longer joined to the edge of the field, directly or through other bubbles. */
export function findFloating(cells) {
  const keep = new Uint8Array(N)
  const stack = []
  for (let i = 0; i < N; i++) {
    if (cells[i] !== EMPTY && isAnchor(i)) {
      keep[i] = 1
      stack.push(i)
    }
  }
  while (stack.length) {
    const i = stack.pop()
    for (const n of NEIGHBORS[i]) {
      if (!keep[n] && cells[n] !== EMPTY) {
        keep[n] = 1
        stack.push(n)
      }
    }
  }
  const out = []
  for (let i = 0; i < N; i++) if (cells[i] !== EMPTY && !keep[i]) out.push(i)
  return out
}

/** Filled cells within `depth` steps of a cell: the blast of a bomb. */
export function blastArea(cells, centre, depth = 3) {
  const dist = new Map([[centre, 0]])
  const queue = [centre]
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]
    if (dist.get(i) === depth) continue
    for (const n of NEIGHBORS[i]) {
      if (!dist.has(n)) {
        dist.set(n, dist.get(i) + 1)
        queue.push(n)
      }
    }
  }
  return [...dist.keys()].filter(i => cells[i] !== EMPTY)
}

// ───────────── pressure ─────────────
/** True when any bubble touches the purple ring around the shooter. */
export function touchesRing(cells) {
  const limit = RING_R + D / 2 - 1
  for (let i = 0; i < N; i++) if (cells[i] !== EMPTY && CELL_DIST[i] < limit) return true
  return false
}

/** Empty cells connected to the shooter: the open space around it. */
export function openSpace(cells) {
  const open = new Uint8Array(N)
  const stack = []
  for (let i = 0; i < N; i++) {
    if (cells[i] === EMPTY && CELL_DIST[i] < D) {
      open[i] = 1
      stack.push(i)
    }
  }
  while (stack.length) {
    const i = stack.pop()
    for (const n of NEIGHBORS[i]) {
      if (!open[n] && cells[n] === EMPTY) {
        open[n] = 1
        stack.push(n)
      }
    }
  }
  return open
}

/**
 * The field creeps in: every cell of the open space that touches a bubble gets a new bubble, so the hole shrinks by
 * one layer. New bubbles use colours still on the field.
 * @returns {{ cells: Cells, added: number[] }}
 */
export function creep(cells, rng, colors = MAX_COLORS) {
  const open = openSpace(cells)
  const next = Int8Array.from(cells)
  const added = []
  const pool = presentColors(cells)
  const colorPool = pool.length ? pool : Array.from({ length: colors }, (_, k) => k + 1)
  for (let i = 0; i < N; i++) {
    if (open[i] && NEIGHBORS[i].some(n => cells[n] !== EMPTY)) {
      next[i] = colorPool[Math.floor(rng.next() * colorPool.length)]
      added.push(i)
    }
  }
  return { cells: next, added }
}

// ───────────── what the shooter holds ─────────────
/** A colour for the next bubble, always one that is still on the field (any colour if the field has none). */
export function pickColor(cells, rng, colors = MAX_COLORS) {
  const present = presentColors(cells)
  if (present.length) return present[Math.floor(rng.next() * present.length)]
  return 1 + Math.floor(rng.next() * colors)
}

/** The next ordinary bubble: now and then a rainbow, otherwise a colour from the field. */
export function pickBubble(cells, rng, params) {
  if (rng.next() < params.rainbow) return RAINBOW
  return pickColor(cells, rng, params.colors)
}

/** Swaps in a colour from the field for any held bubble whose colour has been cleared. */
export function sanitizeHand(cells, hand, rng, colors) {
  const present = new Set(presentColors(cells))
  const fix = v => (v >= 1 && v <= MAX_COLORS && present.size && !present.has(v) ? pickColor(cells, rng, colors) : v)
  return { cur: fix(hand.cur), next: fix(hand.next) }
}

// ───────────── scoring ─────────────
/** Bonus for the size of a chain: 3-4 bubbles x1, 5-7 x1.5, 8 or more x2. */
export const chainBonus = n => (n >= 8 ? 2 : n >= 5 ? 1.5 : 1)

/** Multiplier for popping on consecutive shots: x1, x1.25, x1.5 ... up to x2.5. */
export const comboMultiplier = streak => Math.min(2.5, 1 + 0.25 * Math.max(0, streak - 1))

/** 10 points per popped bubble and 20 per dropped bubble, scaled by chain size and combo. */
export function scoreShot({ popped, dropped, streak }) {
  const combo = comboMultiplier(streak)
  const pop = Math.round(10 * popped * chainBonus(popped) * combo)
  const drop = Math.round(20 * dropped * chainBonus(dropped) * combo)
  return { pop, drop, total: pop + drop }
}

/** Stars for a cleared level: fewer shots than the par earns more. */
export function starsFor(shots, par) {
  return shots <= par ? 3 : shots <= Math.ceil(par * 1.4) ? 2 : 1
}

// ───────────── game state ─────────────
/**
 * @typedef {object} GameState
 * @property {number} level
 * @property {LevelParams} params
 * @property {Cells} cells
 * @property {number} total      bubbles at the start of the level
 * @property {number} goal       bubbles to clear to finish the level
 * @property {number} par        shots for three stars
 * @property {{ cur: number, next: number }} hand
 * @property {number} shots
 * @property {number} misses     shots in a row without a pop
 * @property {number} streak     shots in a row that popped
 * @property {number} meter      0..5, fills one slot per popping shot
 * @property {number} score
 * @property {'playing'|'won'|'over'} status
 * @property {number} stars
 */

/** @returns {GameState} */
export function newLevel(level, rng, score = 0) {
  const params = levelParams(level)
  const cells = generateField(params, rng)
  const total = countFilled(cells)
  const goal = Math.ceil(total * params.target)
  return {
    level: params.level,
    params,
    cells,
    total,
    goal,
    par: Math.ceil(goal / 8),
    hand: { cur: pickColor(cells, rng, params.colors), next: pickBubble(cells, rng, params) },
    shots: 0,
    misses: 0,
    streak: 0,
    meter: 0,
    score,
    status: 'playing',
    stars: 0,
  }
}

const bombInHand = h => h.cur === BOMB || h.next === BOMB

/** Swap the bubble in the shooter with the one waiting. */
export function swapHand(state) {
  if (state.status !== 'playing') return state
  return { ...state, hand: { cur: state.hand.next, next: state.hand.cur } }
}

/** How many bubbles have been cleared so far this level. */
export const clearedCount = s => s.total - countFilled(s.cells)

/**
 * A fired bubble has stuck in cell `landing`. Pops matches, drops what is left hanging, scores, creeps the field when
 * the player has gone too long without a pop, deals the next bubble and decides whether the level is won or lost.
 * @returns {{ state: GameState, events: object }}
 */
export function resolveShot(state, landing, bubble, rng) {
  const cells = Int8Array.from(state.cells)
  let popped = []
  let dropped = []
  const bombFired = bubble === BOMB

  if (bombFired) {
    popped = blastArea(cells, landing, 3)
  } else {
    cells[landing] = bubble
    let color = bubble
    if (bubble === RAINBOW) {
      // Take the colour that makes the biggest group among the neighbours.
      let best = 0
      for (const v of new Set(NEIGHBORS[landing].map(n => cells[n]))) {
        if (v < 1 || v > MAX_COLORS) continue
        const size = matchGroup(cells, landing, v).length
        if (size > best) {
          best = size
          color = v
        }
      }
    }
    const group = color === RAINBOW ? [landing] : matchGroup(cells, landing, color)
    if (group.length >= 3) popped = group
  }

  const poppedInfo = popped.map(i => ({ i, v: cells[i] || bubble }))
  for (const i of popped) cells[i] = EMPTY
  let droppedInfo = []
  if (popped.length) {
    dropped = findFloating(cells)
    droppedInfo = dropped.map(i => ({ i, v: cells[i] }))
    for (const i of dropped) cells[i] = EMPTY
  }

  const did = popped.length > 0
  const streak = did ? state.streak + 1 : 0
  let misses = did ? 0 : state.misses + 1
  let meter = did ? Math.min(METER_SLOTS, state.meter + 1) : state.meter
  if (bombFired) meter = 0

  const points = did ? scoreShot({ popped: popped.length, dropped: dropped.length, streak }) : { pop: 0, drop: 0, total: 0 }

  let field = cells
  let creepAdded = []
  if (misses >= state.params.creepEvery) {
    const grown = creep(field, rng, state.params.colors)
    field = grown.cells
    creepAdded = grown.added
    misses = 0
  }

  // Next bubble in the shooter: the waiting one moves up; a full meter turns the bubble in the shooter into a bomb.
  let hand = { cur: state.hand.next, next: pickBubble(field, rng, state.params) }
  let bombLoaded = false
  if (meter >= METER_SLOTS && !bombInHand(hand) && !bombFired) {
    hand = { cur: BOMB, next: hand.next === BOMB ? pickColor(field, rng, state.params.colors) : hand.next }
    bombLoaded = true
  }
  hand = sanitizeHand(field, hand, rng, state.params.colors)

  const next = {
    ...state,
    cells: field,
    hand,
    shots: state.shots + 1,
    misses,
    streak,
    meter,
    score: state.score + points.total,
  }
  const cleared = clearedCount(next)
  if (touchesRing(field)) next.status = 'over'
  else if (cleared >= next.goal || countFilled(field) === 0) {
    next.status = 'won'
    next.stars = starsFor(next.shots, next.par)
  }
  return {
    state: next,
    events: {
      landing,
      bubble,
      popped: poppedInfo,
      dropped: droppedInfo,
      creepAdded,
      points,
      streak,
      bombFired,
      bombLoaded,
      meterFilled: meter >= METER_SLOTS,
    },
  }
}
