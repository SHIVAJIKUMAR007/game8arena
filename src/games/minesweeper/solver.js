// Minesweeper deduction engine.
//
// It works only from what a player can see: the numbers on open cells, plus the total mine count. It never looks at
// where mines really are, so a hint can't leak hidden information. The same engine solves generated boards (to prove
// they need no guessing) and answers the hint button.
//
// Techniques, cheapest first. The solver always uses the cheapest one that finds something, so the techniques a
// board *needs* are the ones its solve was forced to reach for:
//   basic   one number: all its remaining neighbours are safe, or all are mines
//   count   the total mine count: no mines left → the rest is safe; as many mines as cells left → all mines
//   subset  two numbers where one's closed cells sit inside the other's (the 1-2 and 1-2-1 patterns)
//   enum    exhaustive search over a connected group of numbers, keeping only what holds in every solution
import { neighbours } from './logic'

export const TECHNIQUES = ['basic', 'count', 'subset', 'enum']
export const TECH_RANK = { basic: 0, count: 1, subset: 2, enum: 3 }
/** Techniques each tier of play may rely on, by hardest allowed technique. */
const ALLOWED = { basic: ['basic', 'count'], subset: ['basic', 'count', 'subset'], enum: TECHNIQUES }

const ENUM_MAX_CELLS = 26 // largest connected frontier group we will search
const ENUM_NODE_LIMIT = 40000 // search steps per group before giving up on it

/** Knowledge: num[i] is the number shown on an open cell, -1 while closed. mark[i] = deduced mine. */
export function newKnowledge(w, h, total) {
  return { w, h, total, num: new Int8Array(w * h).fill(-1), mark: new Uint8Array(w * h) }
}

export function knowledgeFromGame(game) {
  const k = newKnowledge(game.w, game.h, game.mineCount)
  for (let i = 0; i < game.w * game.h; i++) if (game.revealed[i] && !game.mines?.[i]) k.num[i] = game.counts[i]
  return k
}

/** One constraint per open number that still touches unknown cells: "exactly `rem` mines among `cells`". */
function constraints(k) {
  const out = []
  const seen = new Set()
  for (let i = 0; i < k.w * k.h; i++) {
    if (k.num[i] <= 0) continue
    const cells = []
    let marked = 0
    for (const j of neighbours(i, k.w, k.h)) {
      if (k.mark[j]) marked++
      else if (k.num[j] === -1) cells.push(j)
    }
    if (!cells.length) continue
    const key = `${cells.join(',')}|${k.num[i] - marked}`
    if (seen.has(key)) continue // two numbers that say the same thing count once
    seen.add(key)
    out.push({ cells, rem: k.num[i] - marked })
  }
  return out
}

function basic(cons) {
  const safe = new Set()
  const mines = new Set()
  for (const c of cons) {
    if (c.rem === 0) c.cells.forEach(x => safe.add(x))
    else if (c.rem === c.cells.length) c.cells.forEach(x => mines.add(x))
  }
  return { safe, mines }
}

function count(k) {
  let unknown = 0
  let marked = 0
  for (let i = 0; i < k.w * k.h; i++) {
    if (k.mark[i]) marked++
    else if (k.num[i] === -1) unknown++
  }
  const left = k.total - marked
  const cells = []
  if (left === 0 || left === unknown) {
    for (let i = 0; i < k.w * k.h; i++) if (!k.mark[i] && k.num[i] === -1) cells.push(i)
  }
  return left === 0 ? { safe: new Set(cells), mines: new Set() } : left === unknown ? { safe: new Set(), mines: new Set(cells) } : { safe: new Set(), mines: new Set() }
}

function subset(cons) {
  const safe = new Set()
  const mines = new Set()
  const byCell = new Map()
  cons.forEach((c, ci) => c.cells.forEach(x => (byCell.get(x) || byCell.set(x, []).get(x)).push(ci)))
  const sets = cons.map(c => new Set(c.cells))
  cons.forEach((a, ai) => {
    for (const bi of byCell.get(a.cells[0])) {
      const b = cons[bi]
      if (bi === ai || b.cells.length <= a.cells.length) continue
      if (!a.cells.every(x => sets[bi].has(x))) continue
      const diff = b.cells.filter(x => !sets[ai].has(x))
      const d = b.rem - a.rem
      if (d === 0) diff.forEach(x => safe.add(x))
      else if (d === diff.length) diff.forEach(x => mines.add(x))
    }
  })
  return { safe, mines }
}

