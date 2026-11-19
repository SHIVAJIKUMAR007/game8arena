// Table geometry: card size, where every pile sits, how far column cards fan out, and drop-target hit testing.
// Pure functions of the table size and the game state, so the board, drag-and-drop and tests all agree on positions
// without measuring the DOM.
import { COLUMNS } from './deal'

export const CARD_RATIO = 1.4
const MAX_CARD_W = 112
const MIN_CARD_W = 30

/**
 * @param {number} width   table width in px
 * @param {number} height  table height in px
 * @returns {{cw:number, ch:number, gap:number, pad:number, rowY:number, tableauY:number, colX:(i:number)=>number,
 *   width:number, height:number}}
 */
export function tableMetrics(width, height) {
  const w = Math.max(200, width || 0)
  const h = Math.max(200, height || 0)
  const pad = Math.round(Math.min(14, Math.max(4, w * 0.015)))
  const gap = Math.round(Math.min(14, Math.max(3, w * 0.012)))
  const byWidth = (w - 2 * pad - (COLUMNS - 1) * gap) / COLUMNS
  // Leave room for the top row plus a few fanned cards below it.
  const byHeight = (h - 2 * pad - gap) / (CARD_RATIO * 3.4)
  const cw = Math.floor(Math.max(MIN_CARD_W, Math.min(MAX_CARD_W, byWidth, byHeight)))
  const ch = Math.round(cw * CARD_RATIO)
  // Centre the seven columns when the cards are capped below the available width.
  const used = COLUMNS * cw + (COLUMNS - 1) * gap
  const left = Math.max(pad, Math.round((w - used) / 2))
  const rowY = pad
  const tableauY = pad + ch + Math.round(gap * 1.6)
  return { cw, ch, gap, pad, rowY, tableauY, width: w, height: h, colX: i => left + i * (cw + gap) }
}

/**
 * Vertical offset of every card in every column. Face-down cards overlap more than face-up ones; long columns are
 * squeezed so they fit above the bottom of the table.
 * @returns {number[][]} offsets[col][k] = y of card k (from the column's top)
 */
export function columnOffsets(m, tableau, hidden) {
  const room = m.height - m.tableauY - m.pad - m.ch
  const down = m.ch * 0.11
  const up = m.ch * 0.27
  return tableau.map((col, i) => {
    const steps = []
    for (let k = 1; k < col.length; k++) steps.push(k - 1 < hidden[i] ? down : up)
    const total = steps.reduce((t, s) => t + s, 0)
    const squeeze = total > room && total > 0 ? Math.max(0.3, room / total) : 1
    const ys = [0]
    for (const s of steps) ys.push(ys[ys.length - 1] + Math.max(s === down ? 3 : 12, s * squeeze))
    return ys.map(Math.round)
  })
}

/** How far each visible waste card is shifted right: up to 3 fanned cards in draw-three, the top one in draw-one. */
export const wasteFan = m => Math.round(m.cw * 0.24)
export const visibleWaste = (waste, draw) => waste.slice(-(draw === 3 ? 3 : 1))

/** Position of a pile's slot (the empty outline) by pile id. */
export function pileSlot(m, id) {
  if (id === 'stock') return { x: m.colX(0), y: m.rowY }
  if (id === 'waste') return { x: m.colX(1), y: m.rowY }
  if (id[0] === 'f') return { x: m.colX(3 + Number(id[1])), y: m.rowY }
  return { x: m.colX(Number(id[1])), y: m.tableauY }
}

/**
 * Rectangles that accept a drop: the four foundations and the seven columns (a column reaches from its slot down to
 * the bottom of the table, so dropping anywhere below its last card works).
 */
export function dropRects(m) {
  const rects = []
  for (let f = 0; f < 4; f++) {
    const { x, y } = pileSlot(m, `f${f}`)
    rects.push({ id: `f${f}`, left: x, top: y, right: x + m.cw, bottom: y + m.ch })
  }
  for (let i = 0; i < COLUMNS; i++) {
    const x = m.colX(i)
    rects.push({ id: `t${i}`, left: x - m.gap / 2, top: m.tableauY, right: x + m.cw + m.gap / 2, bottom: m.height })
  }
  return rects
}

/**
 * The pile a dragged card is dropped on: the drop rectangle it overlaps most, or null if it overlaps none.
 * @param {{left,top,right,bottom,id}[]} rects
 * @param {{left,top,right,bottom}} card  where the dragged (lead) card is now
 */
export function dropTarget(rects, card) {
  let best = null
  let bestArea = 0
  for (const r of rects) {
    const w = Math.min(r.right, card.right) - Math.max(r.left, card.left)
    const h = Math.min(r.bottom, card.bottom) - Math.max(r.top, card.top)
    const area = w > 0 && h > 0 ? w * h : 0
    if (area > bestArea) {
      bestArea = area
      best = r.id
    }
  }
  return best
}
