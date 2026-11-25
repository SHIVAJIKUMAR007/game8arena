// Tambola (Housie) tickets and winning patterns. Pure functions: no React, no randomness except the rng you pass in.
//
// A ticket is 3 rows × 9 columns. Each row holds exactly 5 numbers and 4 blanks (`null`), so a ticket holds 15
// numbers from 1 to 90. Column c only takes numbers from its own range (1–9, 10–19 … 80–90), every column has at
// least one number, and the numbers in a column rise from top to bottom, which also keeps every row ascending.

export const ROWS = 3
export const COLS = 9
export const PER_ROW = 5
export const TICKET_SIZE = ROWS * PER_ROW
export const MAX_NUMBER = 90

/** What a player can claim. `need` is how many marked numbers on one ticket the pattern asks for. */
export const GOALS = {
  earlyFive: { id: 'earlyFive', label: 'Early Five', need: 5, how: 'Any 5 numbers on one ticket.' },
  line: { id: 'line', label: 'Line', need: 5, how: 'All 5 numbers in one row of a ticket.' },
  fullHouse: { id: 'fullHouse', label: 'Full House', need: TICKET_SIZE, how: 'All 15 numbers on one ticket.' },
}
export const GOAL_IDS = Object.keys(GOALS)

/** Inclusive number range of a column: 1–9, 10–19, … 70–79, 80–90. */
export function columnRange(col) {
  return [col === 0 ? 1 : col * 10, col === COLS - 1 ? MAX_NUMBER : col * 10 + 9]
}

/** Which column a number belongs to. */
export const columnOf = n => Math.min(COLS - 1, Math.floor(n / 10))

// Used only if random tries keep failing (they practically never do): a fixed, valid blank/number layout.
const FALLBACK_LAYOUT = [
  [0, 2, 4, 6, 8],
  [1, 3, 5, 7, 8],
  [0, 1, 3, 5, 7],
]

function randomLayout(rng) {
  const cols = Array.from({ length: COLS }, (_, i) => i)
  for (let attempt = 0; attempt < 500; attempt++) {
    const layout = Array.from({ length: ROWS }, () => rng.shuffle(cols.slice()).slice(0, PER_ROW))
    const used = new Set(layout.flat())
    if (used.size === COLS) return layout // every column has at least one number
  }
  return FALLBACK_LAYOUT
}

/** Builds one ticket: an array of 3 rows, each an array of 9 cells (a number, or null for a blank). */
export function generateTicket(rng) {
  const layout = randomLayout(rng)
  const rowsOfCol = Array.from({ length: COLS }, () => [])
  layout.forEach((cols, r) => cols.forEach(c => rowsOfCol[c].push(r)))
  const ticket = Array.from({ length: ROWS }, () => Array(COLS).fill(null))
  rowsOfCol.forEach((rows, c) => {
    const [lo, hi] = columnRange(c)
    const pool = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
    const picked = rng.shuffle(pool).slice(0, rows.length).sort((a, b) => a - b)
    rows.sort((a, b) => a - b).forEach((r, i) => { ticket[r][c] = picked[i] })
  })
  return ticket
}

/** Every number on a ticket, row by row. */
export const ticketNumbers = ticket => ticket.flat().filter(n => n !== null)

/** Checks a ticket against the Tambola rules. Returns { ok, errors } and never throws. */
export function validateTicket(ticket) {
  const errors = []
  if (!Array.isArray(ticket) || ticket.length !== ROWS || ticket.some(r => !Array.isArray(r) || r.length !== COLS)) {
    return { ok: false, errors: [`a ticket is ${ROWS} rows of ${COLS} cells`] }
  }
  const seen = new Set()
  ticket.forEach((row, r) => {
    const nums = row.filter(n => n !== null)
    if (nums.length !== PER_ROW) errors.push(`row ${r + 1} has ${nums.length} numbers, not ${PER_ROW}`)
    for (let i = 1; i < nums.length; i++) if (!(nums[i] > nums[i - 1])) errors.push(`row ${r + 1} is not ascending`)
    row.forEach((n, c) => {
      if (n === null) return
      const [lo, hi] = columnRange(c)
      if (!Number.isInteger(n) || n < lo || n > hi) errors.push(`${n} does not belong in column ${c + 1}`)
      if (seen.has(n)) errors.push(`${n} appears twice`)
      seen.add(n)
    })
  })
  for (let c = 0; c < COLS; c++) {
    const col = ticket.map(row => row[c]).filter(n => n !== null)
    if (col.length === 0) errors.push(`column ${c + 1} is empty`)
    for (let i = 1; i < col.length; i++) if (!(col[i] > col[i - 1])) errors.push(`column ${c + 1} is not ascending`)
  }
  if (seen.size !== TICKET_SIZE && errors.length === 0) errors.push(`a ticket has ${TICKET_SIZE} numbers`)
  return { ok: errors.length === 0, errors }
}

/** True when `marked` (a Set of numbers) satisfies the goal on this ticket. */
export function isGoalMet(goal, ticket, marked) {
  const has = n => marked.has(n)
  if (goal === 'earlyFive') return ticketNumbers(ticket).filter(has).length >= GOALS.earlyFive.need
  if (goal === 'line') return ticket.some(row => row.every(n => n === null || has(n)))
  if (goal === 'fullHouse') return ticketNumbers(ticket).every(has)
  return false
}

/**
 * The call at which the goal is first met if a player marks every number as it is called.
 * `position` maps number → 1-based call index. Returns Infinity if it is never met.
 */
export function completionCall(goal, ticket, position) {
  const at = n => position[n] ?? Infinity
  if (goal === 'earlyFive') {
    const sorted = ticketNumbers(ticket).map(at).sort((a, b) => a - b)
    return sorted[GOALS.earlyFive.need - 1] ?? Infinity
  }
  if (goal === 'line') return Math.min(...ticket.map(row => Math.max(...row.filter(n => n !== null).map(at))))
  if (goal === 'fullHouse') return Math.max(...ticketNumbers(ticket).map(at))
  return Infinity
}

/** The numbers that finish the goal soonest on this ticket, given the call order. */
export function winningNumbers(goal, ticket, position) {
  const at = n => position[n] ?? Infinity
  const byCall = nums => nums.slice().sort((a, b) => at(a) - at(b))
  if (goal === 'earlyFive') return byCall(ticketNumbers(ticket)).slice(0, GOALS.earlyFive.need)
  if (goal === 'fullHouse') return byCall(ticketNumbers(ticket))
  let best = null
  for (const row of ticket) {
    const nums = row.filter(n => n !== null)
    const last = Math.max(...nums.map(at))
    if (!best || last < best.last) best = { nums, last }
  }
  return byCall(best.nums)
}

/** Maps a call order (array of numbers) to { number: 1-based call index }. */
export function positionsOf(calls) {
  const position = {}
  calls.forEach((n, i) => { position[n] = i + 1 })
  return position
}
