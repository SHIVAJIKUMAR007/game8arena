// Generates solvable, densely packed "snake arrow" levels from a seed.
//
// Each arrow is a path of grid cells (tail -> head). The head points in the direction of the last
// segment. When launched, the whole arrow slides forward along its own path and then straight out of
// the board, so it only needs the straight ray in front of its head to be free of other arrows.
//
// Solvability guarantee: arrows are placed in REVERSE removal order. A new arrow is accepted only if
// the ray in front of its head is free of every arrow placed so far (those are removed later).
// Removing arrows in the opposite order of placement therefore always has a clear path. Deleting
// arrows afterwards (to hit an exact count) can only remove blockers, so it stays solvable.
//
// Same seed + level + mode => identical level, on every device.
import { createRng } from '../../platform/rng'
import { arrowCountFor, avgLengthFor } from './difficulty'
import { assignSpecials } from './specials'

export const DIRS = {
  up: { dx: 0, dy: -1 },
  right: { dx: 1, dy: 0 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
}
const DIR_LIST = Object.entries(DIRS)

const RECT = ['Classic', () => true]
const SHAPES = [
  ['Diamond', (u, v) => Math.abs(u) + Math.abs(v) <= 1.05],
  ['Circle', (u, v) => u * u + v * v <= 1.05],
  ['Plus', (u, v) => Math.abs(u) < 0.4 || Math.abs(v) < 0.4],
  ['Ring', (u, v) => { const r = u * u + v * v; return r <= 1.05 && r >= 0.2 }],
  ['Heart', (u, v) => {
    const x = u * 1.25, y = -v * 1.25 + 0.15
    return Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y <= 0
  }],
  ['X', (u, v) => Math.abs(Math.abs(u) - Math.abs(v)) < 0.38],
  ['Hourglass', (u, v) => Math.abs(u) <= Math.abs(v) + 0.15],
  ['Frame', (u, v) => Math.abs(u) > 0.5 || Math.abs(v) > 0.5],
]

let nextId = 1
const key = (x, y) => `${x},${y}`

function maskCells(cols, rows, inShape) {
  const cells = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const u = ((x + 0.5) / cols) * 2 - 1
      const v = ((y + 0.5) / rows) * 2 - 1
      if (inShape(u, v)) cells.push({ x, y })
    }
  }
  return cells
}

// Smallest board (slightly wider than tall) whose shape has room for the requested arrows.
function fitBoard(cellsNeeded, inShape) {
  for (let cols = 4; cols <= 64; cols++) {
    const rows = Math.max(3, Math.round(cols / 1.15))
    if (maskCells(cols, rows, inShape).length >= cellsNeeded) return { cols, rows }
  }
  return { cols: 64, rows: 56 }
}

// Points (cell units) used to draw an arrow. A one-cell arrow gets a short tail.
export function pathPoints(arrow) {
  const pts = arrow.cells.map(c => [c.x + 0.5, c.y + 0.5])
  if (pts.length === 1) {
    const { dx, dy } = DIRS[arrow.dir]
    pts.unshift([pts[0][0] - dx * 0.4, pts[0][1] - dy * 0.4])
  }
  return pts
}

