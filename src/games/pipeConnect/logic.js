// Pipe Connect: puzzle generation, rotation and water flow.
//
// A pipe is a 4-bit mask of open sides (N=1, E=2, S=4, W=8). A puzzle is a random spanning tree over
// the whole grid: every square holds the pipe piece formed by its tree edges, so every square is
// connected to every other in the solved layout. One leaf is the water source, a few far-away leaves
// are drains. The pieces are then rotated at random; the player turns them back until water from the
// source reaches every drain. Any layout that does that counts, not only the generated one.
//
// Puzzle: { n, solution: masks, source, drains: [cells], locked: [bool], path: cells on the
// source→drain routes (nearest the source first), start: quarter turns per cell }.
// Board state is `rot`: total clockwise quarter turns per cell (it only grows, so turns animate).
import { createRng } from '../../platform/rng'

export const N = 1, E = 2, S = 4, W = 8
export const SIDES = [
  { bit: N, dr: -1, dc: 0, opp: S, name: 'north' },
  { bit: E, dr: 0, dc: 1, opp: W, name: 'east' },
  { bit: S, dr: 1, dc: 0, opp: N, name: 'south' },
  { bit: W, dr: 0, dc: -1, opp: E, name: 'west' },
]

/** The mask after `turns` clockwise quarter turns. */
export function rotateMask(m, turns = 1) {
  let t = ((turns % 4) + 4) % 4
  while (t--) m = ((m << 1) | (m >> 3)) & 15
  return m
}
export const openSides = m => SIDES.filter(s => m & s.bit).length

/** The neighbouring cell through `side`, or -1 off the grid. */
export function step(n, cell, side) {
  const r = Math.floor(cell / n) + side.dr, c = (cell % n) + side.dc
  return r >= 0 && r < n && c >= 0 && c < n ? r * n + c : -1
}

/** Difficulty curve: bigger grids, more drains, and some bolted-down pieces from level 4. */
export function paramsFor(level) {
  const L = Math.max(1, level)
  const n = L <= 2 ? 4 : L <= 9 ? 5 : L <= 14 ? 6 : L <= 20 ? 7 : 8
  const drains = L <= 5 ? 1 : L <= 14 ? 2 : L <= 28 ? 3 : 4
  const locked = L < 4 ? 0 : Math.round(n * 0.6)
  return { n, drains, locked }
}

/** A random spanning tree of the n×n grid, as pipe masks ("growing tree": half newest, half random). */
export function spanningTree(n, rng) {
  const mask = new Array(n * n).fill(0)
  const seen = new Uint8Array(n * n)
  const first = rng.int(0, n * n - 1)
  seen[first] = 1
  const active = [first]
  while (active.length) {
    const idx = rng.next() < 0.5 ? active.length - 1 : rng.int(0, active.length - 1)
    const cell = active[idx]
    const options = SIDES.filter(s => { const x = step(n, cell, s); return x >= 0 && !seen[x] })
    if (!options.length) { active.splice(idx, 1); continue }
    const s = rng.pick(options)
    const next = step(n, cell, s)
    mask[cell] |= s.bit
    mask[next] |= s.opp
    seen[next] = 1
    active.push(next)
  }
  return mask
}

/** Tree distance and parent of every cell, from `root`. */
function walkTree(n, masks, root) {
  const dist = new Array(n * n).fill(-1), parent = new Array(n * n).fill(-1)
  dist[root] = 0
  const queue = [root]
  for (let q = 0; q < queue.length; q++) {
    const cell = queue[q]
    for (const s of SIDES) {
      if (!(masks[cell] & s.bit)) continue
      const x = step(n, cell, s)
      if (x >= 0 && dist[x] < 0 && masks[x] & s.opp) { dist[x] = dist[cell] + 1; parent[x] = cell; queue.push(x) }
    }
  }
  return { dist, parent }
}

const manhattan = (n, a, b) => Math.abs(Math.floor(a / n) - Math.floor(b / n)) + Math.abs((a % n) - (b % n))

const cache = new Map()

