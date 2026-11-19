// Klondike rules: game state, move validation, applying moves, scoring, win and dead-end detection.
//
// All functions are pure: they never change the state they are given. A state is plain JSON:
//   draw         1 | 3          cards turned from the stock at a time
//   stock        number[]       face-down stock, top card last
//   waste        number[]       face-up waste, top card last (the only one you can play)
//   foundations  number[][4]    four piles built Ace to King in one suit, bottom to top; any Ace may start any pile
//   tableau      number[][7]    columns, bottom to top
//   hidden       number[7]      how many cards at the bottom of each column are face down
//   score, moves, recycles      running totals
//
// Piles are named 'stock', 'waste', 'f0'..'f3' and 't0'..'t6'. A move is either
//   { type: 'draw' }                                   turn cards from the stock, or recycle the waste when it is empty
//   { type: 'move', from, to, count? }                 count = cards taken from the top of `from` (tableau only, default 1)
// `to` may be just 'f' to mean "whichever foundation takes this card".
import { DECK_SIZE, KING, canFollowOnFoundation, canStack, isRun, rankOf, suitOf } from './cards'
import { COLUMNS } from './deal'

export const FOUNDATIONS = 4
export const DRAW_MODES = [1, 3]

/** Standard Klondike scoring. Points never drop below zero. */
export const SCORE = {
  wasteToTableau: 5,
  toFoundation: 10,
  flip: 5,
  foundationToTableau: -15,
  recycle: { 1: -100, 3: -20 },
}

/** Messages shown to the player when a move is not allowed. */
export const REASONS = {
  unknownPile: 'That is not a pile.',
  sameCard: 'Pick a different pile to move to.',
  empty: 'There is no card there to move.',
  faceDown: 'That card is face down.',
  notRun: 'You can only move cards that go down in rank and alternate red and black.',
  oneCard: 'Only one card at a time can go there.',
  kingOnly: 'Only a King, or a run starting with a King, can go into an empty column.',
  tableau: 'Cards in a column must go down by one and alternate red and black.',
  foundationAce: 'A foundation must start with an Ace.',
  foundation: 'Foundations build up by suit, from Ace to King.',
  toStock: 'Cards cannot be put back on the stock.',
  toWaste: 'Cards cannot be put on the waste pile.',
  stockEmpty: 'The stock and waste are both empty.',
  won: 'The game is already won.',
}

/* ───────────── Piles ───────────── */

/** { kind: 'stock' | 'waste' | 'foundation' | 'tableau', index } or null. 'f' alone is the "any foundation" target. */
export function parsePile(id) {
  if (id === 'stock' || id === 'waste') return { kind: id, index: 0 }
  if (id === 'f') return { kind: 'foundation', index: -1 }
  const m = typeof id === 'string' && /^([ft])(\d)$/.exec(id)
  if (!m) return null
  const index = Number(m[2])
  if (m[1] === 'f') return index < FOUNDATIONS ? { kind: 'foundation', index } : null
  return index < COLUMNS ? { kind: 'tableau', index } : null
}

export const tableauId = i => `t${i}`
export const foundationId = i => `f${i}`

/** The cards of a pile, bottom to top (empty array for unknown piles). */
export function pileCards(state, id) {
  const p = parsePile(id)
  if (!p) return []
  if (p.kind === 'stock') return state.stock
  if (p.kind === 'waste') return state.waste
  if (p.kind === 'foundation') return p.index < 0 ? [] : state.foundations[p.index]
  return state.tableau[p.index]
}

export const topOf = cards => cards[cards.length - 1]

/* ───────────── Creating a game ───────────── */

/** A new game from a deal ({ tableau, stock }). Only the top card of each column starts face up. */
export function createGame(deal, draw = 1) {
  return {
    draw: draw === 3 ? 3 : 1,
    stock: [...deal.stock],
    waste: [],
    foundations: Array.from({ length: FOUNDATIONS }, () => []),
    tableau: deal.tableau.map(col => [...col]),
    hidden: deal.tableau.map(col => Math.max(0, col.length - 1)),
    score: 0,
    moves: 0,
    recycles: 0,
  }
}

/* ───────────── Checks ───────────── */

