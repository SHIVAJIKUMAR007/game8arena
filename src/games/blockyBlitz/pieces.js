// Piece catalogue for Blocky Blitz. Every piece has one fixed orientation (pieces are never rotated),
// so each orientation of a shape is its own entry. Pure data, no DOM.

/** Single solid colours a piece can take. */
export const COLORS = ['#ff3fa4', '#1e6bff', '#ff9a00', '#19d9f5', '#a53df0', '#3ddc5a', '#ffd31a']

// [id, rows ('#' = filled), weight]. Smaller, easier pieces carry the higher weights.
const DEFS = [
  ['dot', ['#'], 3],
  ['h2', ['##'], 5],
  ['v2', ['#', '#'], 5],
  ['h3', ['###'], 4],
  ['v3', ['#', '#', '#'], 4],
  ['h4', ['####'], 2],
  ['v4', ['#', '#', '#', '#'], 2],
  ['h5', ['#####'], 1],
  ['v5', ['#', '#', '#', '#', '#'], 1],
  ['sq2', ['##', '##'], 4],
  ['sq3', ['###', '###', '###'], 1],
  ['r23', ['###', '###'], 1.5], // 2 rows x 3 columns
  ['r32', ['##', '##', '##'], 1.5], // 3 rows x 2 columns
  // L-trominoes, all four orientations
  ['l3a', ['#.', '##'], 4],
  ['l3b', ['.#', '##'], 4],
  ['l3c', ['##', '#.'], 4],
  ['l3d', ['##', '.#'], 4],
  // L-tetrominoes: four orientations of L and four of its mirror, J
  ['L1', ['#.', '#.', '##'], 2],
  ['L2', ['###', '#..'], 2],
  ['L3', ['##', '.#', '.#'], 2],
  ['L4', ['..#', '###'], 2],
  ['J1', ['.#', '.#', '##'], 2],
  ['J2', ['#..', '###'], 2],
  ['J3', ['##', '#.', '#.'], 2],
  ['J4', ['###', '..#'], 2],
  // T-tetrominoes
  ['T1', ['###', '.#.'], 2],
  ['T2', ['.#.', '###'], 2],
  ['T3', ['#.', '##', '#.'], 2],
  ['T4', ['.#', '##', '.#'], 2],
  // S and Z, horizontal and vertical
  ['sH', ['.##', '##.'], 1.5],
  ['zH', ['##.', '.##'], 1.5],
  ['sV', ['#.', '##', '.#'], 1.5],
  ['zV', ['.#', '##', '#.'], 1.5],
  // Big 3x3 corner L (5 cells), four orientations
  ['c5a', ['#..', '#..', '###'], 0.8],
  ['c5b', ['###', '#..', '#..'], 0.8],
  ['c5c', ['###', '..#', '..#'], 0.8],
  ['c5d', ['..#', '..#', '###'], 0.8],
]

function toCells(rows) {
  const cells = []
  rows.forEach((row, r) => [...row].forEach((ch, c) => ch === '#' && cells.push([r, c])))
  return cells
}

/** @typedef {{ id: string, cells: number[][], w: number, h: number, weight: number }} Shape */

/** @type {Shape[]} */
export const SHAPES = DEFS.map(([id, rows, weight]) => ({
  id,
  cells: toCells(rows),
  w: Math.max(...rows.map(r => r.length)),
  h: rows.length,
  weight,
}))

export const SHAPE_BY_ID = Object.fromEntries(SHAPES.map(s => [s.id, s]))

/** Small pieces used when the board is so full that bigger ones cannot be offered fairly. */
export const SMALL_IDS = ['dot', 'h2', 'v2', 'h3', 'v3', 'l3a', 'l3b', 'l3c', 'l3d', 'sq2']

/**
 * @typedef {{ id: string, cells: number[][], w: number, h: number, color: string }} Piece
 * A piece in the tray or hold slot: a shape plus its colour.
 */

/** @returns {Piece} */
export function makePiece(shapeId, color) {
  const s = SHAPE_BY_ID[shapeId]
  return { id: s.id, cells: s.cells, w: s.w, h: s.h, color }
}
