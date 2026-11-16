// Sudoku logic: a 9x9 grid stored as a flat array of 81 numbers (0 = empty).
// Rules: every row, every column and every 3x3 box holds 1-9 exactly once.
import { createRng } from '../../platform/rng'

export const SIZE = 9
export const BOX = 3

export const rowOf = i => Math.floor(i / SIZE)
export const colOf = i => i % SIZE
export const boxOf = i => Math.floor(rowOf(i) / BOX) * BOX + Math.floor(colOf(i) / BOX)

/** Indices of the 20 cells that share a row, column or box with `i` (not including `i`). */
export const PEERS = Array.from({ length: 81 }, (_, i) => {
  const out = []
  for (let j = 0; j < 81; j++) {
    if (j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))) out.push(j)
  }
  return out
})

/** Can `n` go in cell `i` without clashing with a peer? */
export function canPlace(grid, i, n) {
  for (const j of PEERS[i]) if (grid[j] === n) return false
  return true
}

/** Cells that break a rule (two equal digits in the same row, column or box). */
export function conflicts(grid) {
  const bad = new Set()
  for (let i = 0; i < 81; i++) {
    if (!grid[i]) continue
    for (const j of PEERS[i]) if (grid[j] === grid[i]) { bad.add(i); bad.add(j) }
  }
  return bad
}

/** True when every row, column and box holds 1-9 exactly once. */
export function isValidSolution(grid) {
  if (grid.length !== 81 || grid.some(n => !(n >= 1 && n <= 9))) return false
  const groups = Array.from({ length: 27 }, () => new Set())
  for (let i = 0; i < 81; i++) {
    groups[rowOf(i)].add(grid[i])
    groups[9 + colOf(i)].add(grid[i])
    groups[18 + boxOf(i)].add(grid[i])
  }
  return groups.every(g => g.size === 9)
}

/** Candidate digits for cell `i` as a bitmask-free array. */
function candidates(grid, i) {
  const out = []
  for (let n = 1; n <= 9; n++) if (canPlace(grid, i, n)) out.push(n)
  return out
}

/** The empty cell with the fewest candidates, or null when the grid is full. Returns { i, c } */
function bestCell(grid) {
  let best = null
  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue
    const c = candidates(grid, i)
    if (!best || c.length < best.c.length) {
      best = { i, c }
      if (c.length <= 1) break
    }
  }
  return best
}

/** Count solutions, stopping at `limit` (2 is enough to prove uniqueness). */
export function countSolutions(grid, limit = 2) {
  const g = grid.slice()
  let found = 0
  const go = () => {
    const cell = bestCell(g)
    if (!cell) { found++; return }
    for (const n of cell.c) {
      g[cell.i] = n
      go()
      if (found >= limit) return
    }
    g[cell.i] = 0
  }
  go()
  return found
}

/** Solve a grid (first solution found), or null if it has none. */
export function solve(grid) {
  const g = grid.slice()
  const go = () => {
    const cell = bestCell(g)
    if (!cell) return true
    for (const n of cell.c) {
      g[cell.i] = n
      if (go()) return true
    }
    g[cell.i] = 0
    return false
  }
  return go() ? g : null
}

/** A complete, valid grid built by randomised backtracking. */
export function randomSolution(rng) {
  const g = new Array(81).fill(0)
  const go = i => {
    if (i === 81) return true
    for (const n of rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (canPlace(g, i, n)) {
        g[i] = n
        if (go(i + 1)) return true
        g[i] = 0
      }
    }
    return false
  }
  go(0)
  return g
}

/** How many cells to blank out: 36 given clues on level 1 down to 24 on the hardest levels. */
export function paramsFor(level) {
  const l = Math.max(1, level)
  const blanks = Math.min(57, 40 + Math.floor((l - 1) * 1.2)) // 40 .. 57 blanks
  return { blanks, clues: 81 - blanks }
}

/**
 * Deterministic puzzle for (seed, level): { puzzle, solution, clues, given }.
 * `puzzle` has 0 for blank cells and always has exactly one solution.
 */
export function generateLevel(seed, level) {
  const rng = createRng(`${seed}:sudoku:${level}`)
  const solution = randomSolution(rng)
  const puzzle = solution.slice()
  const { blanks } = paramsFor(level)
  let removed = 0
  for (const i of rng.shuffle(Array.from({ length: 81 }, (_, k) => k))) {
    if (removed >= blanks) break
    const keep = puzzle[i]
    puzzle[i] = 0
    if (countSolutions(puzzle) === 1) removed++
    else puzzle[i] = keep // removing it would allow a second solution
  }
  const given = puzzle.map(n => n !== 0)
  return { puzzle, solution, given, clues: 81 - removed }
}

/** Blank cell to reveal for a hint: the most constrained one (fewest candidates). */
export function hintCell(grid) {
  const cell = bestCell(grid)
  return cell ? cell.i : -1
}

/** How many of each digit are placed (for dimming finished number-pad keys). */
export function digitCounts(grid) {
  const c = new Array(10).fill(0)
  for (const n of grid) c[n]++
  return c
}
