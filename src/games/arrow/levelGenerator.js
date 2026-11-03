// Generates solvable, densely packed "snake arrow" levels.
//
// Each arrow is a path of grid cells (tail -> head). The head points in the
// direction of the last segment. When launched, the whole arrow slides forward
// along its own path and then straight out of the board, so it only needs the
// straight ray in front of its head to be free of other arrows.
//
// Solvability guarantee: arrows are placed in REVERSE removal order. A new
// arrow is accepted only if the ray in front of its head is free of every
// arrow placed so far (those are removed later). Removing arrows in the
// opposite order of placement therefore always has a clear path.
//
// Cells are visited interior-first so the edge cells (whose outward rays are
// always short/clear) are filled last, which packs the board almost fully.

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

export function boardSizeFor(level) {
  return {
    cols: Math.min(8 + level - 1, 24),
    rows: Math.min(6 + Math.floor((level - 1) * 0.75), 17),
  }
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

export function generateLevel(level) {
  const { cols, rows } = boardSizeFor(level)
  const maxLen = Math.min(6 + level * 2, 40)
  const [shapeName, inShape] = level % 2 === 1 ? RECT : SHAPES[(level / 2 - 1) % SHAPES.length]

  const mask = new Set()
  const seeds = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const u = ((x + 0.5) / cols) * 2 - 1
      const v = ((y + 0.5) / rows) * 2 - 1
      if (inShape(u, v)) {
        mask.add(key(x, y))
        seeds.push({ x, y, order: 0 })
      }
    }
  }
  // Interior first: BFS distance from outside the shape, with some jitter.
  const dist = new Map()
  let frontier = []
  for (const sd of seeds) {
    const onEdge = DIR_LIST.some(([, d]) => !mask.has(key(sd.x + d.dx, sd.y + d.dy)))
    if (onEdge) { dist.set(key(sd.x, sd.y), 0); frontier.push(sd) }
  }
  while (frontier.length) {
    const nxt = []
    for (const c of frontier) for (const [, d] of DIR_LIST) {
      const k = key(c.x + d.dx, c.y + d.dy)
      if (mask.has(k) && !dist.has(k)) { dist.set(k, dist.get(key(c.x, c.y)) + 1); nxt.push({ x: c.x + d.dx, y: c.y + d.dy }) }
    }
    frontier = nxt
  }
  for (const sd of seeds) sd.order = -(dist.get(key(sd.x, sd.y)) ?? 0) + Math.random() * 2
  seeds.sort((a, b) => a.order - b.order)

  const occupied = new Set()
  const arrows = []

  const inBoard = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows

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
      const target = 1 + Math.floor(Math.pow(Math.random(), 0.6) * maxLen)
      const path = [{ x: seed.x, y: seed.y }]
      const inPath = new Set([key(seed.x, seed.y)])
      let prev = null
      while (path.length < target) {
        const cur = path[path.length - 1]
        const opts = DIR_LIST.map(([, d]) => ({ x: cur.x + d.dx, y: cur.y + d.dy, d }))
          .filter(c => mask.has(key(c.x, c.y)) && !occupied.has(key(c.x, c.y)) && !inPath.has(key(c.x, c.y)))
        if (!opts.length) break
        let pick
        const r = Math.random()
        if (r < 0.55) {
          // tightest spot first (Warnsdorff-style)
          pick = opts.reduce((best, o) =>
            freeNeighbours(o.x, o.y, inPath) < freeNeighbours(best.x, best.y, inPath) ? o : best)
        } else if (r < 0.8 && prev && opts.find(o => o.d === prev)) {
          pick = opts.find(o => o.d === prev)
        } else {
          pick = opts[Math.floor(Math.random() * opts.length)]
        }
        path.push({ x: pick.x, y: pick.y })
        inPath.add(key(pick.x, pick.y))
        prev = pick.d
      }

      // Longest valid arrow first: both orientations, then shorter prefixes.
      let cand = null
      const flip = Math.random() < 0.5
      for (let len = path.length; len >= 1 && !cand; len--) {
        const fwd = path.slice(0, len)
        if (len === 1) {
          const own = new Set([key(fwd[0].x, fwd[0].y)])
          const clear = DIR_LIST.filter(([, d]) => rayClear(fwd[0], d, own))
          if (clear.length) cand = { cells: fwd, dir: clear[Math.floor(Math.random() * clear.length)][0] }
          break
        }
        const rev = [...fwd].reverse()
        for (const cells of flip ? [rev, fwd] : [fwd, rev]) {
          const head = cells[cells.length - 1]
          const dir = dirOf(cells[cells.length - 2], head)
          const own = new Set(cells.map(c => key(c.x, c.y)))
          if (rayClear(head, DIRS[dir], own)) { cand = { cells, dir }; break }
        }
      }
      if (cand && (!chosen || cand.cells.length > chosen.cells.length)) chosen = cand
    }
    if (!chosen) continue

    chosen.cells.forEach(c => occupied.add(key(c.x, c.y)))
    arrows.push({ id: nextId++, cells: chosen.cells, dir: chosen.dir, status: 'idle' })
  }

  return { cols, rows, shapeName, arrows }
}

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
