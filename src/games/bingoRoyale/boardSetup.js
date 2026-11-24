// Pure helpers for arranging a Bingo board. A draft board is 25 cells holding a number 1-25 or null (empty).
import { CELLS, LINES, randomBoard } from '../../../server/bingo'

export { CELLS, LINES }

export const emptyBoard = () => Array(CELLS).fill(null)

/** Puts n on a cell. If n was on another cell it moves, and a number that was on the target cell goes back to the tray. */
export function placeNumber(cells, index, n) {
  if (!Number.isInteger(n) || n < 1 || n > CELLS || index < 0 || index >= CELLS) return cells
  const next = cells.map(c => (c === n ? null : c))
  next[index] = n
  return next
}

export function clearCell(cells, index) {
  if (!cells[index]) return cells
  const next = [...cells]
  next[index] = null
  return next
}

/** The numbers not on the board yet, in order. */
export const unusedNumbers = cells => Array.from({ length: CELLS }, (_, i) => i + 1).filter(n => !cells.includes(n))

export const isComplete = cells => cells.length === CELLS && cells.every(c => Number.isInteger(c))

/** The first empty cell after `from` (wrapping round), or -1 when the board is full. */
export function nextEmpty(cells, from = -1) {
  for (let i = 1; i <= CELLS; i++) {
    const at = (from + i) % CELLS
    if (cells[at] == null) return at
  }
  return -1
}

export const shuffledBoard = random => randomBoard(random)

/** Names of completed lines, e.g. ['Row 2', 'Column 4', 'Diagonal ↘']. @param {number[]} lineIndexes indexes into LINES */
export function lineNames(lineIndexes) {
  return lineIndexes.map(i => (i < 5 ? `Row ${i + 1}` : i < 10 ? `Column ${i - 4}` : i === 10 ? 'Diagonal ↘' : 'Diagonal ↙'))
}

/** Cells that belong to at least one completed line. */
export const cellsInLines = lineIndexes => new Set(lineIndexes.flatMap(i => LINES[i]))

const AVATARS = ['🦊', '🐼', '🐸', '🦄', '🐙', '🐯', '🦉', '🐳']
const COLORS = ['#ff7a45', '#2ec4b6', '#ff5d8f', '#8b5cf6', '#3b82f6', '#f5b700', '#22c55e', '#ef4444']

/** A friendly face and colour for the player at a place in the lobby order. Everyone sees the same one. */
export const avatarAt = index => ({ emoji: AVATARS[index % AVATARS.length], color: COLORS[index % COLORS.length] })
