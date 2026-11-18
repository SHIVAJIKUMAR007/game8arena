// Minesweeper rules. Pure functions only: no React, no storage, no randomness except the rng you pass in.
//
// A game is a plain object:
//   { w, h, mineCount, mines, counts, revealed, flags, status, exploded, revealedCount }
//   mines / counts   Uint8Array per cell, or null until the first click places the mines
//   revealed / flags Uint8Array per cell (1 = yes)
//   status           'ready' (no mines placed yet) | 'playing' | 'won' | 'lost'
// Cells are indexed row by row: idx = row * w + col. Every function returns a new game and leaves its input alone.

const neighbourCache = new Map()

/** Indexes of the (up to eight) cells around `idx`. Cached per grid size. */
export function neighbours(idx, w, h) {
  const key = `${w}x${h}`
  let table = neighbourCache.get(key)
  if (!table) {
    table = Array.from({ length: w * h }, (_, i) => {
      const r = Math.floor(i / w)
      const c = i % w
      const out = []
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue
          const rr = r + dr
          const cc = c + dc
          if (rr >= 0 && rr < h && cc >= 0 && cc < w) out.push(rr * w + cc)
        }
      }
      return out
    })
    neighbourCache.set(key, table)
  }
  return table[idx]
}

/** The first-click safe zone: the clicked cell and its neighbours, as long as enough room is left for the mines. */
export function safeZone(idx, w, h, mineCount) {
  const zone = [idx, ...neighbours(idx, w, h)]
  return w * h - zone.length >= mineCount ? zone : [idx]
}

/** Largest mine count a grid can hold with the first-click cell kept clear. */
export const maxMines = (w, h) => Math.max(0, w * h - 1)

/**
 * Places `mineCount` mines at random, never inside the safe zone around `safeIdx`.
 * `rng` is a seeded generator from platform/rng.js, so the same seed gives the same layout.
 */
export function placeMines(w, h, mineCount, rng, safeIdx) {
  const count = Math.min(Math.max(0, Math.floor(mineCount)), maxMines(w, h))
  const blocked = new Set(safeZone(safeIdx, w, h, count))
  const open = []
  for (let i = 0; i < w * h; i++) if (!blocked.has(i)) open.push(i)
  rng.shuffle(open)
  const mines = new Uint8Array(w * h)
  for (let k = 0; k < count; k++) mines[open[k]] = 1
  return mines
}

/** Number of mines around every cell. */
export function adjacentCounts(mines, w, h) {
  const counts = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    let n = 0
    for (const j of neighbours(i, w, h)) n += mines[j]
    counts[i] = n
  }
  return counts
}

export function newGame(w, h, mineCount) {
  return {
    w,
    h,
    mineCount,
    mines: null,
    counts: null,
    revealed: new Uint8Array(w * h),
    flags: new Uint8Array(w * h),
    status: 'ready',
    exploded: -1,
    revealedCount: 0,
  }
}

const clone = g => ({ ...g, revealed: g.revealed.slice(), flags: g.flags.slice() })
const safeCells = g => g.w * g.h - g.mineCount

/** Puts a mine layout on a fresh game and starts it. */
export function withMines(game, mines) {
  // The layout is the truth for the mine count (the generator may lower it by one or two to keep a board guess-free).
  const mineCount = mines.reduce((t, m) => t + m, 0)
  return { ...game, mines, mineCount, counts: adjacentCounts(mines, game.w, game.h), status: 'playing' }
}

/** Reveals `idx` (and, on a zero, everything the empty region touches) in place on a cloned game. */
function open(g, idx) {
  if (g.revealed[idx] || g.flags[idx]) return
  if (g.mines[idx]) {
    g.revealed[idx] = 1
    g.exploded = idx
    g.status = 'lost'
    return
  }
  const queue = [idx]
  g.revealed[idx] = 1
  g.revealedCount++
  while (queue.length) {
    const cur = queue.pop()
    if (g.counts[cur] !== 0) continue
    for (const n of neighbours(cur, g.w, g.h)) {
      // Flagged cells stay closed, as in the classic game, even inside an empty region.
      if (g.revealed[n] || g.flags[n]) continue
      g.revealed[n] = 1
      g.revealedCount++
      queue.push(n)
    }
  }
}

