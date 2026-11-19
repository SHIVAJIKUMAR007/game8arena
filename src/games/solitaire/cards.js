// Card model. A card is an integer from 0 to 51: suit * 13 + (rank - 1).
// Integers keep game state small, JSON-safe and fast to copy, which matters for the solver.
//   suits: 0 spades ♠, 1 hearts ♥, 2 diamonds ♦, 3 clubs ♣  (hearts and diamonds are red)
//   ranks: 1 Ace … 13 King

export const SUIT_COUNT = 4
export const RANKS = 13
export const DECK_SIZE = 52

export const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣']
export const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs']
export const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const RANK_NAMES = ['', 'Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King']

export const ACE = 1
export const KING = 13

export const cardId = (suit, rank) => suit * RANKS + rank - 1
export const suitOf = card => Math.floor(card / RANKS)
export const rankOf = card => (card % RANKS) + 1
export const isRed = card => {
  const s = suitOf(card)
  return s === 1 || s === 2
}
export const isCard = card => Number.isInteger(card) && card >= 0 && card < DECK_SIZE

/** Short label, e.g. "10♥". */
export const cardLabel = card => `${RANK_LABELS[rankOf(card)]}${SUIT_SYMBOLS[suitOf(card)]}`
/** Spoken name, e.g. "Ten of hearts". */
export const cardName = card => `${RANK_NAMES[rankOf(card)]} of ${SUIT_NAMES[suitOf(card)]}`

/** A fresh, ordered deck: every card exactly once. */
export const newDeck = () => Array.from({ length: DECK_SIZE }, (_, i) => i)

/** Tableau rule: `card` may go on `onto` when it is one rank lower and the other colour. */
export const canStack = (card, onto) => rankOf(onto) === rankOf(card) + 1 && isRed(card) !== isRed(onto)

/** Foundation rule: `card` may follow `top` (or start an empty pile when `top` is undefined). */
export const canFollowOnFoundation = (card, top) =>
  top === undefined ? rankOf(card) === ACE : suitOf(card) === suitOf(top) && rankOf(card) === rankOf(top) + 1

/** True when `cards` (bottom to top) is a valid tableau run: each card one lower and the other colour. */
export function isRun(cards) {
  for (let i = 1; i < cards.length; i++) if (!canStack(cards[i], cards[i - 1])) return false
  return true
}
