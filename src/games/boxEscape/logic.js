// Box Escape (Sokoban) rules, solver and level generator.
//
// A puzzle is a rectangular grid indexed by cell = r * w + c, always enclosed by walls:
//   { w, h, wall: boolean[], targets: number[], boxes: number[], player: number, par: number }
// `par` is the optimal number of pushes. Levels are built by searching *backwards* from the solved
// position (pulling boxes off their targets), so every generated level is solvable by construction
// and the deepest state reached is the hardest start the room offers.
import { createRng } from '../../platform/rng'

export const DIRS = ['up', 'down', 'left', 'right']
const delta = (p, dir) => ({ up: -p.w, down: p.w, left: -1, right: 1 })[dir]

// ---------- text format (standard Sokoban notation, handy for tests) ----------
// '#' wall, ' ' or '-' floor, '.' target, '$' box, '*' box on target, '@' player, '+' player on target
export function parse(rows) {
  const h = rows.length
  const w = Math.max(...rows.map(r => r.length))
  const wall = [], targets = [], boxes = []
  let player = -1
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ch = rows[r][c] ?? '#'
      const i = r * w + c
      wall[i] = ch === '#'
      if ('.*+'.includes(ch)) targets.push(i)
      if ('$*'.includes(ch)) boxes.push(i)
      if ('@+'.includes(ch)) player = i
    }
  }
  return { w, h, wall, targets, boxes, player, par: 0 }
}

export function toRows(p, boxes = p.boxes, player = p.player) {
  const t = new Set(targets(p)), b = new Set(boxes)
  return Array.from({ length: p.h }, (_, r) => Array.from({ length: p.w }, (_, c) => {
    const i = r * p.w + c
    if (p.wall[i]) return '#'
    if (i === player) return t.has(i) ? '+' : '@'
    if (b.has(i)) return t.has(i) ? '*' : '$'
    return t.has(i) ? '.' : ' '
  }).join(''))
}

const targets = p => p.targets
export const isSolved = (p, boxes) => { const t = new Set(p.targets); return boxes.every(b => t.has(b)) }
export const onTargetCount = (p, boxes) => { const t = new Set(p.targets); return boxes.filter(b => t.has(b)).length }

// ---------- moves ----------
/** One step. Returns { player, boxes, pushed } (pushed = index into boxes, or -1) or null when blocked. */
export function step(p, player, boxes, dir) {
  const d = delta(p, dir)
  const to = player + d
  if (p.wall[to]) return null
  const k = boxes.indexOf(to)
  if (k < 0) return { player: to, boxes, pushed: -1 }
  const beyond = to + d
  if (p.wall[beyond] || boxes.includes(beyond)) return null
  const next = boxes.slice()
  next[k] = beyond
  return { player: to, boxes: next, pushed: k }
}

/** Cells the player can walk to without pushing. Returns Uint8Array mask plus the smallest cell (canonical id). */
function flood(p, from, boxSet) {
  const seen = new Uint8Array(p.w * p.h)
  const stack = [from]
  seen[from] = 1
  let min = from
  const ds = [-p.w, p.w, -1, 1]
  while (stack.length) {
    const i = stack.pop()
    if (i < min) min = i
    for (const d of ds) {
      const j = i + d
      if (!seen[j] && !p.wall[j] && !boxSet.has(j)) { seen[j] = 1; stack.push(j) }
    }
  }
  return { seen, min }
}

/** Shortest walk (list of dirs) from `from` to `to` that doesn't push anything, or null. */
export function walkPath(p, from, to, boxes) {
  if (from === to) return []
  const boxSet = new Set(boxes)
  if (p.wall[to] || boxSet.has(to)) return null
  const prev = new Map([[from, null]])
  const queue = [from]
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]
    for (const dir of DIRS) {
      const j = i + delta(p, dir)
      if (prev.has(j) || p.wall[j] || boxSet.has(j)) continue
      prev.set(j, [i, dir])
      if (j === to) {
        const path = []
        for (let k = j; prev.get(k); k = prev.get(k)[0]) path.push(prev.get(k)[1])
        return path.reverse()
      }
      queue.push(j)
    }
  }
  return null
}

// ---------- deadlocks ----------
const deadCache = new WeakMap()
/** Floor cells a box can never leave towards any target (corners, dead wall runs). */
export function deadSquares(p) {
  if (deadCache.has(p)) return deadCache.get(p)
  const live = new Uint8Array(p.w * p.h)
  const queue = [...p.targets]
  queue.forEach(t => { live[t] = 1 })
  const ds = [-p.w, p.w, -1, 1]
  for (let q = 0; q < queue.length; q++) {
    const b = queue[q]
    // A box at b can be pulled to b+d when the player has room at b+d and b+2d.
    for (const d of ds) {
      const to = b + d
      if (!live[to] && !p.wall[to] && !p.wall[to + d]) { live[to] = 1; queue.push(to) }
    }
  }
  const dead = p.wall.map((w, i) => !w && !live[i])
  deadCache.set(p, dead)
  return dead
}

