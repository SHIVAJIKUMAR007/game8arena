// Search-based Klondike solver.
//
// It plays with every card known (a "thoughtful" solver), which is what a deal generator needs: it answers "can this
// deal be won, and how much searching does it take?". It is also used for hints, from the current position.
//
// How it searches:
//   • Depth-first search with a transposition table, so a position reached twice is only explored once. Columns are
//     sorted in the position key, because two positions that differ only by column order play the same.
//   • The stock and waste never change order when you draw or recycle, they only change where the split is. So the
//     solver treats them as one fixed list `talon` plus a pointer `pos` (cards in the waste), and turns "draw until
//     card X is on top, then play it" into one macro move. That removes almost all the branching from drawing.
//   • Safe foundation moves are made at once without branching. A card is safe when both foundations of the other
//     colour have reached one rank below it, so no card in play could ever need to sit on it.
//   • Tableau-to-tableau moves are only tried when they uncover a face-down card, let a card go up to a foundation,
//     or empty a column for a King that is waiting. Moving runs back and forth for nothing is never tried.
//   • A node budget keeps it fast and deterministic. Running out of budget gives status 'unknown', not a guess.
import { DECK_SIZE, KING, canStack, isRed, rankOf, suitOf } from './cards'
import { COLUMNS } from './deal'

export const DEFAULT_BUDGET = 40000

const chr = c => String.fromCharCode(48 + c)
const OPPOSITE = [[1, 2], [0, 3], [0, 3], [1, 2]] // the two suits of the other colour, for each suit

/** Solver position from a game state (see rules.js). */
function fromGame(game) {
  const found = [0, 0, 0, 0]
  const fmap = [-1, -1, -1, -1] // which foundation pile each suit is on, so moves can name real piles
  game.foundations.forEach((p, i) => {
    if (p.length) {
      found[suitOf(p[0])] = p.length
      fmap[suitOf(p[0])] = i
    }
  })
  return {
    cols: game.tableau.map(c => c.slice()),
    hidden: game.hidden.slice(),
    talon: [...game.waste, ...[...game.stock].reverse()],
    pos: game.waste.length,
    found,
    fmap,
    fc: found.reduce((t, n) => t + n, 0),
  }
}

const canFound = (node, card) => node.found[suitOf(card)] === rankOf(card) - 1
const isSafe = (node, card) => {
  const r = rankOf(card)
  if (r <= 2) return true
  const [a, b] = OPPOSITE[suitOf(card)]
  return node.found[a] >= r - 1 && node.found[b] >= r - 1
}

function keyOf(node) {
  const cols = node.cols.map((c, i) => node.hidden[i] + c.map(chr).join('')).sort().join('|')
  return node.found.join('') + '/' + node.pos + ':' + node.talon.map(chr).join('') + '/' + cols
}

/** Every talon position reachable by drawing (and recycling), with how many draw actions it takes. */
function talonOptions(node, draw) {
  const n = node.talon.length
  const out = []
  if (!n) return out
  const seen = new Set()
  let p = node.pos
  let actions = 0
  for (let guard = 0; guard <= 2 * n + 2 && !seen.has(p); guard++) {
    seen.add(p)
    if (p > 0) out.push({ p, d: actions })
    p = p === n ? 0 : Math.min(n, p + draw)
    actions++
  }
  return out
}

/* ───── making moves on solver positions (copy on write: a child never changes its parent) ───── */

function assignPile(node, suit) {
  if (node.fmap[suit] >= 0) return
  const used = new Set(node.fmap.filter(i => i >= 0))
  let i = 0
  while (used.has(i)) i++
  node.fmap = node.fmap.slice()
  node.fmap[suit] = i
}

function toFoundation(node, card) {
  const s = suitOf(card)
  assignPile(node, s)
  node.found = node.found.slice()
  node.found[s]++
  node.fc++
}

function removeFromColumn(node, i, count) {
  node.cols = node.cols.slice()
  const col = node.cols[i].slice(0, node.cols[i].length - count)
  node.cols[i] = col
  if (col.length > 0 && node.hidden[i] >= col.length) {
    node.hidden = node.hidden.slice()
    node.hidden[i] = col.length - 1
  }
}

