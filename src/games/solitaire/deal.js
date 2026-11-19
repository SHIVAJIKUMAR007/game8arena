// Seeded dealing. A deal is a pure function of its seed: the same seed always gives the same cards in the same places.
import { createRng } from '../../platform/rng'
import { DECK_SIZE, isCard, newDeck } from './cards'

export const COLUMNS = 7
/** Cards dealt to the tableau: 1 + 2 + … + 7. The other 24 form the stock. */
export const TABLEAU_CARDS = (COLUMNS * (COLUMNS + 1)) / 2

/**
 * Shuffles a deck with the seed and deals it the standard way: column i gets i + 1 cards, only the top one face up.
 * @param {string|number} seed
 * @returns {{tableau:number[][], stock:number[]}}  columns bottom to top; stock with its top card last
 */
export function dealFromSeed(seed) {
  return dealFromOrder(createRng(`${seed}`).shuffle(newDeck()))
}

/**
 * Deals an already-shuffled deck, in the usual order (one card to each column left to right, then again from the
 * second column…). The first card of `order` is dealt first; the last 24 cards become the stock, the very last one on
 * top.
 */
export function dealFromOrder(order) {
  const tableau = Array.from({ length: COLUMNS }, () => [])
  let k = 0
  for (let row = 0; row < COLUMNS; row++) {
    for (let col = row; col < COLUMNS; col++) tableau[col].push(order[k++])
  }
  return { tableau, stock: order.slice(k) }
}

/** True when a deal holds every card exactly once in the standard shape. */
export function isValidDeal(deal) {
  if (!deal || !Array.isArray(deal.tableau) || !Array.isArray(deal.stock) || deal.tableau.length !== COLUMNS) return false
  if (deal.tableau.some((col, i) => !Array.isArray(col) || col.length !== i + 1)) return false
  if (deal.stock.length !== DECK_SIZE - TABLEAU_CARDS) return false
  const all = [...deal.tableau.flat(), ...deal.stock]
  return all.every(isCard) && new Set(all).size === DECK_SIZE
}
