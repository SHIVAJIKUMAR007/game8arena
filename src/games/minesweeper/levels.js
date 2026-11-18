// Minesweeper progression: how big and how dense each level is, what its board must teach, and the daily board.
//
// Difficulty of a board (evaluateDifficulty) is a 0-100 score from five parts:
//   size          grid area (25)
//   density       mines per cell (25)
//   technique     hardest deduction the solver had to use: basic, count, subset or exhaustive search (20)
//   deductions    how many forced moves needed subset or exhaustive reasoning (15)
//   constraints   how wide the open frontier gets and the biggest group the solver had to search (15)
// Size and density come from the level; the other three are measured by running the solver on the generated board.
//
// Levels follow a smooth ramp between a handful of anchor sizes, so no level is a sudden jump. The ramp ends at
// MAX_LEVEL. Every level after it uses that same size and density with a fresh seed, so players keep getting new
// boards at the maximum difficulty and never a harder one.
import { createRng } from '../../platform/rng'
import { generateBoard } from './generator'
import { adjacentCounts, neighbours } from './logic'
import { TECH_RANK, findHint, solve } from './solver'

export const MAX_LEVEL = 60
/** No campaign or daily board is denser than this (the classic expert board is about 0.206). */
export const MAX_DENSITY = 0.2

const ANCHORS = [
  { level: 1, w: 6, h: 6, density: 0.11 },
  { level: 6, w: 8, h: 8, density: 0.125 },
  { level: 14, w: 10, h: 10, density: 0.14 },
  { level: 24, w: 12, h: 12, density: 0.155 },
  { level: 34, w: 14, h: 14, density: 0.17 },
  { level: 46, w: 16, h: 16, density: 0.18 },
  { level: 60, w: 16, h: 20, density: 0.19 },
]

export const CLASSIC = {
  beginner: { id: 'beginner', label: 'Beginner', w: 9, h: 9, mines: 10, attempts: 150 },
  intermediate: { id: 'intermediate', label: 'Intermediate', w: 16, h: 16, mines: 40, attempts: 60 },
  expert: { id: 'expert', label: 'Expert', w: 30, h: 16, mines: 99, attempts: 20 },
}
export const CLASSIC_IDS = Object.keys(CLASSIC)

const clampLevel = level => Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(level)) || 1))
const lerp = (a, b, t) => a + (b - a) * t

/** Size and mine count for a campaign level. Never grows past MAX_LEVEL. */
export function levelSpec(level) {
  const L = clampLevel(level)
  let i = 0
  while (i < ANCHORS.length - 2 && L > ANCHORS[i + 1].level) i++
  const a = ANCHORS[i]
  const b = ANCHORS[i + 1]
  const t = b.level === a.level ? 0 : (L - a.level) / (b.level - a.level)
  // Grow one row or column per step (height first, then width, taking turns) instead of rounding both at once, so
  // a board never jumps by more than one row or column from one level to the next.
  const steps = Math.round(t * (b.w - a.w + (b.h - a.h)))
  let w = a.w
  let h = a.h
  for (let i = 0; i < steps; i++) {
    if (h - a.h <= w - a.w && h < b.h) h++
    else if (w < b.w) w++
    else h++
  }
  const density = Math.min(MAX_DENSITY, lerp(a.density, b.density, t))
  return { w, h, mines: Math.max(3, Math.round(w * h * density)) }
}

/** What the solver must (and may) use for a level's board. Later levels have to teach more patterns. */
export function levelRequirements(level) {
  const L = clampLevel(level)
  return {
    maxTech: L <= 5 ? 'basic' : L <= 29 ? 'subset' : 'enum',
    minAdvanced: L < 7 ? 0 : Math.min(5, Math.floor((L - 3) / 4)),
    // Exhaustive-search deductions arrive at level 30 and are capped so each level asks only a little more than the last.
    minEnum: L >= 45 ? 2 : L >= 30 ? 1 : 0,
    maxEnum: L < 30 ? 0 : 3 + (L - 30),
  }
}