/** Index of the foundation `card` can go on, or -1. Prefers the pile already holding its suit. */
export function foundationFor(state, card) {
  let empty = -1
  for (let i = 0; i < FOUNDATIONS; i++) {
    const pile = state.foundations[i]
    if (pile.length === 0) {
      if (empty < 0) empty = i
    } else if (suitOf(pile[0]) === suitOf(card)) {
      return canFollowOnFoundation(card, topOf(pile)) ? i : -1
    }
  }
  return empty >= 0 && canFollowOnFoundation(card, undefined) ? empty : -1
}

/** Can the run starting at `index` in column `col` be picked up? It must be face up and correctly built. */
export function isMovableRun(state, col, index) {
  const column = state.tableau[col]
  if (!column || index < 0 || index >= column.length) return false
  if (index < state.hidden[col]) return false
  return isRun(column.slice(index))
}

/** How many cards on top of column `col` form a movable run (0 for an empty column). */
export function runLength(state, col) {
  const column = state.tableau[col]
  let n = column.length ? 1 : 0
  while (n < column.length - state.hidden[col] && canStack(column[column.length - n], column[column.length - n - 1])) n++
  return n
}

/**
 * Checks a move without making it. Returns { ok: true, to, cards } with `to` resolved to a real pile id, or
 * { ok: false, reason } with a message for the player.
 */
export function validateMove(state, move) {
  if (isWon(state)) return { ok: false, reason: REASONS.won }
  if (!move || typeof move !== 'object') return { ok: false, reason: REASONS.unknownPile }
  if (move.type === 'draw') {
    return state.stock.length || state.waste.length ? { ok: true, to: 'waste', cards: [] } : { ok: false, reason: REASONS.stockEmpty }
  }
  const from = parsePile(move.from)
  const to = parsePile(move.to)
  if (!from || !to || (from.kind === 'foundation' && from.index < 0)) return { ok: false, reason: REASONS.unknownPile }
  if (move.from === move.to) return { ok: false, reason: REASONS.sameCard }
  if (to.kind === 'stock') return { ok: false, reason: REASONS.toStock }
  if (to.kind === 'waste') return { ok: false, reason: REASONS.toWaste }

  const count = move.count === undefined ? 1 : move.count
  if (!Number.isInteger(count) || count < 1) return { ok: false, reason: REASONS.empty }
  if (from.kind === 'stock') return { ok: false, reason: REASONS.faceDown }
  const source = pileCards(state, move.from)
  if (source.length < count) return { ok: false, reason: REASONS.empty }
  if (from.kind !== 'tableau' && count !== 1) return { ok: false, reason: REASONS.oneCard }
  if (from.kind === 'tableau') {
    const start = source.length - count
    if (start < state.hidden[from.index]) return { ok: false, reason: REASONS.faceDown }
    if (!isRun(source.slice(start))) return { ok: false, reason: REASONS.notRun }
  }
  const cards = source.slice(source.length - count)
  const lead = cards[0]

  if (to.kind === 'foundation') {
    if (count !== 1) return { ok: false, reason: REASONS.oneCard }
    if (to.index < 0) {
      const f = foundationFor(state, lead)
      return f >= 0 ? { ok: true, to: foundationId(f), cards } : { ok: false, reason: REASONS.foundation }
    }
    const pile = state.foundations[to.index]
    if (!canFollowOnFoundation(lead, topOf(pile))) return { ok: false, reason: pile.length ? REASONS.foundation : REASONS.foundationAce }
    return { ok: true, to: move.to, cards }
  }

  const column = state.tableau[to.index]
  if (column.length === 0) {
    return rankOf(lead) === KING ? { ok: true, to: move.to, cards } : { ok: false, reason: REASONS.kingOnly }
  }
  if (!canStack(lead, topOf(column))) return { ok: false, reason: REASONS.tableau }
  return { ok: true, to: move.to, cards }
}

/* ───────────── Applying moves ───────────── */

const addScore = (state, points) => Math.max(0, state.score + points)

/**
 * Makes a move. Returns { ok, state, reason?, flipped?, recycled? }. On an invalid move `state` is the unchanged input.
 * After a card leaves a column, the new top card of that column is turned face up automatically.
 */