/** Connected groups of constraints (they share closed cells). */
function components(cons) {
  const parent = cons.map((_, i) => i)
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const owner = new Map()
  cons.forEach((c, ci) => c.cells.forEach(x => {
    if (owner.has(x)) parent[find(ci)] = find(owner.get(x))
    else owner.set(x, ci)
  }))
  const groups = new Map()
  cons.forEach((c, ci) => (groups.get(find(ci)) || groups.set(find(ci), []).get(find(ci))).push(c))
  return [...groups.values()]
}

/** Tries every mine layout for one group. Returns { safe, mines, size } or null if too big. */
function enumerate(group) {
  const cells = [...new Set(group.flatMap(c => c.cells))]
  if (cells.length > ENUM_MAX_CELLS) return null
  // Visit cells in the order the numbers reach them, so constraints close early and prune hard.
  const order = []
  const seen = new Set()
  for (const c of group) for (const x of c.cells) if (!seen.has(x)) { seen.add(x); order.push(x) }
  const at = new Map(order.map((x, i) => [x, i]))
  const rows = group.map(c => ({ vars: c.cells.map(x => at.get(x)), rem: c.rem }))
  const varRows = order.map(() => [])
  rows.forEach((r, ri) => r.vars.forEach(v => varRows[v].push(ri)))
  const mineSum = rows.map(() => 0)
  const left = rows.map(r => r.vars.length)
  const val = new Int8Array(order.length)
  const freq = new Array(order.length).fill(0)
  let solutions = 0
  let nodes = 0
  let aborted = false

  const go = pos => {
    if (aborted) return
    if (++nodes > ENUM_NODE_LIMIT) { aborted = true; return }
    if (pos === order.length) {
      solutions++
      for (let v = 0; v < order.length; v++) freq[v] += val[v]
      return
    }
    for (let m = 0; m <= 1; m++) {
      val[pos] = m
      let ok = true
      for (const ri of varRows[pos]) {
        mineSum[ri] += m
        left[ri]--
        if (mineSum[ri] > rows[ri].rem || mineSum[ri] + left[ri] < rows[ri].rem) ok = false
      }
      if (ok) go(pos + 1)
      for (const ri of varRows[pos]) { mineSum[ri] -= m; left[ri]++ }
      if (aborted) return
    }
  }
  go(0)
  if (aborted || solutions === 0) return null
  const safe = []
  const mines = []
  order.forEach((x, v) => {
    if (freq[v] === 0) safe.push(x)
    else if (freq[v] === solutions) mines.push(x)
  })
  return { safe, mines, size: order.length }
}

function exhaustive(cons) {
  const safe = new Set()
  const mines = new Set()
  let size = 0
  for (const group of components(cons)) {
    const r = enumerate(group)
    if (!r) continue
    if (r.safe.length || r.mines.length) size = Math.max(size, r.size)
    r.safe.forEach(x => safe.add(x))
    r.mines.forEach(x => mines.add(x))
  }
  return { safe, mines, size }
}

/**
 * The cheapest technique that finds anything, with what it found.
 * Returns { tech, safe: number[], mines: number[], size } or null when only a guess is left.
 * `maxTech` caps the hardest technique allowed ('basic' | 'subset' | 'enum').
 */
export function deduce(k, maxTech = 'enum') {
  const allowed = ALLOWED[maxTech] || ALLOWED.enum
  const cons = constraints(k)
  const done = (tech, r, extra = {}) =>
    r.safe.size || r.mines.size ? { tech, safe: [...r.safe], mines: [...r.mines], size: 0, ...extra } : null
  return (
    done('basic', basic(cons)) ||
    (allowed.includes('count') && done('count', count(k))) ||
    (allowed.includes('subset') && done('subset', subset(cons))) ||
    (allowed.includes('enum') && (r => done('enum', r, { size: r.size }))(exhaustive(cons))) ||
    null
  )
}

