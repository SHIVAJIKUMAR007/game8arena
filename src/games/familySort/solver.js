// Best-first solver for Family Sort positions. It backs the hint button and double-checks generated levels.
// It searches a bounded number of positions, so it returns { solved: false } rather than hanging on a huge puzzle.
import { CAPACITY, applyMove, isBottleDone, isSolved, topColor, topRun } from './logic'

const keyOf = bottles => bottles.map(b => b.join('.')).sort().join('|')

/** Estimated work left: colour runs that still have to be joined up. Lower is closer to solved. */
function estimate(bottles) {
  const colors = new Set()
  let runs = 0
  for (const b of bottles) {
    for (let i = 0; i < b.length; i++) {
      colors.add(b[i])
      if (i === 0 || b[i] !== b[i - 1]) runs++
    }
  }
  return runs - colors.size
}

/** Pours worth trying. Skips moving a finished bottle and shuffling a one-colour bottle into an empty one. */
function candidateMoves(bottles, capacity) {
  const moves = []
  const firstEmpty = bottles.findIndex(b => b.length === 0)
  for (let f = 0; f < bottles.length; f++) {
    const src = bottles[f]
    if (!src.length || isBottleDone(src, capacity)) continue
    const uniform = topRun(src) === src.length
    for (let t = 0; t < bottles.length; t++) {
      if (t === f) continue
      const dst = bottles[t]
      if (dst.length >= capacity) continue
      if (dst.length === 0) {
        if (uniform || t !== firstEmpty) continue
      } else if (topColor(dst) !== topColor(src)) continue
      moves.push([f, t])
    }
  }
  return moves
}

/** Minimal binary min-heap keyed on `f`. */
class Heap {
  constructor() {
    this.a = []
  }

  get size() {
    return this.a.length
  }

  push(item) {
    const a = this.a
    a.push(item)
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p].f <= a[i].f) break
      const t = a[p]
      a[p] = a[i]
      a[i] = t
      i = p
    }
  }

  pop() {
    const a = this.a
    const top = a[0]
    const last = a.pop()
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l].f < a[m].f) m = l
        if (r < a.length && a[r].f < a[m].f) m = r
        if (m === i) break
        const t = a[m]
        a[m] = a[i]
        a[i] = t
        i = m
      }
    }
    return top
  }
}

/**
 * @param {number[][]} bottles
 * @param {{ capacity?: number, maxNodes?: number }} [opts]
 * @returns {{ solved: boolean, moves: Array<[number, number]>, nodes: number }}
 */
export function solve(bottles, { capacity = CAPACITY, maxNodes = 30000 } = {}) {
  if (isSolved(bottles, capacity)) return { solved: true, moves: [], nodes: 0 }
  const seen = new Set([keyOf(bottles)])
  const heap = new Heap()
  heap.push({ b: bottles, g: 0, f: estimate(bottles) * 3, parent: null, move: null })
  let nodes = 0
  while (heap.size && nodes < maxNodes) {
    const cur = heap.pop()
    nodes++
    for (const [f, t] of candidateMoves(cur.b, capacity)) {
      const { bottles: nb } = applyMove(cur.b, f, t, capacity)
      const key = keyOf(nb)
      if (seen.has(key)) continue
      seen.add(key)
      const node = { b: nb, g: cur.g + 1, f: 0, parent: cur, move: [f, t] }
      if (isSolved(nb, capacity)) {
        const moves = []
        for (let n = node; n.parent; n = n.parent) moves.push(n.move)
        return { solved: true, moves: moves.reverse(), nodes }
      }
      node.f = estimate(nb) * 3 + node.g
      heap.push(node)
    }
  }
  return { solved: false, moves: [], nodes }
}

/** First move of a solution from this position, or null when none was found. */
export function findHint(bottles, opts) {
  const { solved, moves } = solve(bottles, opts)
  return solved && moves.length ? moves[0] : null
}