function addToColumn(node, j, cards) {
  node.cols = node.cols.slice()
  node.cols[j] = node.cols[j].concat(cards)
}

function takeFromTalon(node, p) {
  const card = node.talon[p - 1]
  node.talon = node.talon.slice(0, p - 1).concat(node.talon.slice(p))
  node.pos = p - 1
  return card
}

const clone = node => ({ ...node })

function applyInternal(node, mv) {
  const n = clone(node)
  switch (mv.k) {
    case 'TF': {
      const col = n.cols[mv.i]
      const card = col[col.length - 1]
      removeFromColumn(n, mv.i, 1)
      toFoundation(n, card)
      break
    }
    case 'WF':
      toFoundation(n, takeFromTalon(n, mv.p))
      break
    case 'WT':
      addToColumn(n, mv.j, [takeFromTalon(n, mv.p)])
      break
    case 'TT': {
      const cards = n.cols[mv.i].slice(mv.idx)
      removeFromColumn(n, mv.i, cards.length)
      addToColumn(n, mv.j, cards)
      break
    }
    case 'FT': {
      const card = mv.card
      n.found = n.found.slice()
      n.found[mv.s]--
      n.fc--
      addToColumn(n, mv.j, [card])
      break
    }
  }
  return n
}

const draws = d => Array.from({ length: d }, () => ({ type: 'draw' }))

/** The game moves (rules.js format) that a solver move stands for. */
function gameMoves(node, mv) {
  switch (mv.k) {
    case 'TF': return [{ type: 'move', from: `t${mv.i}`, to: 'f', count: 1 }]
    case 'WF': return [...draws(mv.d), { type: 'move', from: 'waste', to: 'f', count: 1 }]
    case 'WT': return [...draws(mv.d), { type: 'move', from: 'waste', to: `t${mv.j}`, count: 1 }]
    case 'TT': return [{ type: 'move', from: `t${mv.i}`, to: `t${mv.j}`, count: node.cols[mv.i].length - mv.idx }]
    case 'FT': return [{ type: 'move', from: `f${node.fmap[mv.s]}`, to: `t${mv.j}`, count: 1 }]
  }
  return []
}

/** Makes every safe foundation move in place on a fresh node; returns the game moves made. */
function autoSafe(node, draw) {
  const made = []
  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < COLUMNS; i++) {
      const col = node.cols[i]
      if (!col.length) continue
      const card = col[col.length - 1]
      if (canFound(node, card) && isSafe(node, card)) {
        removeFromColumn(node, i, 1)
        toFoundation(node, card)
        made.push({ type: 'move', from: `t${i}`, to: 'f', count: 1 })
        changed = true
      }
    }
    // With draw 1 every talon card stays reachable, so taking the waste card up never hurts.
    if (draw === 1 && node.pos > 0) {
      const card = node.talon[node.pos - 1]
      if (canFound(node, card) && isSafe(node, card)) {
        takeFromTalon(node, node.pos)
        toFoundation(node, card)
        made.push({ type: 'move', from: 'waste', to: 'f', count: 1 })
        changed = true
      }
    }
  }
  return made
}

