// Find God — puzzle rules, a human-style logic solver, and a level generator.
//
// The board is an n×n grid split into n coloured realms (one per god). Every realm is one
// orthogonally-connected blob. Exactly one god hides in each realm, and:
//   • one god per row and per column,
//   • no two gods touch, not even diagonally (they hate each other),
//   • a god only hides under its own colour.
// The player must find ONE requested god. The generator only accepts boards that the logic solver
// below can solve completely without guessing, so every level has exactly one answer that can be
// deduced step by step.
import { createRng } from '../../platform/rng'

// Soft colours picked by simulating protanopia, deuteranopia and tritanopia: every pair stays
// clearly apart (CIE76 ΔE ≥ 17) for normal and colour-blind vision alike.
export const GODS = [
  { id: 'fire', name: 'Fire', icon: '🔥', color: '#E27036', asker: '👵 Old Marta', plea: 'Our hearths went cold and winter is almost here.' },
  { id: 'water', name: 'Water', icon: '🌊', color: '#598CC0', asker: '🧑‍🌾 Farmer Tobin', plea: 'The village well has run dry.' },
  { id: 'love', name: 'Love', icon: '💖', color: '#E9A5A5', asker: '🧑‍🎤 Bard Elio', plea: 'My beloved will not even look at me.' },
  { id: 'war', name: 'War', icon: '⚔️', color: '#CA7290', asker: '🛡️ Captain Brann', plea: 'Raiders burn our fields every harvest.' },
  { id: 'earth', name: 'Earth', icon: '⛰️', color: '#B3EC79', asker: '⛏️ Miner Dag', plea: 'The mountain shakes and the tunnels are collapsing.' },
  { id: 'air', name: 'Air', icon: '🌪️', color: '#79ECEC', asker: '⛵ Sailor Isla', plea: 'No wind fills our sails — the fleet is stranded.' },
  { id: 'wisdom', name: 'Intelligence', icon: '🧠', color: '#8C79EC', asker: '🧑‍🎓 Student Pim', plea: 'The king’s riddle must be solved by dawn.' },
  { id: 'trap', name: 'Traps', icon: '🕸️', color: '#9DB9F1', asker: '🧑‍🍳 Cook Rosa', plea: 'A beast raids the henhouse every night.' },
  { id: 'wealth', name: 'Wealth', icon: '💰', color: '#E2E236', asker: '🧔 Merchant Oskar', plea: 'The taxman comes tomorrow and my purse is empty.' },
  { id: 'nature', name: 'Nature', icon: '🌿', color: '#59C06A', asker: '🧝 Ranger Lys', plea: 'The ancient forest is dying.' },
]

/** Board size grows with the level: 5×5 → 9×9. */
export function sizeFor(level) {
  if (level <= 2) return 5
  if (level <= 5) return 6
  if (level <= 9) return 7
  if (level <= 14) return 8
  return 9
}

const rowOf = (i, n) => Math.floor(i / n)
const colOf = (i, n) => i % n

/** The 8 cells around i. */
export function neighbours8(i, n) {
  const r = rowOf(i, n), c = colOf(i, n), out = []
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue
    const rr = r + dr, cc = c + dc
    if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc)
  }
  return out
}

function neighbours4(i, n) {
  const r = rowOf(i, n), c = colOf(i, n), out = []
  if (r > 0) out.push(i - n)
  if (r < n - 1) out.push(i + n)
  if (c > 0) out.push(i - 1)
  if (c < n - 1) out.push(i + 1)
  return out
}

/** Rows, columns and realms as lists of cell indexes (the "units" that each hold exactly one god). */
export function units(regions, n) {
  const rows = [], cols = [], realms = []
  for (let k = 0; k < n; k++) { rows.push([]); cols.push([]); realms.push([]) }
  regions.forEach((g, i) => { rows[rowOf(i, n)].push(i); cols[colOf(i, n)].push(i); realms[g].push(i) })
  return [
    ...rows.map((cells, k) => ({ kind: 'row', k, cells })),
    ...cols.map((cells, k) => ({ kind: 'col', k, cells })),
    ...realms.map((cells, k) => ({ kind: 'realm', k, cells })),
  ]
}