const TECH_POINTS = [0, 4, 11, 20] // basic, count, subset, enum

/** Score from 0 to 100. `analysis` is the solver's report; without it only size and density count. */
export function evaluateDifficulty({ w, h, mines }, analysis = null) {
  const cells = w * h
  const size = Math.min(1, cells / 320) * 25
  const density = Math.min(1, mines / cells / 0.2063) * 25
  // Exhaustive search counts for more the more often a board needs it, so its first appearance is a small step.
  const tech = !analysis ? 0 : analysis.hardest === 'enum' ? TECH_POINTS[2] + Math.min(TECH_POINTS[3] - TECH_POINTS[2], analysis.techniques.enum * 1.5) : TECH_POINTS[TECH_RANK[analysis.hardest]]
  const advanced = analysis ? Math.min(1, analysis.advanced / 25) * 15 : 0
  const constraints = analysis ? Math.min(1, analysis.frontierPeak / 60) * 10 + Math.min(1, analysis.enumPeak / 12) * 5 : 0
  return Math.round((size + density + tech + advanced + constraints) * 10) / 10
}

const BANDS = [
  [20, 'Gentle'],
  [35, 'Easy'],
  [50, 'Medium'],
  [65, 'Hard'],
  [Infinity, 'Expert'],
]
export const difficultyLabel = score => BANDS.find(([max]) => score < max)[1]
/** 1-5 for the difficulty dots. */
export const difficultyBand = score => BANDS.findIndex(([max]) => score < max) + 1

/** Time (seconds) for the top star: a comfortable pace, not a speedrun. */
export const parTime = ({ w, h, mines }) => Math.round(15 + (w * h - mines) * 0.7)

/** The cell the level suggests opening. Derived from the seed alone, so it says nothing about where mines are. */
export function startCell(seed, w, h) {
  const rng = createRng(`${seed}:start`)
  const r = h > 2 ? rng.int(1, h - 2) : 0
  const c = w > 2 ? rng.int(1, w - 2) : 0
  return r * w + c
}

/** Everything needed to play and generate one game, without generating the board yet. */
export function makeSetup(mode, { level = 1, date, seed } = {}) {
  let base
  if (mode === 'campaign') {
    // Size and difficulty stop growing at MAX_LEVEL, but the level number (and so the seed) keeps counting:
    // level 61, 62… are new boards at the maximum difficulty.
    const L = Math.max(1, Math.floor(Number(level)) || 1)
    base = { ...levelSpec(L), ...levelRequirements(L), attempts: 80, keepMines: false, level: L, seed: `minesweeper:L${L}`, key: `L${L}`, title: `Level ${L}` }
  } else if (mode === 'daily') {
    const d = date || ''
    const L = createRng(`minesweeper:daily-level:${d}`).int(10, 24)
    base = { ...levelSpec(L), ...levelRequirements(L), attempts: 80, keepMines: false, level: L, seed: `minesweeper:daily:${d}`, key: `daily:${d}`, title: 'Daily challenge', date: d }
  } else if (CLASSIC[mode]) {
    const c = CLASSIC[mode]
    const s = seed || `minesweeper:${mode}:fixed`
    base = { w: c.w, h: c.h, mines: c.mines, attempts: c.attempts, maxTech: 'enum', minAdvanced: 0, minEnum: 0, maxEnum: Infinity, keepMines: true, seed: s, key: `${mode}:${s}`, title: c.label }
  } else {
    throw new Error(`Unknown Minesweeper mode: ${mode}`)
  }
  const setup = { mode, ...base }
  setup.start = startCell(setup.seed, setup.w, setup.h)
  setup.par = parTime(setup)
  setup.difficulty = evaluateDifficulty(setup)
  return setup
}

/** Builds the board for a setup and first click. The same setup and click always give the same board. */
export function generatePuzzle(setup, firstIdx = setup.start) {
  const board = generateBoard({ ...setup, firstIdx })
  const spec = { w: setup.w, h: setup.h, mines: board.mineCount }
  return {
    ...setup,
    firstIdx,
    mines: board.mines,
    counts: board.counts,
    mineCount: board.mineCount,
    solvable: board.solvable,
    requirementsMet: board.requirementsMet,
    analysis: board.analysis,
    difficulty: evaluateDifficulty(spec, board.analysis),
  }
}

