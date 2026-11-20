// Hex-packed grid maths for Bubble Surge. No DOM, no canvas: everything here is plain numbers.
//
// Rows alternate: even rows start at the left edge, odd rows are shifted right by half a bubble.
// Cells are stored in one flat array, index = row * COLS + col. All lengths are in "logical pixels"; the canvas
// scales the whole 1586 x 998 playfield to whatever size the screen allows.

export const D = 52 // bubble diameter
export const R = D / 2 // bubble radius
export const COLS = 30
export const ROWS = 22
export const N = COLS * ROWS
export const ROW_H = (D * Math.sqrt(3)) / 2 // vertical distance between rows

export const W = COLS * D + D / 2
export const H = Math.ceil(ROW_H * (ROWS - 1) + D)

// The shooter sits in the middle of the field.
export const CX = W / 2
export const CY = H / 2
export const RING_R = 50 // radius of the purple ring around the shooter

export const index = (r, c) => r * COLS + c
export const rowOf = i => Math.floor(i / COLS)
export const colOf = i => i % COLS
export const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS

/** Pixel centre of a cell. */
export const cellX = (r, c) => c * D + R + (r & 1 ? R : 0)
export const cellY = r => r * ROW_H + R

/**
 * The (up to six) cells touching cell (r, c). Even rows touch columns c-1 and c in the rows above and below;
 * odd rows, shifted right by half a bubble, touch columns c and c+1.
 */
export function neighborsOf(r, c) {
  const out = []
  const push = (rr, cc) => inBounds(rr, cc) && out.push(index(rr, cc))
  push(r, c - 1)
  push(r, c + 1)
  const [a, b] = r & 1 ? [c, c + 1] : [c - 1, c]
  push(r - 1, a)
  push(r - 1, b)
  push(r + 1, a)
  push(r + 1, b)
  return out
}

/** Neighbour lists for every cell, built once. */
export const NEIGHBORS = Array.from({ length: N }, (_, i) => neighborsOf(rowOf(i), colOf(i)))

/** Pixel centres for every cell, built once. */
export const CELL_X = Float32Array.from({ length: N }, (_, i) => cellX(rowOf(i), colOf(i)))
export const CELL_Y = Float32Array.from({ length: N }, (_, i) => cellY(rowOf(i)))

/** Distance from every cell centre to the shooter. */
export const CELL_DIST = Float32Array.from({ length: N }, (_, i) => Math.hypot(CELL_X[i] - CX, CELL_Y[i] - CY))

/** The cell whose centre is closest to a pixel position (always a valid cell, even for points outside the field). */
export function nearestCell(x, y) {
  const r0 = Math.round((y - R) / ROW_H)
  let best = -1
  let bestD = Infinity
  for (let r = Math.max(0, r0 - 1); r <= Math.min(ROWS - 1, r0 + 1); r++) {
    const c0 = Math.round((x - R - (r & 1 ? R : 0)) / D)
    for (let c = Math.max(0, c0 - 1); c <= Math.min(COLS - 1, c0 + 1); c++) {
      const d = (x - cellX(r, c)) ** 2 + (y - cellY(r)) ** 2
      if (d < bestD) {
        bestD = d
        best = index(r, c)
      }
    }
  }
  if (best >= 0) return best
  return index(Math.max(0, Math.min(ROWS - 1, r0)), Math.max(0, Math.min(COLS - 1, Math.round((x - R) / D))))
}

/** Cells on the edge of the field. Bubbles joined to one of these never fall. */
export const isAnchor = i => {
  const r = rowOf(i)
  const c = colOf(i)
  return r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1
}