/** Every cell a god at i rules out (its row, column, realm and the 8 cells around it). */
export function blockedBy(i, regions, n) {
  const out = new Set(neighbours8(i, n))
  const r = rowOf(i, n), c = colOf(i, n)
  for (let k = 0; k < n; k++) { out.add(r * n + k); out.add(k * n + c) }
  regions.forEach((g, j) => { if (g === regions[i]) out.add(j) })
  out.delete(i)
  return out
}

/** Is `gods` (cell list) a valid full answer? */
export function isValidSolution(gods, regions, n) {
  if (gods.length !== n) return false
  const set = new Set(gods)
  return gods.every(i => [...blockedBy(i, regions, n)].every(j => !set.has(j)))
}

/** Count answers by brute force (row by row), stopping at `limit`. Used by tests. */
export function countSolutions(regions, n, limit = 2) {
  return findSolutions(regions, n, limit).length
}

/** Up to `limit` full answers, each a list of god cells (one per row, top to bottom). */
export function findSolutions(regions, n, limit = 2) {
  const found = [], cols = []
  const usedCol = new Array(n).fill(false), usedRealm = new Array(n).fill(false)
  const go = r => {
    if (found.length >= limit) return
    if (r === n) { found.push(cols.map((c, rr) => rr * n + c)); return }
    for (let c = 0; c < n; c++) {
      const g = regions[r * n + c]
      if (usedCol[c] || usedRealm[g] || (r > 0 && Math.abs(cols[r - 1] - c) <= 1)) continue
      usedCol[c] = usedRealm[g] = true; cols.push(c)
      go(r + 1)
      usedCol[c] = usedRealm[g] = false; cols.pop()
    }
  }
  go(0)
  return found
}

/* ─────────────────────────── Logic solver ───────────────────────────
 * Works like a person would, using three rules:
 *   1. "Last spot": a row, column or realm with one possible cell left — a god must be there.
 *   2. "Would starve": if a god at X would leave some other row / column / realm with no possible
 *      cell, X cannot hold a god.
 *   3. "Pigeonhole": k realms squeezed into k neighbouring rows/columns own those lines.
 * Placing a god rules out everything it blocks.
 */

/** Precomputed lookups for one board (the solver runs thousands of times while generating). */
export function boardContext(regions, n) {
  const all = units(regions, n)
  const blocked = regions.map((_, i) => blockedBy(i, regions, n))
  const unitsOf = regions.map(() => [])
  all.forEach((u, k) => { u.id = k; for (const i of u.cells) unitsOf[i].push(k) })
  return { n, regions, units: all, blocked, unitsOf }
}

/** One deduction from the given state, or null if stuck.
 *  state: { open: boolean[] (cell may still hold a god), gods: Set<cell> }
 *  -> { type: 'god', cell, unit } | { type: 'clear', cell, unit } | { type: 'contradiction' } | null */
export function nextDeduction(state, ctx) {
  return deductions(state, ctx).next().value ?? null
}

