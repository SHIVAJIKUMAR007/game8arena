// Seeded board generation with solver validation.
//
// A board is a pure function of (seed, first-click cell, size, mines, requirements). Each attempt draws a layout from
// its own sub-seed, keeps the first-click area clear, and runs the solver from that click. An attempt is rejected when
// the solver can't finish with deduction alone (the board would need a guess) or when it misses the tier's
// requirements (hardest technique allowed, how many advanced deductions it must contain).
import { createRng } from '../../platform/rng'
import { adjacentCounts, placeMines } from './logic'
import { TECH_RANK, solve } from './solver'

const MEMO_LIMIT = 24
const memo = new Map()

/** Solvable within the tier's technique and exhaustive-search caps (the hard limits). */
const within = (a, { maxTech, maxEnum }) => a.solved && TECH_RANK[a.hardest] <= TECH_RANK[maxTech] && a.techniques.enum <= maxEnum
/** Also teaches enough: the minimums that make later levels introduce new patterns. */
const meets = (a, req) => within(a, req) && a.advanced >= req.minAdvanced && a.techniques.enum >= req.minEnum

/**
 * @param {Object} o
 * @param {number} o.w @param {number} o.h @param {number} o.mines
 * @param {string} o.seed  @param {number} o.firstIdx
 * @param {number} [o.attempts]       how many layouts to try
 * @param {string} [o.maxTech]        hardest technique the board may need: 'basic' | 'subset' | 'enum'
 * @param {number} [o.minAdvanced]    minimum number of subset/enum deductions
 * @param {number} [o.minEnum]        minimum number of exhaustive-search deductions
 * @param {number} [o.maxEnum]        most exhaustive-search deductions the board may need (keeps the ramp gentle)
 * @param {boolean} [o.keepMines]     classic modes: never lower the mine count to find a solvable board
 * @returns {{mines:Uint8Array, counts:Uint8Array, mineCount:number, solvable:boolean, requirementsMet:boolean,
 *   analysis:Object, attempt:number}}
 */
export function generateBoard(o) {
  const { w, h, mines, seed, firstIdx, attempts = 60, maxTech = 'enum', minAdvanced = 0, minEnum = 0, maxEnum = Infinity, keepMines = false } = o
  const key = JSON.stringify([w, h, mines, seed, firstIdx, attempts, maxTech, minAdvanced, minEnum, maxEnum, keepMines])
  if (memo.has(key)) return memo.get(key)

  const req = { maxTech, minAdvanced, minEnum, maxEnum }
  let count = mines
  let result = null
  // If a size/density can't be solved without guessing, take one mine off and try again. Never adds mines, so the
  // difficulty ceiling is never exceeded. Classic modes keep their official counts and fall back to the first layout.
  for (let drop = 0; drop <= (keepMines ? 0 : Math.max(1, Math.floor(mines / 2))) && !result; drop++, count--) {
    const tries = drop === 0 ? attempts : Math.max(12, Math.floor(attempts / 4))
    let best = null
    let first = null
    for (let a = 0; a < tries; a++) {
      const layout = placeMines(w, h, count, createRng(`${seed}@${firstIdx}#${drop}.${a}`), firstIdx)
      const board = { w, h, mineCount: count, mines: layout, counts: adjacentCounts(layout, w, h) }
      const analysis = solve(board, firstIdx, maxTech)
      const candidate = { mines: layout, counts: board.counts, mineCount: count, analysis, attempt: a }
      first ??= candidate
      if (meets(analysis, req)) { result = { ...candidate, solvable: true, requirementsMet: true }; break }
      if (within(analysis, req) && (!best || analysis.advanced > best.analysis.advanced)) best = candidate
    }
    if (!result && best) result = { ...best, solvable: true, requirementsMet: false }
    if (!result && keepMines) result = { ...first, solvable: false, requirementsMet: false }
  }
  if (!result) {
    // Only reachable for absurd inputs (every reduction failed): an empty board is trivially solvable.
    const layout = new Uint8Array(w * h)
    const board = { w, h, mineCount: 0, mines: layout, counts: new Uint8Array(w * h) }
    result = { mines: layout, counts: board.counts, mineCount: 0, analysis: solve(board, firstIdx, maxTech), attempt: 0, solvable: true, requirementsMet: false }
  }
  if (memo.size >= MEMO_LIMIT) memo.delete(memo.keys().next().value)
  memo.set(key, result)
  return result
}
