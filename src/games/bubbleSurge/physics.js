// Projectile physics for Bubble Surge: straight flight, bounces off all four walls, sticking to the first bubble
// touched and snapping into the nearest free cell. Pure functions over plain numbers.
import { CELL_X, CELL_Y, COLS, CX, CY, D, H, N, R, RING_R, ROWS, W, index, nearestCell, rowOf, colOf } from './hex'
import { EMPTY } from './logic'

export const SPEED = 1500 // logical pixels per second
const HIT = D * 0.88 // centre distance at which a flying bubble counts as touching one on the field

/** @typedef {{ x: number, y: number, vx: number, vy: number, bounces: number, t: number }} Shot */

/** A bubble leaving the shooter at `angle` (radians, 0 = right, clockwise like canvas). */
export function makeShot(angle) {
  return { x: CX, y: CY, vx: Math.cos(angle) * SPEED, vy: Math.sin(angle) * SPEED, bounces: 0, t: 0 }
}

/** Indices of the cells in a small window around a point. */
function around(x, y, span = 2) {
  const c = nearestCell(x, y)
  const r0 = rowOf(c)
  const c0 = colOf(c)
  const out = []
  for (let r = Math.max(0, r0 - span); r <= Math.min(ROWS - 1, r0 + span); r++) {
    for (let k = Math.max(0, c0 - span); k <= Math.min(COLS - 1, c0 + span); k++) out.push(index(r, k))
  }
  return out
}

/** The filled cell a bubble at (x, y) is touching, if any (the nearest one). */
export function touching(cells, x, y) {
  let best = -1
  let bestD = HIT * HIT
  for (const i of around(x, y)) {
    if (cells[i] === EMPTY) continue
    const d = (CELL_X[i] - x) ** 2 + (CELL_Y[i] - y) ** 2
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

/** Reflects a shot that has crossed a wall and counts the bounce. Mutates and returns the shot. */
function bounce(p) {
  if (p.x < R) {
    p.x = R + (R - p.x)
    p.vx = Math.abs(p.vx)
    p.bounces++
  } else if (p.x > W - R) {
    p.x = W - R - (p.x - (W - R))
    p.vx = -Math.abs(p.vx)
    p.bounces++
  }
  if (p.y < R) {
    p.y = R + (R - p.y)
    p.vy = Math.abs(p.vy)
    p.bounces++
  } else if (p.y > H - R) {
    p.y = H - R - (p.y - (H - R))
    p.vy = -Math.abs(p.vy)
    p.bounces++
  }
  return p
}

/**
 * Moves a shot forward by `dt` seconds in small sub-steps so it can never skip over a bubble.
 * @returns {{ shot: Shot, hit: number }} `hit` is the cell index of the bubble it touched, or -1 while still flying
 */
export function stepShot(cells, shot, dt) {
  const p = { ...shot }
  const dist = Math.hypot(p.vx, p.vy) * dt
  const steps = Math.max(1, Math.ceil(dist / (D / 4)))
  const sx = (p.vx * dt) / steps
  const sy = (p.vy * dt) / steps
  for (let s = 0; s < steps; s++) {
    p.x += sx
    p.y += sy
    bounce(p)
    const hit = touching(cells, p.x, p.y)
    if (hit >= 0) {
      p.t += dt
      return { shot: p, hit }
    }
  }
  p.t += dt
  return { shot: p, hit: -1 }
}

/** The free cell a stuck bubble at (x, y) settles into: the closest empty cell, searching wider if needed. */
export function snapCell(cells, x, y) {
  let best = -1
  let bestD = Infinity
  for (const i of around(x, y, 2)) {
    if (cells[i] !== EMPTY) continue
    const d = (CELL_X[i] - x) ** 2 + (CELL_Y[i] - y) ** 2
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  if (best >= 0) return best
  for (let i = 0; i < N; i++) {
    if (cells[i] !== EMPTY) continue
    const d = (CELL_X[i] - x) ** 2 + (CELL_Y[i] - y) ** 2
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

/**
 * Dots for the aiming guide: the path from the ring until it touches a bubble, with up to `maxBounces` wall bounces.
 * @returns {{ x: number, y: number }[]}
 */
export function traceAim(cells, angle, maxBounces = 2, gap = 26) {
  const p = { x: CX, y: CY, vx: Math.cos(angle), vy: Math.sin(angle), bounces: 0 }
  const dots = []
  let travelled = 0
  let nextDot = RING_R + 12
  for (let guard = 0; guard < 2400; guard++) {
    p.x += p.vx * 5
    p.y += p.vy * 5
    travelled += 5
    if (bounce(p).bounces > maxBounces) break
    if (touching(cells, p.x, p.y) >= 0) break
    if (travelled >= nextDot) {
      dots.push({ x: p.x, y: p.y })
      nextDot += gap
    }
  }
  return dots
}