// Every deduction visible in the current state, easiest rule first. All of them are true facts,
// so the solver may apply a whole pass at once.
function* deductions(state, ctx) {
  const { n, regions, units: all, blocked, unitsOf } = ctx
  const { open, gods } = state
  const done = new Array(all.length).fill(false)
  for (const g of gods) for (const k of unitsOf[g]) done[k] = true
  const openIn = all.map((u, k) => (done[k] ? null : u.cells.filter(i => open[i])))

  // Rule 1 — last spot left in a unit.
  for (let k = 0; k < all.length; k++) {
    if (done[k]) continue
    if (openIn[k].length === 0) { yield { type: 'contradiction', unit: all[k] }; return }
    if (openIn[k].length === 1) yield { type: 'god', cell: openIn[k][0], unit: all[k] }
  }
  // Rule 2 — a god here would starve another unit.
  for (let x = 0; x < n * n; x++) {
    if (!open[x] || gods.has(x)) continue
    const bx = blocked[x], own = unitsOf[x]
    for (let k = 0; k < all.length; k++) {
      if (done[k] || own.includes(k)) continue
      if (openIn[k].every(i => bx.has(i))) { yield { type: 'clear', cell: x, unit: all[k] }; break }
    }
  }
  // Rule 3 — pigeonhole on bands: if k realms only fit inside k neighbouring rows (or columns),
  // those rows belong to them, so every other realm's cell in that band is empty.
  const realmsLeft = all.filter(u => u.kind === 'realm' && !done[u.id])
  for (const axis of ['row', 'col']) {
    const line = axis === 'row' ? rowOf : colOf
    const span = realmsLeft.map(u => {
      let lo = n, hi = -1
      for (const i of openIn[u.id]) { const l = line(i, n); if (l < lo) lo = l; if (l > hi) hi = l }
      return { k: u.k, lo, hi }
    })
    for (let from = 0; from < n; from++) for (let to = from; to < n; to++) {
      if (to - from + 1 === n) continue // the whole board says nothing
      const owners = new Set(span.filter(sp => sp.lo >= from && sp.hi <= to).map(sp => sp.k))
      if (owners.size !== to - from + 1) continue
      for (let x = 0; x < n * n; x++) {
        const l = line(x, n)
        if (open[x] && !gods.has(x) && l >= from && l <= to && !owners.has(regions[x])) {
          yield { type: 'clear', cell: x, unit: { kind: 'band', axis, from, to, realms: [...owners] } }
        }
      }
    }
  }
}

/** Apply a deduction to the state (mutates). */
export function applyDeduction(state, d, ctx) {
  if (d.type === 'clear') state.open[d.cell] = false
  if (d.type === 'god') {
    state.gods.add(d.cell)
    for (const j of ctx.blocked[d.cell]) state.open[j] = false
  }
}

/** Run the logic solver from scratch. -> { solved, gods: cell[], steps (passes) } */
export function solveByLogic(regions, n) {
  const ctx = boardContext(regions, n)
  const state = { open: new Array(n * n).fill(true), gods: new Set() }
  let steps = 0
  for (;;) {
    if (state.gods.size === n) return { solved: true, gods: [...state.gods].sort((a, b) => a - b), steps }
    const pass = [...deductions(state, ctx)]
    if (!pass.length || pass.some(d => d.type === 'contradiction')) return { solved: false, gods: [...state.gods], steps }
    for (const d of pass) applyDeduction(state, d, ctx)
    steps++
  }
}

/* ─────────────────────────── Generator ─────────────────────────── */

// n gods, one per row and column, none touching (columns of neighbouring rows differ by ≥ 2).
function placeGods(n, rng) {
  const cols = []
  const used = new Array(n).fill(false)
  const go = r => {
    if (r === n) return true
    for (const c of rng.shuffle([...Array(n).keys()])) {
      if (used[c] || (r > 0 && Math.abs(cols[r - 1] - c) <= 1)) continue
      used[c] = true; cols.push(c)
      if (go(r + 1)) return true
      used[c] = false; cols.pop()
    }
    return false
  }
  go(0)
  return cols.map((c, r) => r * n + c)
}

// Grow one connected realm around each god until the board is covered.
function growRealms(n, gods, rng) {
  const regions = new Array(n * n).fill(-1)
  gods.forEach((cell, g) => { regions[cell] = g })
  let left = n * n - n
  while (left > 0) {
    const g = rng.int(0, n - 1)
    const frontier = []
    regions.forEach((rg, i) => {
      if (rg !== g) return
      for (const j of neighbours4(i, n)) if (regions[j] === -1) frontier.push(j)
    })
    if (!frontier.length) continue
    regions[rng.pick(frontier)] = g
    left--
  }
  return regions
}

/** Every realm is one orthogonally-connected blob. */
export function realmsConnected(regions, n) {
  for (let g = 0; g < n; g++) if (!realmStillWhole(regions, g, n)) return false
  return true
}

/**
 * Build the level for a seed. Same seed → same puzzle.
 * -> { n, regions: realm index per cell, gods: GODS entry per realm, solution: god cell per realm,
 *      target: realm index of the god the asker needs }
 */
