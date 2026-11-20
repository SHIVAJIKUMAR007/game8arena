// Pure game rules for Blocky Blitz: no DOM, no timers, no globals.
// Randomness always comes from an injected rng ({ next, int, pick, shuffle } from platform/rng.js), so a seed replays exactly.
import { COLORS, SHAPES, SHAPE_BY_ID, SMALL_IDS, makePiece } from './pieces'

export const SIZE = 8
export const TRAY_SIZE = 3
export const START_REROLLS = 2
export const FIRST_TARGET = 1600
export const PERFECT_BONUS = 200

/** @typedef {import('./pieces').Piece} Piece */
/** @typedef {(string|null)[][]} Board  colour hex per filled cell, null when empty */
/**
 * @typedef {object} GameState
 * @property {Board} board
 * @property {(Piece|null)[]} tray
 * @property {Piece|null} hold
 * @property {number} score
 * @property {number} level
 * @property {number} streak   consecutive moves that each cleared a line
 * @property {number} rerolls
 * @property {boolean} over
 */

// ───────────── board ─────────────
export const emptyBoard = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null))

export const isBoardEmpty = board => board.every(row => row.every(c => c === null))

/** True when every cell of the piece lands on the board, on an empty square, with its top-left corner at (r, c). */
export function canPlace(board, cells, r, c) {
  return cells.every(([dr, dc]) => {
    const rr = r + dr
    const cc = c + dc
    return Number.isInteger(rr) && Number.isInteger(cc) && rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && board[rr][cc] === null
  })
}

/** Returns a new board with the piece placed. Throws on an illegal placement (callers check canPlace first). */
export function placeCells(board, cells, r, c, color) {
  if (!canPlace(board, cells, r, c)) throw new Error('illegal placement')
  const next = board.map(row => row.slice())
  for (const [dr, dc] of cells) next[r + dr][c + dc] = color
  return next
}

/** Rows and columns that are completely filled. */
export function findFullLines(board) {
  const rows = []
  const cols = []
  for (let i = 0; i < SIZE; i++) {
    if (board[i].every(v => v !== null)) rows.push(i)
    if (board.every(row => row[i] !== null)) cols.push(i)
  }
  return { rows, cols }
}

/**
 * Clears the given rows and columns at once, working from the same snapshot, so a cell where a full row meets a
 * full column is cleared once and neither line is affected by the other.
 * @returns {{ board: Board, cleared: { r: number, c: number, color: string }[] }}
 */
export function clearLines(board, { rows, cols }) {
  const rowSet = new Set(rows)
  const colSet = new Set(cols)
  const cleared = []
  const next = board.map((row, r) =>
    row.map((v, c) => {
      if (v !== null && (rowSet.has(r) || colSet.has(c))) {
        cleared.push({ r, c, color: v })
        return null
      }
      return v
    })
  )
  return { board: next, cleared }
}

/** First position (row-major) where the cells fit, or null. */
export function findPlacement(board, cells) {
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (canPlace(board, cells, r, c)) return { r, c }
  return null
}

export const fitsAnywhere = (board, cells) => findPlacement(board, cells) !== null

/** True when at least one of the pieces (nulls are ignored) can be placed somewhere. */
export const hasAnyMove = (board, pieces) => pieces.some(p => p && fitsAnywhere(board, p.cells))

// ───────────── scoring and levels ─────────────
/**
 * Score for one move.
 * - 1 point per cell placed
 * - clearing n lines at once: 10 * n^2, times (1 + 0.5 * streak) where streak counts the moves right before this one
 *   that each cleared at least one line
 * - emptying the board with a clear: +200
 * @returns {{ placed: number, bonus: number, perfect: number, total: number, nextStreak: number, lines: number }}
 */
export function scoreMove({ cellCount, lines, streak, perfect }) {
  const bonus = lines > 0 ? Math.round(10 * lines * lines * (1 + 0.5 * streak)) : 0
  const perfectBonus = lines > 0 && perfect ? PERFECT_BONUS : 0
  return {
    placed: cellCount,
    bonus,
    perfect: perfectBonus,
    total: cellCount + bonus + perfectBonus,
    nextStreak: lines > 0 ? streak + 1 : 0,
    lines,
  }
}

/** Score needed to finish a level: 1600 for level 1, then each target adds 800 x the level just finished. */
export function targetForLevel(level) {
  let t = FIRST_TARGET
  for (let l = 1; l < level; l++) t += 800 * l
  return t
}