function buildArrows({ cols, rows, cells, maxLen, rng }) {
  const mask = new Set(cells.map(c => key(c.x, c.y)))
  const inBoard = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows

  // Interior first: BFS distance from outside the shape, plus jitter.
  const dist = new Map()
  let frontier = []
  for (const c of cells) {
    if (DIR_LIST.some(([, d]) => !mask.has(key(c.x + d.dx, c.y + d.dy)))) {
      dist.set(key(c.x, c.y), 0)
      frontier.push(c)
    }
  }
  while (frontier.length) {
    const nxt = []
    for (const c of frontier) {
      for (const [, d] of DIR_LIST) {
        const k = key(c.x + d.dx, c.y + d.dy)
        if (mask.has(k) && !dist.has(k)) {
          dist.set(k, dist.get(key(c.x, c.y)) + 1)
          nxt.push({ x: c.x + d.dx, y: c.y + d.dy })
        }
      }
    }
    frontier = nxt
  }
  const seeds = cells
    .map(c => ({ ...c, order: -(dist.get(key(c.x, c.y)) ?? 0) + rng.next() * 2 }))
    .sort((a, b) => a.order - b.order)

  const occupied = new Set()
  const arrows = []

  const rayClear = (head, d, own) => {
    let x = head.x + d.dx, y = head.y + d.dy
    while (inBoard(x, y)) {
      const k = key(x, y)
      if (occupied.has(k) || own.has(k)) return false
      x += d.dx; y += d.dy
    }
    return true
  }
  const dirOf = (from, to) => {
    const dx = to.x - from.x, dy = to.y - from.y
    return DIR_LIST.find(([, d]) => d.dx === dx && d.dy === dy)[0]
  }
  const freeNeighbours = (x, y, inPath) =>
    DIR_LIST.filter(([, d]) => {
      const k = key(x + d.dx, y + d.dy)
      return mask.has(k) && !occupied.has(k) && !inPath.has(k)
    }).length

  for (const seed of seeds) {
    if (occupied.has(key(seed.x, seed.y))) continue

    let chosen = null
    for (let attempt = 0; attempt < 8; attempt++) {
      // Self-avoiding walk that hugs free space, so snakes pack tightly.
      const target = 1 + Math.floor(Math.pow(rng.next(), 0.6) * maxLen)
      const path = [{ x: seed.x, y: seed.y }]
      const inPath = new Set([key(seed.x, seed.y)])
      let prev = null
      while (path.length < target) {
        const cur = path[path.length - 1]
        const opts = DIR_LIST.map(([, d]) => ({ x: cur.x + d.dx, y: cur.y + d.dy, d }))
          .filter(c => mask.has(key(c.x, c.y)) && !occupied.has(key(c.x, c.y)) && !inPath.has(key(c.x, c.y)))
        if (!opts.length) break
        let pick
        const r = rng.next()
        if (r < 0.55) {
          pick = opts.reduce((best, o) =>
            freeNeighbours(o.x, o.y, inPath) < freeNeighbours(best.x, best.y, inPath) ? o : best)
        } else if (r < 0.8 && prev && opts.find(o => o.d === prev)) {
          pick = opts.find(o => o.d === prev)
        } else {
          pick = opts[Math.floor(rng.next() * opts.length)]
        }
        path.push({ x: pick.x, y: pick.y })
        inPath.add(key(pick.x, pick.y))
        prev = pick.d
      }

      // Longest valid arrow first: both orientations, then shorter prefixes.
      let cand = null
      const flip = rng.next() < 0.5
      for (let len = path.length; len >= 1 && !cand; len--) {
        const fwd = path.slice(0, len)
        if (len === 1) {
          const own = new Set([key(fwd[0].x, fwd[0].y)])
          const clear = DIR_LIST.filter(([, d]) => rayClear(fwd[0], d, own))
          if (clear.length) cand = { cells: fwd, dir: clear[Math.floor(rng.next() * clear.length)][0] }
          break
        }
        const rev = [...fwd].reverse()
        for (const c of flip ? [rev, fwd] : [fwd, rev]) {
          const head = c[c.length - 1]
          const dir = dirOf(c[c.length - 2], head)
          const own = new Set(c.map(p => key(p.x, p.y)))
          if (rayClear(head, DIRS[dir], own)) { cand = { cells: c, dir }; break }
        }
      }
      if (cand && (!chosen || cand.cells.length > chosen.cells.length)) chosen = cand
    }
    if (!chosen) continue

    chosen.cells.forEach(c => occupied.add(key(c.x, c.y)))
    arrows.push({ id: nextId++, cells: chosen.cells, dir: chosen.dir, status: 'idle' })
  }
  return arrows
}

export function generateLevel({ level, seed, mode = 'campaign' }) {
  const rng = createRng(seed)
  const target = arrowCountFor(level, mode, seed)
  const avgLen = avgLengthFor(level)

  const [shapeName, inShape] =
    mode === 'daily' ? rng.pick([RECT, ...SHAPES])
      : level % 2 === 1 ? RECT
        : SHAPES[(level / 2 - 1) % SHAPES.length]

  const maxLen = Math.round(avgLen * LEN_FACTOR) + 1

  // Try a few attempts per board size; if the target still isn't reached, grow the board and retry.
  let board = null
  let arrows = []
  for (const scale of [1, 1.2, 1.45, 1.8, 2.3, 3]) {
    const { cols, rows } = fitBoard(Math.ceil((target * avgLen * scale) / 0.8), inShape)
    const cells = maskCells(cols, rows, inShape)
    board = { cols, rows }
    arrows = []
    for (let i = 0; i < 4 && arrows.length < target; i++) {
      const built = buildArrows({ cols, rows, cells, maxLen, rng })
      if (built.length > arrows.length) arrows = built
    }
    if (arrows.length >= target) break
  }
  const { cols, rows } = board

  // Trim to the exact target by deleting the shortest arrows (can't break solvability).
  if (arrows.length > target) {
    const drop = new Set(
      [...arrows].sort((a, b) => a.cells.length - b.cells.length).slice(0, arrows.length - target).map(a => a.id)
    )
    arrows = arrows.filter(a => !drop.has(a.id))
  }
  return { cols, rows, shapeName, target, arrows: assignSpecials(arrows, { level, mode, seed }) }
}

// Tuned so the average generated snake length lands near avgLengthFor(level).
const LEN_FACTOR = 1.5

// First other (non-flying) arrow in front of `arrow`'s head, or null.
export function findBlocker(arrow, arrows, cols, rows) {
  const byCell = new Map()
  for (const a of arrows) {
    if (a.id === arrow.id || a.status === 'flying') continue
    for (const c of a.cells) byCell.set(key(c.x, c.y), a)
  }
  const head = arrow.cells[arrow.cells.length - 1]
  const { dx, dy } = DIRS[arrow.dir]
  let x = head.x + dx, y = head.y + dy
  while (x >= 0 && y >= 0 && x < cols && y < rows) {
    const hit = byCell.get(key(x, y))
    if (hit) return hit
    x += dx; y += dy
  }
  return null
}