/** Candidate moves, best first. */
function generate(node, draw) {
  const { cols, hidden } = node
  const tf = []
  const wf = []
  const flips = []
  const wt = []
  const unlock = []
  const empties = []
  const fromFoundation = []
  const firstEmpty = cols.findIndex(c => c.length === 0)
  const options = talonOptions(node, draw)

  for (let i = 0; i < COLUMNS; i++) {
    const col = cols[i]
    if (col.length && canFound(node, col[col.length - 1])) tf.push({ k: 'TF', i })
  }
  for (const o of options) {
    const card = node.talon[o.p - 1]
    if (canFound(node, card)) wf.push({ k: 'WF', p: o.p, d: o.d })
    for (let j = 0; j < COLUMNS; j++) {
      const target = cols[j]
      if (target.length ? canStack(card, target[target.length - 1]) : rankOf(card) === KING && j === firstEmpty) {
        wt.push({ k: 'WT', p: o.p, d: o.d, j })
      }
    }
  }

  // Is there a King that would use an empty column? (in the talon, or on top of other cards in a column)
  let kingWaiting = options.some(o => rankOf(node.talon[o.p - 1]) === KING)
  for (let i = 0; i < COLUMNS && !kingWaiting; i++) {
    const col = cols[i]
    for (let k = Math.max(1, hidden[i]); k < col.length; k++) {
      if (rankOf(col[k]) === KING && runFrom(col, k)) { kingWaiting = true; break }
    }
  }

  for (let i = 0; i < COLUMNS; i++) {
    const col = cols[i]
    if (!col.length) continue
    for (let idx = col.length - 1; idx >= hidden[i]; idx--) {
      if (idx < col.length - 1 && !canStack(col[idx + 1], col[idx])) break
      const lead = col[idx]
      const exposes = idx === hidden[i] && hidden[i] > 0
      const empties_ = idx === 0
      const freesFoundation = idx > hidden[i] && canFound(node, col[idx - 1])
      if (!exposes && !freesFoundation && !(empties_ && kingWaiting)) continue
      for (let j = 0; j < COLUMNS; j++) {
        if (j === i) continue
        const target = cols[j]
        let ok
        if (target.length) ok = canStack(lead, target[target.length - 1])
        else ok = rankOf(lead) === KING && j === firstEmpty && !empties_
        if (!ok) continue
        const mv = { k: 'TT', i, idx, j, w: hidden[i] }
        if (exposes) flips.push(mv)
        else if (freesFoundation) unlock.push(mv)
        else empties.push(mv)
      }
    }
  }

  // Bringing a card back down from a foundation, only when something is waiting to go on it.
  for (let s = 0; s < 4; s++) {
    const r = node.found[s]
    if (r < 3) continue
    const card = s * 13 + r - 1
    const wants = c => rankOf(c) === r - 1 && isRed(c) !== isRed(card)
    const useful = options.some(o => wants(node.talon[o.p - 1])) || cols.some((col, i) => col.some((c, k) => k >= hidden[i] && wants(c)))
    if (!useful) continue
    for (let j = 0; j < COLUMNS; j++) {
      const target = cols[j]
      if (target.length && canStack(card, target[target.length - 1])) fromFoundation.push({ k: 'FT', s, j, card })
    }
  }

  flips.sort((a, b) => b.w - a.w)
  wf.sort((a, b) => a.d - b.d)
  wt.sort((a, b) => a.d - b.d)
  return [...tf, ...wf, ...flips, ...unlock, ...wt, ...empties, ...fromFoundation]
}

function runFrom(col, k) {
  for (let i = k + 1; i < col.length; i++) if (!canStack(col[i], col[i - 1])) return false
  return true
}

/**
 * Solves a game position.
 * @param {Object} game          a rules.js state
 * @param {Object} [opts]
 * @param {number} [opts.maxNodes]  search budget (positions explored)
 * @returns {{status:'solved'|'unsolved'|'unknown', moves:Object[], nodes:number}}
 *   moves: the full winning line in rules.js move format (draws included), when solved.
 *   'unsolved' means the search ran out of moves to try; 'unknown' means it ran out of budget first.
 */
export function solve(game, { maxNodes = DEFAULT_BUDGET } = {}) {
  const draw = game.draw === 3 ? 3 : 1
  const visited = new Set()
  const path = []
  let nodes = 0
  let aborted = false

  const dfs = node => {
    if (++nodes > maxNodes) {
      aborted = true
      return false
    }
    const mark = path.length
    for (const m of autoSafe(node, draw)) path.push(m)
    if (node.fc === DECK_SIZE) return true
    const key = keyOf(node)
    if (visited.has(key)) {
      path.length = mark
      return false
    }
    visited.add(key)
    for (const mv of generate(node, draw)) {
      const before = path.length
      for (const m of gameMoves(node, mv)) path.push(m)
      if (dfs(applyInternal(node, mv))) return true
      path.length = before
      if (aborted) break
    }
    path.length = mark
    return false
  }

  const solved = dfs(clone(fromGame(game)))
  return { status: solved ? 'solved' : aborted ? 'unknown' : 'unsolved', moves: solved ? path.slice() : [], nodes: Math.min(nodes, maxNodes) }
}
