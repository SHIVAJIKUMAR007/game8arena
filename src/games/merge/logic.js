// Pure game rules for Merge Rush (powers of 3: three equal tiles merge into one tripled tile). No React in here, so it is easy to test.
// A tile is { id, v, r, c }. Same seed + same moves => same spawns.
export const MERGE_COUNT = 3

// Levels 1-5 have a target tile (3^(2+level): 27, 81, 243, 729, 2187). From level 6 the game is endless:
// no target, just play on for a personal high score.
// Board size per stage: 5x5 (levels 1-3), 6x6 (level 4), 7x7 (level 5 onwards, incl. endless).
export const ENDLESS_FROM = 6
export const isEndless = level => level >= ENDLESS_FROM
export const targetFor = level => (isEndless(level) ? null : 3 ** (2 + level))
export const sizeFor = level => (level <= 3 ? 5 : level === 4 ? 6 : 7)
export const MIN_SIZE = 5
export const startCountFor = level => Math.min(6, 2 + Math.floor(level / 4))

let nextId = 1
export const newId = () => nextId++

const key = (r, c) => `${r},${c}`

export function emptyCells(tiles, size = MIN_SIZE) {
  const taken = new Set(tiles.map(t => key(t.r, t.c)))
  const out = []
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!taken.has(key(r, c))) out.push({ r, c })
  return out
}

export function spawn(tiles, rng, size = MIN_SIZE) {
  const free = emptyCells(tiles, size)
  if (!free.length) return tiles
  const cell = free[Math.floor(rng.next() * free.length)]
  return [...tiles, { id: newId(), v: rng.next() < 0.85 ? 3 : 9, ...cell }]
}

export function initialTiles(level, rng, size = MIN_SIZE) {
  let tiles = []
  for (let i = 0; i < startCountFor(level); i++) tiles = spawn(tiles, rng, size)
  return tiles
}

const maxOf = tiles => tiles.reduce((m, t) => Math.max(m, t.v), 0)
export const bestTile = maxOf

// Slide everything in `dir`; three equal neighbours merge into one tile worth 3x (once per move).
// Returns { tiles, gone, moved, gained }. `gone` are merged-away tiles (kept briefly for the animation).
export function move(tiles, dir, size = MIN_SIZE) {
  const horizontal = dir === 'left' || dir === 'right'
  const forward = dir === 'left' || dir === 'up' // towards index 0
  const out = [], gone = []
  let moved = false, gained = 0

  for (let line = 0; line < size; line++) {
    const inLine = tiles
      .filter(t => (horizontal ? t.r : t.c) === line)
      .sort((a, b) => {
        const d = horizontal ? a.c - b.c : a.r - b.r
        return forward ? d : -d
      })
    const placed = []
    const mergedAway = [] // [{ tile, into }]
    for (const t of inLine) {
      const n = placed.length
      if (n >= MERGE_COUNT - 1 && placed.slice(-(MERGE_COUNT - 1)).every(p => !p.merged && p.v === t.v)) {
        const group = placed.splice(n - (MERGE_COUNT - 1))
        const keep = { ...group[0], v: t.v * MERGE_COUNT, merged: true }
        gained += keep.v
        group.slice(1).forEach(g => mergedAway.push({ tile: g, into: keep }))
        mergedAway.push({ tile: t, into: keep })
        placed.push(keep)
      } else {
        placed.push({ ...t, merged: false })
      }
    }
    placed.forEach((p, k) => {
      const idx = forward ? k : size - 1 - k
      const before = { r: p.r, c: p.c }
      if (horizontal) p.c = idx; else p.r = idx
      if (p.r !== before.r || p.c !== before.c) moved = true
    })
    mergedAway.forEach(({ tile, into }) =>
      gone.push({ ...tile, r: into.r, c: into.c }))
    out.push(...placed)
  }
  if (gone.length) moved = true
  return { tiles: out, gone, moved, gained }
}

export function hasMoves(tiles, size = MIN_SIZE) {
  if (emptyCells(tiles, size).length) return true
  return ['left', 'up'].some(d => move(tiles, d, size).moved) || ['right', 'down'].some(d => move(tiles, d, size).moved)
}

// Greedy hint: the move that merges the most and keeps the board emptiest.
export function bestMove(tiles, size = MIN_SIZE) {
  let best = null
  for (const dir of ['left', 'right', 'up', 'down']) {
    const res = move(tiles, dir, size)
    if (!res.moved) continue
    const score = res.gained * 10 + emptyCells(res.tiles, size).length
    if (!best || score > best.score) best = { dir, score }
  }
  return best?.dir ?? null
}

// When the board locks up, clear the `n` smallest tiles so play can go on.
export function rescue(tiles, n = 3) {
  const drop = new Set([...tiles].sort((a, b) => a.v - b.v).slice(0, n).map(t => t.id))
  return tiles.filter(t => !drop.has(t.id))
}