/** A box at `cell` is jammed in a 2×2 block of walls/boxes with at least one box off-target. */
export function isFrozen(p, boxes, cell) {
  const b = new Set(boxes), t = new Set(p.targets)
  const blocked = i => p.wall[i] || b.has(i)
  for (const a of [cell, cell - 1, cell - p.w, cell - p.w - 1]) {
    const sq = [a, a + 1, a + p.w, a + p.w + 1]
    if (sq.every(blocked) && sq.some(i => b.has(i) && !t.has(i))) return true
  }
  return false
}

/** Would this push leave a box that can provably never be solved? */
export function isDeadlock(p, boxes, movedCell) {
  return deadSquares(p)[movedCell] || isFrozen(p, boxes, movedCell)
}

// ---------- solver ----------
/**
 * Breadth-first search over pushes. Returns the optimal list of pushes [{ box, dir }] (box = cell the
 * box is on before the push), null when the position is unsolvable, or undefined if `limit` states
 * were explored without an answer.
 */
export function solve(p, player, boxes, limit = 200000) {
  const tset = new Set(p.targets)
  const dead = deadSquares(p)
  const start = [...boxes].sort((a, b) => a - b)
  if (start.every(b => tset.has(b))) return []
  // States are de-duplicated when dequeued (one flood fill each), which keeps BFS order and optimality.
  const sBoxes = [start], sPlayer = [player], sParent = [-1], sPush = [null]
  const seen = new Set(), queued = new Set([start.join(',') + '|' + player])
  const ds = DIRS.map(dir => [dir, delta(p, dir)])
  for (let q = 0; q < sBoxes.length; q++) {
    if (seen.size >= limit) return undefined
    const bx = sBoxes[q]
    const set = new Set(bx)
    const { seen: reach, min } = flood(p, sPlayer[q], set)
    const key = bx.join(',') + '|' + min
    if (seen.has(key)) continue
    seen.add(key)
    for (let k = 0; k < bx.length; k++) {
      const b = bx[k]
      for (const [dir, d] of ds) {
        const to = b + d
        if (!reach[b - d] || p.wall[to] || set.has(to) || dead[to]) continue
        const next = bx.slice()
        next[k] = to
        next.sort((x, y) => x - y)
        const raw = next.join(',') + '|' + b
        if (queued.has(raw) || isFrozen(p, next, to)) continue
        queued.add(raw)
        sBoxes.push(next); sPlayer.push(b); sParent.push(q); sPush.push({ box: b, dir })
        if (next.every(x => tset.has(x))) {
          const pushes = []
          for (let i = sBoxes.length - 1; i > 0; i = sParent[i]) pushes.push(sPush[i])
          return pushes.reverse()
        }
      }
    }
  }
  return null
}

/** Expand a list of pushes into individual player steps (walks included). */
export function pushesToMoves(p, player, boxes, pushes) {
  const moves = []
  let pl = player, bx = boxes.slice()
  for (const { box, dir } of pushes) {
    const walk = walkPath(p, pl, box - delta(p, dir), bx)
    if (!walk) throw new Error('bad push list')
    moves.push(...walk, dir)
    pl = box
    bx = bx.map(b => (b === box ? box + delta(p, dir) : b))
  }
  return moves
}

/** Next push towards a solution from the current position: { box, dir, stand, left } | null | undefined. */
export function hintFor(p, player, boxes) {
  const pushes = solve(p, player, boxes, 150000)
  if (!pushes || !pushes.length) return pushes
  const { box, dir } = pushes[0]
  return { box, dir, stand: box - delta(p, dir), left: pushes.length }
}

// ---------- generator ----------
/** Difficulty curve: room size, box count and wall density grow with the level. */
export function paramsFor(level) {
  const L = Math.max(1, level)
  return {
    w: Math.min(8, 4 + Math.floor((L + 1) / 3)),
    h: Math.min(8, 4 + Math.floor(L / 3)),
    boxes: L === 1 ? 1 : L <= 3 ? 2 : L <= 7 ? 3 : 4,
    wallFrac: Math.min(0.24, 0.1 + L * 0.012),
    tries: L <= 7 ? 8 : 5,
    limit: L <= 7 ? 20000 : 15000,
  }
}