function settle(g) {
  if (g.status === 'playing' && g.revealedCount === safeCells(g)) {
    g.status = 'won'
    // A cleared board shows every mine flagged.
    for (let i = 0; i < g.mines.length; i++) if (g.mines[i]) g.flags[i] = 1
  }
  return g
}

/** Click a cell. Does nothing on a flagged or open cell, or when the game is over or has no mines yet. */
export function reveal(game, idx) {
  if (game.status !== 'playing' || game.revealed[idx] || game.flags[idx]) return game
  const g = clone(game)
  open(g, idx)
  return settle(g)
}

/** Right-click / long-press. Only closed cells can be flagged, and only while the game is on. */
export function toggleFlag(game, idx) {
  if ((game.status !== 'playing' && game.status !== 'ready') || game.revealed[idx]) return game
  const g = clone(game)
  g.flags[idx] = g.flags[idx] ? 0 : 1
  return g
}

export const flagCount = game => game.flags.reduce((t, f) => t + f, 0)
/** Mines minus flags. Goes negative when the player over-flags, as in the original. */
export const minesLeft = game => game.mineCount - flagCount(game)

/** Flags around an open cell. */
export function flagsAround(game, idx) {
  let n = 0
  for (const j of neighbours(idx, game.w, game.h)) n += game.flags[j]
  return n
}

/**
 * Click on an open number whose flags match it: opens every other closed neighbour at once.
 * A wrong flag therefore makes this lose the game, exactly like the classic.
 */
export function chord(game, idx) {
  if (game.status !== 'playing' || !game.revealed[idx]) return game
  const n = game.counts[idx]
  if (n === 0 || flagsAround(game, idx) !== n) return game
  const g = clone(game)
  for (const j of neighbours(idx, g.w, g.h)) {
    if (g.status !== 'playing') break
    open(g, j)
  }
  return settle(g)
}

/**
 * What to draw for each cell. Mines are only reported once the game is over, so the UI (and the DOM) never
 * carries hidden information while playing.
 *   state: 'hidden' | 'flag' | 'open' | 'mine' | 'boom' | 'wrong'   n: adjacent mines (open cells only)
 */
export function view(game) {
  const over = game.status === 'won' || game.status === 'lost'
  return Array.from({ length: game.w * game.h }, (_, i) => {
    if (game.revealed[i]) {
      if (game.mines?.[i]) return { state: i === game.exploded ? 'boom' : 'mine', n: 0 }
      return { state: 'open', n: game.counts[i] }
    }
    if (game.flags[i]) return over && !game.mines[i] ? { state: 'wrong', n: 0 } : { state: 'flag', n: 0 }
    if (over && game.mines[i]) return { state: 'mine', n: 0 }
    return { state: 'hidden', n: 0 }
  })
}

/** Indexes of the revealed and flagged cells, for saving. */
export const snapshot = game => ({
  revealed: Array.from(game.revealed, (v, i) => (v ? i : -1)).filter(i => i >= 0),
  flags: Array.from(game.flags, (v, i) => (v ? i : -1)).filter(i => i >= 0),
})

/**
 * Rebuilds a game from a mine layout plus saved revealed/flag indexes. Returns null if the save can't belong to
 * this layout (an index out of range, or a revealed cell that is a mine), so a corrupted save is dropped.
 */
export function restore(w, h, mineCount, mines, saved) {
  const n = w * h
  const ok = list => Array.isArray(list) && list.every(i => Number.isInteger(i) && i >= 0 && i < n)
  if (!ok(saved?.revealed) || !ok(saved?.flags)) return null
  if (saved.revealed.some(i => mines[i])) return null
  const g = withMines(newGame(w, h, mineCount), mines)
  for (const i of saved.flags) if (!saved.revealed.includes(i)) g.flags[i] = 1
  // Re-open each saved cell. Flood fills are deterministic, so this reproduces the saved position.
  let out = g
  for (const i of saved.revealed) {
    if (!out.revealed[i]) {
      const flagged = out.flags[i]
      if (flagged) { out = clone(out); out.flags[i] = 0 }
      out = reveal(out, i)
    }
  }
  // Put back flags that were on cells the flood left closed.
  for (const i of saved.flags) if (!out.revealed[i]) out.flags[i] = 1
  return out
}