/** Score at which a level began. */
export const levelStart = level => (level <= 1 ? 0 : targetForLevel(level - 1))

/** 0..1 progress through the current level, for the bar. */
export function levelProgress(score, level) {
  const from = levelStart(level)
  const span = targetForLevel(level) - from
  return Math.max(0, Math.min(1, (score - from) / span))
}

// ───────────── piece generation ─────────────
function weightedShape(rng, pool = SHAPES) {
  const total = pool.reduce((t, s) => t + s.weight, 0)
  let x = rng.next() * total
  for (const s of pool) {
    x -= s.weight
    if (x < 0) return s
  }
  return pool[pool.length - 1]
}

const randomColor = rng => COLORS[Math.floor(rng.next() * COLORS.length)]
const randomPiece = (rng, pool) => makePiece(weightedShape(rng, pool).id, randomColor(rng))

/** Would placing these cells at (r, c) complete at least one row or column? */
function completesLine(board, cells, r, c) {
  const { rows, cols } = findFullLines(placeCells(board, cells, r, c, COLORS[0]))
  return rows.length + cols.length > 0
}

/** Shapes that can complete a line somewhere on this board. */
export function lineCompletingShapes(board) {
  return SHAPES.filter(s => {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (canPlace(board, s.cells, r, c) && completesLine(board, s.cells, r, c)) return true
    return false
  })
}

/**
 * Deals `count` pieces that are fair for this board: at least one of them fits somewhere. The set is re-rolled up to
 * `attempts` times; if the board is still too full, a small piece that fits is swapped in. About a quarter of the time
 * one piece is chosen so that it can complete a nearly full line.
 * @returns {Piece[]}
 */
export function generatePieces(board, rng, { count = TRAY_SIZE, attempts = 24, bias = 0.25 } = {}) {
  const roll = () => {
    const set = Array.from({ length: count }, () => randomPiece(rng))
    if (rng.next() < bias) {
      const helpers = lineCompletingShapes(board)
      if (helpers.length) set[Math.floor(rng.next() * count)] = makePiece(weightedShape(rng, helpers).id, randomColor(rng))
    }
    return set
  }
  for (let i = 0; i < attempts; i++) {
    const set = roll()
    if (hasAnyMove(board, set)) return set
  }
  // Fallback: guarantee one small piece that fits, if any space is left.
  const smalls = rng.shuffle(SMALL_IDS.map(id => SHAPE_BY_ID[id]))
  const fit = smalls.find(s => fitsAnywhere(board, s.cells))
  const set = Array.from({ length: count }, () => randomPiece(rng, smalls))
  if (fit) set[Math.floor(rng.next() * count)] = makePiece(fit.id, randomColor(rng))
  return set
}

// ───────────── game state transitions ─────────────
/** @returns {GameState} */
export function newGame(rng) {
  const board = emptyBoard()
  const tray = generatePieces(board, rng)
  return { board, tray, hold: null, score: 0, level: 1, streak: 0, rerolls: START_REROLLS, over: false }
}

/** All pieces the player could still use: the tray plus the held piece. */
const usablePieces = s => [...s.tray, s.hold]

/** The piece being moved: from a tray slot ({ type: 'tray', index }) or the hold slot ({ type: 'hold' }). */
function takePiece(state, src) {
  if (src.type === 'hold') return state.hold
  return state.tray[src.index] ?? null
}

/**
 * Places a piece from the tray or the hold slot.
 * A new set of three is dealt only when the tray runs out; placing the held piece never deals.
 * @returns {{ state: GameState, ok: boolean, move?: object }}
 */
export function playPiece(state, src, r, c, rng) {
  if (state.over) return { state, ok: false }
  const piece = takePiece(state, src)
  if (!piece || !canPlace(state.board, piece.cells, r, c)) return { state, ok: false }

  const placedBoard = placeCells(state.board, piece.cells, r, c, piece.color)
  const lines = findFullLines(placedBoard)
  const { board, cleared } = clearLines(placedBoard, lines)
  const lineCount = lines.rows.length + lines.cols.length
  const perfect = lineCount > 0 && isBoardEmpty(board)
  const points = scoreMove({ cellCount: piece.cells.length, lines: lineCount, streak: state.streak, perfect })

  let tray = state.tray
  let hold = state.hold
  if (src.type === 'hold') hold = null
  else tray = state.tray.map((p, i) => (i === src.index ? null : p))

  const score = state.score + points.total
  let level = state.level
  let rerolls = state.rerolls
  while (score >= targetForLevel(level)) {
    level += 1
    rerolls += 1
  }

  let dealt = false
  if (tray.every(p => p === null)) {
    tray = generatePieces(board, rng)
    dealt = true
  }

  const next = { board, tray, hold, score, level, streak: points.nextStreak, rerolls, over: false }
  next.over = !hasAnyMove(next.board, usablePieces(next))
  return {
    state: next,
    ok: true,
    move: { piece, r, c, lines, lineCount, cleared, points, perfect, dealt, levelsGained: level - state.level },
  }
}