export function generateLevel(seed, level) {
  const n = sizeFor(level)
  const rng = createRng(`${seed}:god`)
  for (let attempt = 1; attempt <= 500; attempt++) {
    const godCells = placeGods(n, rng)
    const regions = growRealms(n, godCells, rng)
    if (!repairUntilSolvable(regions, godCells, n, rng)) continue
    const gods = rng.shuffle([...GODS]).slice(0, n)
    const target = rng.int(0, n - 1)
    const solution = godCells.map(() => -1)
    for (const cell of godCells) solution[regions[cell]] = cell
    return { n, regions, gods, solution, target, attempts: attempt }
  }
  throw new Error(`Find God: could not build a solvable ${n}×${n} level for ${seed}`)
}

// While the board has another answer, recolour one cell of that answer (one that is not a real
// god) into a neighbouring realm, which kills that answer. Realms stay connected and every god
// stays inside its own realm. Stops once the logic solver can finish the board.
function repairUntilSolvable(regions, godCells, n, rng) {
  const isGod = new Set(godCells)
  for (let round = 0; round < 6 * n; round++) {
    if (solveByLogic(regions, n).solved) return true
    const other = findSolutions(regions, n, 2).find(s => s.some(i => !isGod.has(i)))
    // Unique but too hard for the logic rules: nudge a random border cell instead.
    const pool = other ? other.filter(i => !isGod.has(i)) : regions.map((_, i) => i).filter(i => !isGod.has(i))
    if (!recolourOne(regions, rng.shuffle(pool), isGod, n, rng)) return false
  }
  return false
}

function recolourOne(regions, cells, isGod, n, rng) {
  for (const x of cells) {
    const from = regions[x]
    const options = rng.shuffle([...new Set(neighbours4(x, n).map(j => regions[j]))].filter(g => g !== from))
    for (const to of options) {
      regions[x] = to
      if (realmStillWhole(regions, from, n)) return true
      regions[x] = from
    }
  }
  return false
}

function realmStillWhole(regions, g, n) {
  const cells = []
  regions.forEach((rg, i) => { if (rg === g) cells.push(i) })
  if (!cells.length) return false
  const seen = new Set([cells[0]]), stack = [cells[0]]
  while (stack.length) {
    const i = stack.pop()
    for (const j of neighbours4(i, n)) if (regions[j] === g && !seen.has(j)) { seen.add(j); stack.push(j) }
  }
  return seen.size === cells.length
}

/**
 * Hint for the player's current board.
 * marks: Set of cells the player discarded; found: Map realm → cell of gods already revealed.
 * -> { type: 'wrongMark', cell } | deduction from nextDeduction | { type: 'reveal', cell } as a fallback.
 */
export function hintFor(puzzle, marks, found) {
  const { n, regions, solution } = puzzle
  const wrong = [...marks].find(i => solution[regions[i]] === i)
  if (wrong !== undefined) return { type: 'wrongMark', cell: wrong }
  const ctx = boardContext(regions, n)
  const state = { open: new Array(n * n).fill(true), gods: new Set() }
  for (const i of marks) state.open[i] = false
  for (const cell of found.values()) applyDeduction(state, { type: 'god', cell }, ctx)
  // Walk the solver forward from what the player knows; the hint is the first step that tells
  // them something new (a cell to discard, or a god whose hiding place is now certain).
  for (let guard = 0; guard < n * n * 2; guard++) {
    const d = nextDeduction(state, ctx)
    if (!d || d.type === 'contradiction') break
    if (d.type === 'clear') return d
    if (!found.has(regions[d.cell])) {
      const news = [...ctx.blocked[d.cell]].some(j => state.open[j])
      if (news || regions[d.cell] === puzzle.target) return d
    }
    applyDeduction(state, d, ctx)
  }
  // Can't happen for generated levels (they are logic-solvable) — fall back to a safe cell.
  const cell = regions.findIndex((g, i) => solution[g] !== i && !marks.has(i))
  return cell >= 0 ? { type: 'clear', cell, unit: null } : { type: 'god', cell: solution[puzzle.target], unit: null }
}
