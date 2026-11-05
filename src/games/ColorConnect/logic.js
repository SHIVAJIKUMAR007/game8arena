// Color Connect: puzzle generation and path rules.
//
// A puzzle: { n, dots: [[a, b], …] (one pair of cells per colour), solution: [cells…] per colour }.
// Cells are indexed r * n + c. Generation: build a random Hamiltonian path through the whole grid
// ("backbite" moves on a serpentine), then cut it into segments; each segment's ends become a pair
// of dots. So every puzzle has a solution that fills the grid. Any other full, non-crossing solution
// the player finds counts too.
import { createRng } from '../../platform/rng'

export const COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'cyan', 'magenta', 'brown', 'lime']

const neighbours = (n, i) => {
  const r = Math.floor(i / n), c = i % n, out = []
  if (r > 0) out.push(i - n)
  if (r < n - 1) out.push(i + n)
  if (c > 0) out.push(i - 1)
  if (c < n - 1) out.push(i + 1)
  return out
}
export const adjacent = (n, a, b) => neighbours(n, a).includes(b)

/** Difficulty curve: bigger grids, and relatively fewer colours (so longer, twistier paths). */
export function paramsFor(level) {
  const L = Math.max(1, level)
  const n = L <= 3 ? 5 : L <= 8 ? 6 : L <= 14 ? 7 : L <= 22 ? 8 : 9
  const colors = Math.min(COLORS.length, n - (L > 2 && L % 2 === 0 ? 1 : 0))
  return { n, colors }
}

/** A random path through every cell of an n×n grid. */
export function hamiltonianPath(n, rng) {
  const path = []
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) path.push(r * n + (r % 2 ? n - 1 - c : c))
  let p = path
  for (let it = 0; it < n * n * 40; it++) {
    if (rng.next() < 0.5) p.reverse()
    // Backbite: join the head to one of its grid neighbours and reverse the piece in between.
    const head = p[0]
    const choices = neighbours(n, head).filter(x => x !== p[1])
    const x = rng.pick(choices)
    const i = p.indexOf(x)
    p = [...p.slice(0, i).reverse(), ...p.slice(i)]
  }
  return p
}

/** Split `total` into k random parts, each at least `min`. */
function lengths(rng, total, k, min) {
  const parts = Array(k).fill(min)
  for (let left = total - k * min; left > 0; left--) {
    // Favour already-long parts a little, so lengths vary.
    const i = rng.next() < 0.35 ? parts.indexOf(Math.max(...parts)) : rng.int(0, k - 1)
    parts[i]++
  }
  return rng.shuffle(parts)
}

const cache = new Map()

/** Deterministic puzzle for a seed and level. */
export function generateLevel(seed, level) {
  const id = `${seed}#${level}`
  if (cache.has(id)) return cache.get(id)
  const rng = createRng(id)
  const { n, colors } = paramsFor(level)
  let best = null, bestScore = Infinity
  for (let attempt = 0; attempt < 12; attempt++) {
    const path = hamiltonianPath(n, rng)
    const parts = lengths(rng, n * n, colors, 3)
    const solution = []
    let at = 0
    for (const len of parts) { solution.push(path.slice(at, at + len)); at += len }
    // Penalise pairs of dots that touch (trivial-looking) and paths that hug themselves.
    let score = 0
    for (const s of solution) {
      if (adjacent(n, s[0], s.at(-1))) score += 3
      const set = new Set(s)
      for (let i = 0; i < s.length; i++) {
        for (const x of neighbours(n, s[i])) if (set.has(x) && Math.abs(s.indexOf(x) - i) > 1) score += 0.5
      }
    }
    if (score < bestScore) { bestScore = score; best = solution }
    if (score === 0) break
  }
  const puzzle = { n, dots: best.map(s => [s[0], s.at(-1)]), solution: best }
  cache.set(id, puzzle)
  return puzzle
}

// ---------- paths ----------
/** Colour of the dot on `cell`, or -1. */
export function dotAt(p, cell) {
  return p.dots.findIndex(([a, b]) => a === cell || b === cell)
}

export const isConnected = (p, color, path) =>
  path.length > 1 && p.dots[color].includes(path[0]) && p.dots[color].includes(path.at(-1)) && path[0] !== path.at(-1)

/** Paths as shown while `stroke` ({ color, path }) is being drawn: other colours are cut where it crosses them. */
export function mergeStroke(paths, stroke) {
  if (!stroke) return paths
  const taken = new Set(stroke.path)
  return paths.map((path, c) => {
    if (c === stroke.color) return stroke.path
    const cut = path.findIndex(x => taken.has(x))
    return cut < 0 ? path : path.slice(0, cut)
  })
}

/** Start drawing at `cell`: on a dot (restarts that colour) or on any cell of an existing path (continues from there). */
export function startStroke(p, paths, cell) {
  const d = dotAt(p, cell)
  if (d >= 0) return { color: d, path: [cell] }
  for (let c = 0; c < paths.length; c++) {
    const j = paths[c].indexOf(cell)
    if (j >= 0) return { color: c, path: paths[c].slice(0, j + 1) }
  }
  return null
}

/** Extend the stroke into `cell`. Returns the new stroke, or null if that cell can't be entered. */
export function extendStroke(p, stroke, cell) {
  const { color, path } = stroke
  const j = path.indexOf(cell)
  if (j >= 0) return j === path.length - 1 ? stroke : { color, path: path.slice(0, j + 1) } // back-track
  const last = path.at(-1)
  if (!adjacent(p.n, last, cell)) return null
  if (isConnected(p, color, path)) return null // already joined: only back-tracking allowed
  const d = dotAt(p, cell)
  if (d >= 0 && d !== color) return null       // other colours' dots are walls
  return { color, path: [...path, cell] }
}

/** Progress summary for the HUD and the win check. */
export function progress(p, paths) {
  const covered = new Set()
  let connected = 0
  paths.forEach((path, c) => {
    if (isConnected(p, c, path)) connected++
    path.forEach(x => covered.add(x))
  })
  p.dots.flat().forEach(x => covered.add(x))
  const filled = covered.size / (p.n * p.n)
  return { connected, filled, solved: connected === p.dots.length && covered.size === p.n * p.n }
}

/** Apply the hint for one colour: draw its solution path, cutting anything in the way. */
export function applySolution(p, paths, color) {
  return mergeStroke(paths, { color, path: p.solution[color] })
}

/** The first colour whose drawn path isn't its solution path (either direction), or -1. */
export function nextHintColor(p, paths) {
  const same = (a, b) => a.length === b.length && (a.every((x, i) => x === b[i]) || a.every((x, i) => x === b[b.length - 1 - i]))
  return p.solution.findIndex((s, c) => !same(paths[c], s))
}

// ---------- move budget ----------
/** A "move" = drawing with a different colour than last time. Perfect play = one move per colour. */
export const slackFor = colors => Math.max(3, colors)
export const livesLost = (colors, moves, lives = 3) => Math.min(lives, Math.max(0, Math.floor((moves - colors - 1) / slackFor(colors))))
export const nextLossAt = (colors, moves) => colors + (livesLost(colors, moves, Infinity) + 1) * slackFor(colors) + 1