/**
 * Moves a tray piece into the hold slot. If the slot is occupied the two swap. Using the hold slot is not a
 * placement, but if it leaves the tray empty a fresh set is dealt so the player is never stuck with nothing to play.
 */
export function holdFromTray(state, index, rng) {
  const piece = state.tray[index]
  if (state.over || !piece) return state
  let tray = state.tray.map((p, i) => (i === index ? state.hold : p))
  if (tray.every(p => p === null)) tray = generatePieces(state.board, rng)
  const next = { ...state, tray, hold: piece }
  next.over = !hasAnyMove(next.board, usablePieces(next))
  return next
}

/**
 * Re-roll: replaces the pieces still waiting in the tray with new ones (fair for the current board) and spends one
 * re-roll. The held piece is untouched.
 */
export function rerollTray(state, rng) {
  if (state.over || state.rerolls <= 0) return state
  const slots = state.tray.map((p, i) => (p ? i : -1)).filter(i => i >= 0)
  if (!slots.length) return state
  // The held piece may be the only thing that fits, so fairness is judged on the new pieces alone.
  const fresh = generatePieces(state.board, rng, { count: slots.length })
  const tray = state.tray.slice()
  slots.forEach((slot, k) => {
    tray[slot] = fresh[k]
  })
  const next = { ...state, tray, rerolls: state.rerolls - 1 }
  next.over = !hasAnyMove(next.board, usablePieces(next))
  return next
}

// ───────────── saved games ─────────────
const isColor = v => COLORS.includes(v)

function cleanPiece(p) {
  if (!p || typeof p !== 'object' || !SHAPE_BY_ID[p.id] || !isColor(p.color)) return undefined
  return makePiece(p.id, p.color)
}

/**
 * Turns whatever was stored into a valid GameState, or null when it cannot be trusted
 * (wrong shape, wrong sizes, unknown colours, impossible numbers, an empty tray).
 */
export function sanitizeState(raw) {
  if (!raw || typeof raw !== 'object') return null
  const { board, tray, hold } = raw
  if (!Array.isArray(board) || board.length !== SIZE) return null
  const cleanBoard = []
  for (const row of board) {
    if (!Array.isArray(row) || row.length !== SIZE) return null
    if (!row.every(v => v === null || isColor(v))) return null
    cleanBoard.push(row.slice())
  }
  if (!Array.isArray(tray) || tray.length !== TRAY_SIZE) return null
  const cleanTray = []
  for (const p of tray) {
    if (p == null) {
      cleanTray.push(null)
      continue
    }
    const piece = cleanPiece(p)
    if (!piece) return null
    cleanTray.push(piece)
  }
  let cleanHold = null
  if (hold != null) {
    cleanHold = cleanPiece(hold) ?? null
    if (!cleanHold) return null
  }
  const int = (v, min) => Number.isInteger(v) && v >= min
  if (!int(raw.score, 0) || !int(raw.level, 1) || !int(raw.streak, 0) || !int(raw.rerolls, 0)) return null
  if (cleanTray.every(p => p === null)) return null
  const state = { board: cleanBoard, tray: cleanTray, hold: cleanHold, score: raw.score, level: raw.level, streak: raw.streak, rerolls: raw.rerolls, over: false }
  state.over = !hasAnyMove(state.board, usablePieces(state))
  return state
}

/** Compact form for localStorage: pieces are saved as { id, color } and rebuilt on load. */
export const serializeState = s => ({
  board: s.board,
  tray: s.tray.map(p => (p ? { id: p.id, color: p.color } : null)),
  hold: s.hold ? { id: s.hold.id, color: s.hold.color } : null,
  score: s.score,
  level: s.level,
  streak: s.streak,
  rerolls: s.rerolls,
})