export function applyMove(state, move) {
  const check = validateMove(state, move)
  if (!check.ok) return { ok: false, state, reason: check.reason }

  if (move.type === 'draw') {
    if (state.stock.length === 0) {
      const next = {
        ...state,
        stock: [...state.waste].reverse(),
        waste: [],
        recycles: state.recycles + 1,
        moves: state.moves + 1,
      }
      next.score = addScore(state, SCORE.recycle[state.draw])
      return { ok: true, state: next, recycled: true }
    }
    const n = Math.min(state.draw, state.stock.length)
    const stock = state.stock.slice(0, state.stock.length - n)
    const turned = state.stock.slice(state.stock.length - n).reverse()
    return { ok: true, state: { ...state, stock, waste: [...state.waste, ...turned], moves: state.moves + 1 } }
  }

  const from = parsePile(move.from)
  const to = parsePile(check.to)
  const count = check.cards.length
  const next = { ...state, moves: state.moves + 1 }
  let points = 0
  let flipped = false

  // take the cards off the source
  if (from.kind === 'waste') next.waste = state.waste.slice(0, -1)
  else if (from.kind === 'foundation') {
    next.foundations = state.foundations.map((p, i) => (i === from.index ? p.slice(0, -1) : p))
  } else {
    const column = state.tableau[from.index].slice(0, -count)
    next.tableau = state.tableau.map((c, i) => (i === from.index ? column : c))
    if (column.length > 0 && state.hidden[from.index] >= column.length) {
      next.hidden = state.hidden.map((h, i) => (i === from.index ? column.length - 1 : h))
      flipped = true
      points += SCORE.flip
    }
  }

  // put them on the target
  if (to.kind === 'foundation') {
    const base = next.foundations || state.foundations
    next.foundations = base.map((p, i) => (i === to.index ? [...p, ...check.cards] : p))
    if (from.kind !== 'foundation') points += SCORE.toFoundation
  } else {
    const base = next.tableau || state.tableau
    next.tableau = base.map((c, i) => (i === to.index ? [...c, ...check.cards] : c))
    if (from.kind === 'waste') points += SCORE.wasteToTableau
    if (from.kind === 'foundation') points += SCORE.foundationToTableau
  }

  next.score = addScore(state, points)
  return { ok: true, state: next, flipped }
}

/**
 * Rebuilds a game by replaying moves from its deal. Returns { state, history } where history[i] is the state before
 * move i (for undo), or null when any move is invalid, so a corrupted save can never produce an impossible position.
 */
export function replay(deal, draw, moves) {
  let state = createGame(deal, draw)
  const history = []
  for (const move of moves) {
    const r = applyMove(state, move)
    if (!r.ok) return null
    history.push(state)
    state = r.state
  }
  return { state, history }
}

/* ───────────── Game status ───────────── */

export const foundationCount = state => state.foundations.reduce((t, p) => t + p.length, 0)
export const isWon = state => foundationCount(state) === DECK_SIZE
export const hiddenCount = state => state.hidden.reduce((t, n) => t + n, 0)

/** Every card is face up and the stock is used up: the rest can be played to the foundations without thinking. */
export const canAutoFinish = state => !isWon(state) && state.stock.length === 0 && state.waste.length === 0 && hiddenCount(state) === 0

/** The next card to send up while auto-finishing: the lowest-ranked top card that fits a foundation. */
export function autoFinishMove(state) {
  let best = null
  const consider = (from, card) => {
    if (card === undefined || foundationFor(state, card) < 0) return
    if (!best || rankOf(card) < best.rank) best = { rank: rankOf(card), move: { type: 'move', from, to: 'f', count: 1 } }
  }
  consider('waste', topOf(state.waste))
  state.tableau.forEach((col, i) => consider(tableauId(i), topOf(col)))
  return best ? best.move : null
}

/**
 * The most sensible place to send cards you tapped twice or double-clicked: a foundation for a single card if
 * possible, then a non-empty column, then an empty column. Returns a move or null.
 */
export function smartMove(state, from, count = 1) {
  const source = parsePile(from)
  if (!source || source.kind === 'stock') return null
  if (count === 1) {
    const toF = { type: 'move', from, to: 'f', count: 1 }
    if (source.kind !== 'foundation' && validateMove(state, toF).ok) return toF
  }
  const order = Array.from({ length: COLUMNS }, (_, k) => (source.kind === 'tableau' ? (source.index + 1 + k) % COLUMNS : k))
  let empty = null
  for (const i of order) {
    const move = { type: 'move', from, to: tableauId(i), count }
    if (!validateMove(state, move).ok) continue
    if (state.tableau[i].length) return move
    // A King that already sits at the bottom of a column has nothing to gain from an empty column.
    const pointless = source.kind === 'tableau' && state.tableau[source.index].length === count
    if (!empty && !pointless) empty = move
  }
  return empty
}

