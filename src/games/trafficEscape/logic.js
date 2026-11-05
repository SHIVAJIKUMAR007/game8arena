// Traffic Escape rules and solver.
//
// A puzzle is a square parking grid with an exit on the right edge of `exitRow`:
//   { size, exitRow, cars: [{ len, horiz, lane, color }], start: number[], par }
// Car 0 is always the red car, horizontal on the exit row. Each car slides only along its own lane
// (its row if horizontal, its column if vertical); a state is just each car's position along its lane.
// One "move" = sliding one car any distance. The level is solved when the red car reaches the exit.
//
// Levels come from a pre-generated bank (levels.js, built by scripts/gen-traffic-levels.mjs) stored as
// 36-character grids: '.' empty, 'A' the red car, 'B'… the other cars.
import { BANK } from './levels.js'

export const SIZE = 6
export const EXIT_ROW = 2
export const COLORS = ['blue', 'green', 'teal', 'yellow', 'purple', 'orange', 'pink', 'slate']

/** Grid cells covered by car k at position `pos`. */
export function cellsOf(p, k, pos) {
  const { len, horiz, lane } = p.cars[k]
  return Array.from({ length: len }, (_, i) => (horiz ? lane * p.size + pos + i : (pos + i) * p.size + lane))
}

/** Cell → car index + 1 (0 = empty). */
export function occupancy(p, state) {
  const grid = new Int8Array(p.size * p.size)
  state.forEach((pos, k) => cellsOf(p, k, pos).forEach(c => { grid[c] = k + 1 }))
  return grid
}

/** [min, max] positions car k can slide to from where it is. */
export function range(p, state, k, grid = occupancy(p, state)) {
  const { len, horiz, lane } = p.cars[k]
  const at = i => (horiz ? lane * p.size + i : i * p.size + lane)
  let lo = state[k], hi = state[k]
  while (lo > 0 && !grid[at(lo - 1)]) lo--
  while (hi + len < p.size && !grid[at(hi + len)]) hi++
  return [lo, hi]
}

export const isSolved = (p, state) => state[0] === p.size - p.cars[0].len

/** Every legal move from a state: [car, newPos]. */
export function movesFrom(p, state) {
  const grid = occupancy(p, state)
  const out = []
  for (let k = 0; k < state.length; k++) {
    const [lo, hi] = range(p, state, k, grid)
    for (let pos = lo; pos <= hi; pos++) if (pos !== state[k]) out.push([k, pos])
  }
  return out
}

export const keyOf = state => String.fromCharCode(...state.map(x => 65 + x))

/** Optimal list of moves [{ car, to }] to solve; [] if solved, null if impossible, undefined if over `limit`. */
export function solve(p, state, limit = 200000) {
  if (isSolved(p, state)) return []
  const states = [state], parent = [-1], via = [null]
  const seen = new Set([keyOf(state)])
  for (let q = 0; q < states.length; q++) {
    if (states.length > limit) return undefined
    for (const [k, pos] of movesFrom(p, states[q])) {
      const next = states[q].slice()
      next[k] = pos
      const key = keyOf(next)
      if (seen.has(key)) continue
      seen.add(key)
      states.push(next); parent.push(q); via.push({ car: k, to: pos })
      if (isSolved(p, next)) {
        const path = []
        for (let i = states.length - 1; i > 0; i = parent[i]) path.push(via[i])
        return path.reverse()
      }
    }
  }
  return null
}

/** First move of a shortest solution: { car, to, left } | null (stuck) | undefined (too big). */
export function hintFor(p, state) {
  const path = solve(p, state)
  if (!path || !path.length) return path
  return { ...path[0], left: path.length }
}

// ---------- text format ----------
export function encode(p, state = p.start) {
  const grid = Array(p.size * p.size).fill('.')
  state.forEach((pos, k) => cellsOf(p, k, pos).forEach(c => { grid[c] = String.fromCharCode(65 + k) }))
  return grid.join('')
}

/** Parse a grid string. Cars are ordered A, B, C…; colours rotate through the palette. */
export function decode(str, par = 0, size = SIZE) {
  const cells = new Map()
  ;[...str].forEach((ch, i) => { if (ch !== '.') cells.set(ch, [...(cells.get(ch) || []), i]) })
  const cars = [], start = []
  ;[...cells.keys()].sort().forEach((ch, k) => {
    const cs = cells.get(ch)
    const r = Math.floor(cs[0] / size), c = cs[0] % size
    const horiz = cs[1] - cs[0] === 1
    cars.push({ len: cs.length, horiz, lane: horiz ? r : c, color: k === 0 ? 'red' : COLORS[(k * 3) % COLORS.length] })
    start.push(horiz ? c : r)
  })
  return { size, exitRow: EXIT_ROW, cars, start, par }
}

// ---------- levels ----------
export const BANK_SIZE = BANK.length
/** Campaign level n (1-based). Past the end of the bank, levels repeat from the hardest third. */
export function levelFor(level) {
  const n = Math.max(1, level)
  if (n <= BANK.length) return decode(...BANK[n - 1])
  const hard = Math.floor(BANK.length * 2 / 3)
  return decode(...BANK[hard + ((n - 1 - BANK.length) * 7) % (BANK.length - hard)])
}

/** Puzzle for a seed hash (the daily challenge): a level from the upper-middle of the bank. */
export function puzzleForHash(hash) {
  const from = Math.floor(BANK.length / 2), to = Math.floor(BANK.length * 0.9)
  return decode(...BANK[from + (hash >>> 0) % (to - from)])
}

// ---------- move budget ----------
/** Extra moves allowed past par before each life is lost. */
export const slackFor = par => Math.max(3, Math.ceil(par / 2))
/** Lives lost after `moves` moves: one each time moves pass par + slack, par + 2·slack, … */
export const livesLost = (par, moves, lives = 3) =>
  Math.min(lives, Math.max(0, Math.floor((moves - par - 1) / slackFor(par))))
/** Move count at which the next life is lost. */
export const nextLossAt = (par, moves) => par + (livesLost(par, moves, Infinity) + 1) * slackFor(par) + 1