function makeRoom(rng, iw, ih, wallFrac, minFloor) {
  const w = iw + 2, h = ih + 2
  for (let attempt = 0; attempt < 50; attempt++) {
    const wall = Array.from({ length: w * h }, (_, i) => {
      const r = Math.floor(i / w), c = i % w
      return r === 0 || c === 0 || r === h - 1 || c === w - 1
    })
    // Cut 0-2 corner blocks for an irregular outline.
    for (let n = rng.int(0, 2); n > 0; n--) {
      const cw = rng.int(1, Math.max(1, Math.floor(iw / 2))), ch = rng.int(1, Math.max(1, Math.floor(ih / 2)))
      const right = rng.next() < 0.5, bottom = rng.next() < 0.5
      for (let r = 0; r < ch; r++) for (let c = 0; c < cw; c++) {
        wall[(bottom ? ih - r : 1 + r) * w + (right ? iw - c : 1 + c)] = true
      }
    }
    const floor = () => wall.flatMap((x, i) => (x ? [] : [i]))
    for (let n = Math.round(wallFrac * floor().length); n > 0; n--) wall[rng.pick(floor())] = true
    // Fill dead-end nooks (floor with 3+ walls around): they only add clutter.
    for (let changed = true; changed;) {
      changed = false
      for (const i of floor()) {
        if ([i - w, i + w, i - 1, i + 1].filter(j => wall[j]).length >= 3) { wall[i] = true; changed = true }
      }
    }
    const cells = floor()
    if (cells.length < minFloor) continue
    const room = { w, h, wall }
    if (flood(room, cells[0], new Set()).seen.reduce((a, x) => a + x, 0) !== cells.length) continue
    return { room, cells }
  }
  return null
}

/** Breadth-first pulls from the solved position. Returns every visited state with its depth. */
function reverseSearch(p, limit) {
  const goal = [...p.targets].sort((a, b) => a - b)
  const set = new Set(goal)
  const sBoxes = [], sPlayer = [], sDepth = [], valid = []
  const seen = new Set(), queued = new Set()
  // The player may finish anywhere around the solved boxes: seed every free cell (duplicates drop out below).
  for (let i = 0; i < p.wall.length; i++) {
    if (!p.wall[i] && !set.has(i)) { sBoxes.push(goal); sPlayer.push(i); sDepth.push(0) }
  }
  const ds = [-p.w, p.w, -1, 1]
  for (let q = 0; q < sBoxes.length && seen.size < limit; q++) {
    const bx = sBoxes[q]
    const bset = new Set(bx)
    const { seen: reach, min } = flood(p, sPlayer[q], bset)
    const key = bx.join(',') + '|' + min
    if (seen.has(key)) continue
    seen.add(key)
    valid.push(q)
    for (let k = 0; k < bx.length; k++) {
      const b = bx[k]
      for (const d of ds) {
        const stand = b + d, back = b + 2 * d // player at `stand` steps back to `back`, dragging the box to `stand`
        if (!reach[stand] || p.wall[back] || bset.has(back)) continue
        const next = bx.slice()
        next[k] = stand
        next.sort((x, y) => x - y)
        const raw = next.join(',') + '|' + back
        if (queued.has(raw)) continue
        queued.add(raw)
        sBoxes.push(next); sPlayer.push(back); sDepth.push(sDepth[q] + 1)
      }
    }
  }
  return { sBoxes, sPlayer, sDepth, valid }
}

const cache = new Map()

/** Deterministic level for a seed: same seed + level = same puzzle for everyone. */
export function generateLevel(seed, level) {
  const id = `${seed}#${level}`
  if (cache.has(id)) return cache.get(id)
  const rng = createRng(id)
  const prm = paramsFor(level)
  let best = null
  for (let t = 0; t < prm.tries; t++) {
    const made = makeRoom(rng, prm.w, prm.h, prm.wallFrac, prm.boxes * 3 + 4)
    if (!made) continue
    const { room, cells } = made
    const p = { ...room, targets: rng.shuffle(cells.slice()).slice(0, prm.boxes).sort((a, b) => a - b) }
    const { sBoxes, sPlayer, sDepth, valid } = reverseSearch(p, prm.limit)
    const tset = new Set(p.targets)
    // Best start: every box off its target, deepest (most pushes), ties broken by box spread.
    let pick = -1, score = -1
    for (const i of valid) {
      if (sBoxes[i].some(b => tset.has(b))) continue
      const s = sDepth[i] * 100 + rng.int(0, 99)
      if (s > score) { score = s; pick = i }
    }
    if (pick < 0 || (best && sDepth[pick] <= best.par)) continue
    best = { ...p, boxes: sBoxes[pick], player: sPlayer[pick], par: sDepth[pick] }
  }
  if (!best) best = { ...parse(['######', '#@ $.#', '######']), par: 1 } // never expected; keeps the game playable
  cache.set(id, best)
  return best
}