/** Deterministic puzzle for a seed and level. */
export function generateLevel(seed, level) {
  const id = `${seed}#${level}`
  if (cache.has(id)) return cache.get(id)
  const rng = createRng(id)
  const { n, drains: count, locked: lockCount } = paramsFor(level)
  let puzzle = null
  for (let attempt = 0; !puzzle && attempt < 50; attempt++) {
    const solution = spanningTree(n, rng)
    const leaves = solution.flatMap((m, i) => (openSides(m) === 1 ? [i] : []))
    const source = rng.pick(leaves)
    const { dist, parent } = walkTree(n, solution, source)
    const far = rng.shuffle(leaves.filter(x => x !== source && dist[x] >= n - 1))
    if (far.length < count) continue

    // Drains: greedily spread out from the source and from each other.
    const drains = []
    while (drains.length < count) {
      let best = -1, bestScore = -1
      for (const x of far) {
        if (drains.includes(x)) continue
        const score = Math.min(...[source, ...drains].map(y => manhattan(n, x, y)))
        if (score > bestScore) { best = x; bestScore = score }
      }
      drains.push(best)
    }

    const onPath = new Set()
    for (const d of drains) for (let x = d; x >= 0; x = parent[x]) onPath.add(x)
    const path = [...onPath].sort((a, b) => dist[a] - dist[b] || a - b)

    const ends = new Set([source, ...drains])
    const locked = new Array(n * n).fill(false)
    const lockable = rng.shuffle(solution.flatMap((m, i) => (!ends.has(i) && openSides(m) < 4 ? [i] : [])))
    lockable.slice(0, lockCount).forEach(i => { locked[i] = true })

    const fixed = i => ends.has(i) || locked[i]
    for (let tries = 0; tries < 20; tries++) {
      const start = solution.map((m, i) => {
        if (fixed(i)) return 0
        const wrong = [1, 2, 3].filter(t => rotateMask(m, t) !== m)
        // Most pieces on the route start wrong; elsewhere anything goes.
        return onPath.has(i) && wrong.length && rng.next() < 0.85 ? rng.pick(wrong) : rng.int(0, 3)
      })
      const candidate = { n, solution, source, drains, locked, path, start }
      if (!flowStatus(candidate, start).solved && path.filter(i => !fixed(i)).length >= 2) { puzzle = candidate; break }
    }
  }
  cache.set(id, puzzle)
  return puzzle
}

// ---------- play ----------
export const isFixed = (p, cell) => cell === p.source || p.drains.includes(cell) || p.locked[cell]
export const maskAt = (p, rot, cell) => rotateMask(p.solution[cell], rot[cell])

/** Which cells water reaches from the source, how many drains it fills, and whether all are filled. */
export function flowStatus(p, rot) {
  const wet = new Uint8Array(p.n * p.n)
  wet[p.source] = 1
  const queue = [p.source]
  for (let q = 0; q < queue.length; q++) {
    const cell = queue[q], m = maskAt(p, rot, cell)
    for (const s of SIDES) {
      if (!(m & s.bit)) continue
      const x = step(p.n, cell, s)
      if (x >= 0 && !wet[x] && maskAt(p, rot, x) & s.opp) { wet[x] = 1; queue.push(x) }
    }
  }
  const reached = p.drains.filter(d => wet[d]).length
  return { wet, wetCount: queue.length, reached, solved: reached === p.drains.length }
}

/** Clockwise quarter turns (0–3) that put `cell` into its generated orientation. */
export function turnsToSolve(p, rot, cell) {
  for (let t = 0; t < 4; t++) if (rotateMask(p.solution[cell], rot[cell] + t) === p.solution[cell]) return t
  return 0
}

/** Hint target: the route piece nearest the source that is turned wrong and can still turn, or -1. */
export function hintCell(p, rot, pinned = new Set()) {
  return p.path.find(i => !isFixed(p, i) && !pinned.has(i) && turnsToSolve(p, rot, i) > 0) ?? -1
}

// ---------- clock ----------
/** Seconds for a level: a base plus a few per piece that needs turning, tightening as levels go up. */
export function timeFor(p, level) {
  const work = p.path.filter(i => !isFixed(p, i)).length
  return Math.round((15 + 3 * work) * Math.max(0.65, 1 - (Math.max(1, level) - 1) * 0.015))
}
/** After the clock runs out (and a life is lost), it refills to this share of the level's time. */
export const REFILL = 0.5