/** Cards in the stock and waste you could reach by drawing, without changing anything else (one full cycle). */
export function reachableTalon(state) {
  const deck = [...state.waste, ...[...state.stock].reverse()]
  const n = deck.length
  if (!n) return []
  const seen = new Set()
  const out = []
  let p = state.waste.length
  for (let guard = 0; guard <= 2 * n + 2 && !seen.has(p); guard++) {
    seen.add(p)
    if (p > 0) out.push(deck[p - 1])
    p = p === n ? 0 : Math.min(n, p + state.draw)
  }
  return [...new Set(out)]
}

/**
 * Is there still a move that makes progress? Progress means: a card to a foundation, a stock or waste card to a
 * column, uncovering a face-down card, or freeing a column for a King that is waiting. Shuffling runs back and forth
 * between columns does not count. Used to tell the player when they are stuck.
 */
export function hasUsefulMove(state) {
  if (isWon(state)) return false
  for (let i = 0; i < COLUMNS; i++) if (state.tableau[i].length && foundationFor(state, topOf(state.tableau[i])) >= 0) return true

  for (const card of reachableTalon(state)) {
    if (foundationFor(state, card) >= 0) return true
    for (const col of state.tableau) {
      if (col.length ? canStack(card, topOf(col)) : rankOf(card) === KING) return true
    }
  }

  const waitingKing =
    reachableTalon(state).some(c => rankOf(c) === KING) ||
    state.tableau.some((col, i) => col.some((c, k) => k > 0 && k >= state.hidden[i] && rankOf(c) === KING && isMovableRun(state, i, k)))

  for (let i = 0; i < COLUMNS; i++) {
    const col = state.tableau[i]
    for (let k = state.hidden[i]; k < col.length; k++) {
      if (!isMovableRun(state, i, k)) continue
      const lead = col[k]
      const exposesHidden = k === state.hidden[i] && state.hidden[i] > 0
      const emptiesColumn = k === 0
      const exposedToFoundation = k > state.hidden[i] && foundationFor(state, col[k - 1]) >= 0
      if (!exposesHidden && !exposedToFoundation && !(emptiesColumn && waitingKing)) continue
      for (let j = 0; j < COLUMNS; j++) {
        if (j === i) continue
        const target = state.tableau[j]
        if (target.length ? canStack(lead, topOf(target)) : rankOf(lead) === KING && !emptiesColumn) return true
      }
    }
  }
  return false
}

/** Every legal move from this position, skipping the ones that change nothing (a bottom King to an empty column). */
export function listMoves(state) {
  const moves = []
  if (isWon(state)) return moves
  if (state.stock.length || state.waste.length) moves.push({ type: 'draw' })
  const sources = []
  if (state.waste.length) sources.push(['waste', 1])
  state.foundations.forEach((p, i) => p.length && sources.push([foundationId(i), 1]))
  state.tableau.forEach((col, i) => {
    for (let n = 1; n <= runLength(state, i); n++) sources.push([tableauId(i), n])
  })
  for (const [from, count] of sources) {
    const fp = parsePile(from)
    if (count === 1 && fp.kind !== 'foundation') {
      const m = { type: 'move', from, to: 'f', count }
      if (validateMove(state, m).ok) moves.push(m)
    }
    for (let j = 0; j < COLUMNS; j++) {
      const to = tableauId(j)
      if (to === from) continue
      if (fp.kind === 'tableau' && state.tableau[j].length === 0 && state.tableau[fp.index].length === count) continue
      const m = { type: 'move', from, to, count }
      if (validateMove(state, m).ok) moves.push(m)
    }
  }
  return moves
}

/** True for a well-formed move object (used when reading saves). */
export function isMoveShape(m) {
  if (!m || typeof m !== 'object') return false
  if (m.type === 'draw') return true
  return m.type === 'move' && parsePile(m.from) !== null && parsePile(m.to) !== null && Number.isInteger(m.count ?? 1) && (m.count ?? 1) >= 1 && (m.count ?? 1) <= 13
}