/** Campaign puzzle for a level. `firstIdx` defaults to the suggested start cell. */
export const generateLevel = (level, firstIdx) => generatePuzzle(makeSetup('campaign', { level }), firstIdx)

/** Checks a puzzle against the rules. Returns { ok, errors }. */
export function validateLevel(puzzle) {
  const errors = []
  const { w, h, mines, firstIdx } = puzzle || {}
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 2 || h < 2) return { ok: false, errors: ['grid size is invalid'] }
  if (!(mines instanceof Uint8Array) || mines.length !== w * h) return { ok: false, errors: ['mine layout does not match the grid'] }
  if (!Number.isInteger(firstIdx) || firstIdx < 0 || firstIdx >= w * h) return { ok: false, errors: ['first click is outside the grid'] }
  const total = mines.reduce((t, m) => t + m, 0)
  if (total < 1) errors.push('board has no mines')
  if (total > w * h - 1) errors.push('too many mines for the grid')
  if (mines[firstIdx] || neighbours(firstIdx, w, h).some(j => mines[j])) errors.push('first click is not in a mine-free zone')
  if (puzzle.counts && !puzzle.counts.every((n, i) => n === adjacentCounts(mines, w, h)[i])) errors.push('adjacent counts are wrong')
  if (puzzle.mode === 'campaign' || puzzle.mode === 'daily') {
    if (total / (w * h) > MAX_DENSITY + 1e-9) errors.push('mine density is above the maximum')
    const spec = levelSpec(puzzle.level)
    if (total > spec.mines) errors.push('board has more mines than its level allows')
    if (w !== spec.w || h !== spec.h) errors.push('grid size does not match the level')
  }
  if (puzzle.solvable) {
    const a = solve({ w, h, mineCount: total, mines, counts: adjacentCounts(mines, w, h) }, firstIdx, puzzle.maxTech || 'enum')
    if (!a.solved) errors.push('board cannot be solved by deduction alone')
  }
  return { ok: errors.length === 0, errors }
}

/** The mine positions, for the end-of-game reveal. */
export const getSolution = puzzle => Array.from(puzzle.mines, (m, i) => (m ? i : -1)).filter(i => i >= 0)
/** A certain move for the current position, or null. */
export const getHint = (puzzle, game) => findHint(game)

/**
 * The shared game-engine contract (see AGENTS.md). Every function works on plain level state, so shared UI and
 * tests can drive any game the same way.
 *   generateLevel(seed, config)   config: { w, h, mines, firstIdx?, attempts?, maxTech?, minAdvanced?, minEnum?, maxEnum?, keepMines? }
 *                                 The same seed and config always give the same level. `firstIdx` defaults to the
 *                                 seed's suggested start cell.
 *   validateLevel(levelState)     { ok, errors }
 *   evaluateDifficulty(state)     0-100
 *   getSolution(levelState)       mine indexes
 *   getHint(levelState)           a certain move for `levelState.game` (the position in play), or null
 */
export const engine = {
  generateLevel(seed, config = {}) {
    const { w = 9, h = 9, mines = 10, firstIdx, ...rest } = config
    const setup = { mode: 'custom', seed: String(seed), w, h, mines, attempts: 60, maxTech: 'enum', minAdvanced: 0, minEnum: 0, maxEnum: Infinity, keepMines: false, ...rest }
    setup.start = startCell(setup.seed, w, h)
    setup.par = parTime(setup)
    setup.difficulty = evaluateDifficulty(setup)
    return generatePuzzle(setup, firstIdx ?? setup.start)
  },
  validateLevel,
  evaluateDifficulty: state => evaluateDifficulty({ w: state.w, h: state.h, mines: typeof state.mines === 'number' ? state.mines : state.mineCount }, state.analysis),
  getSolution,
  getHint: state => (state.game ? findHint(state.game) : null),
}