/** Opens `idx` in knowledge using the true counts, flooding through zeros. */
function openIn(k, counts, idx) {
  const queue = [idx]
  k.num[idx] = counts[idx]
  while (queue.length) {
    const cur = queue.pop()
    if (counts[cur] !== 0) continue
    for (const n of neighbours(cur, k.w, k.h)) {
      if (k.num[n] !== -1) continue
      k.num[n] = counts[n]
      queue.push(n)
    }
  }
}

/**
 * Plays a whole board from `firstIdx` using only deductions.
 * @param {{w:number,h:number,mineCount:number,mines:Uint8Array,counts:Uint8Array}} board
 * @returns {{solved:boolean, remaining:number, forced:number, advanced:number, techniques:Object, hardest:string,
 *   frontierPeak:number, enumPeak:number, rounds:number}}
 */
export function solve(board, firstIdx, maxTech = 'enum') {
  const { w, h, mineCount, mines, counts } = board
  const k = newKnowledge(w, h, mineCount)
  openIn(k, counts, firstIdx)
  const techniques = { basic: 0, count: 0, subset: 0, enum: 0 }
  let hardest = 'basic'
  let forced = 0
  let rounds = 0
  let frontierPeak = 0
  let enumPeak = 0
  const target = w * h - mineCount
  const opened = () => k.num.reduce((t, n) => t + (n >= 0 ? 1 : 0), 0)

  while (opened() < target) {
    const cons = constraints(k)
    frontierPeak = Math.max(frontierPeak, new Set(cons.flatMap(c => c.cells)).size)
    const d = deduce(k, maxTech)
    if (!d) break
    rounds++
    techniques[d.tech] += d.safe.length + d.mines.length
    forced += d.safe.length + d.mines.length
    if (TECH_RANK[d.tech] > TECH_RANK[hardest]) hardest = d.tech
    if (d.tech === 'enum') enumPeak = Math.max(enumPeak, d.size)
    for (const m of d.mines) {
      if (!mines[m]) return fail(techniques, hardest, forced, rounds, frontierPeak, enumPeak, target - opened()) // unsound deduction
      k.mark[m] = 1
    }
    for (const s of d.safe) {
      if (mines[s]) return fail(techniques, hardest, forced, rounds, frontierPeak, enumPeak, target - opened())
      if (k.num[s] === -1) openIn(k, counts, s)
    }
  }
  const remaining = target - opened()
  return {
    solved: remaining === 0,
    remaining,
    forced,
    advanced: techniques.subset + techniques.enum,
    techniques,
    hardest,
    frontierPeak,
    enumPeak,
    rounds,
  }
}

function fail(techniques, hardest, forced, rounds, frontierPeak, enumPeak, remaining) {
  return { solved: false, remaining, forced, advanced: techniques.subset + techniques.enum, techniques, hardest, frontierPeak, enumPeak, rounds, unsound: true }
}

/**
 * A move the player can make for certain, or null when the position needs a guess.
 * Uses only open numbers; the player's own flags are ignored (they may be wrong). Prefers a safe cell, then a mine
 * the player hasn't flagged yet.
 * @returns {{idx:number, type:'safe'|'mine', tech:string}|null}
 */
export function findHint(game, maxTech = 'enum') {
  if (game.status !== 'playing') return null
  const k = knowledgeFromGame(game)
  for (let guard = 0; guard < game.w * game.h; guard++) {
    const d = deduce(k, maxTech)
    if (!d) return null
    if (d.safe.length) return { idx: d.safe[0], type: 'safe', tech: d.tech }
    const fresh = d.mines.find(m => !game.flags[m])
    if (fresh !== undefined) return { idx: fresh, type: 'mine', tech: d.tech }
    d.mines.forEach(m => { k.mark[m] = 1 }) // already flagged: take them as known and look further
  }
  return null
}
