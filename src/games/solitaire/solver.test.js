import { describe, expect, it } from 'vitest'
import { cardId, newDeck } from './cards'
import { TABLEAU_CARDS, dealFromOrder, dealFromSeed, isValidDeal } from './deal'
import { applyMove, createGame, isWon, replay } from './rules'
import { solve } from './solver'

describe('seeded deals', () => {
  it('are the same for the same seed and different for different seeds', () => {
    expect(dealFromSeed('deal:a')).toEqual(dealFromSeed('deal:a'))
    expect(dealFromSeed('deal:a')).not.toEqual(dealFromSeed('deal:b'))
    expect(dealFromSeed(42)).toEqual(dealFromSeed(42))
  })

  it('hold every card once in the standard shape', () => {
    for (let s = 0; s < 20; s++) expect(isValidDeal(dealFromSeed(`deal:${s}`))).toBe(true)
    const d = dealFromSeed('deal:shape')
    expect(d.tableau.map(c => c.length)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(d.stock).toHaveLength(52 - TABLEAU_CARDS)
  })

  it('deal in rows, like real cards', () => {
    const d = dealFromOrder(newDeck())
    expect(d.tableau[0]).toEqual([0])
    expect(d.tableau[1]).toEqual([1, 7])
    expect(d.tableau[6]).toEqual([6, 12, 17, 21, 24, 26, 27])
    expect(d.stock[0]).toBe(28)
  })

  it('spot broken deals', () => {
    const d = dealFromSeed('deal:broken')
    expect(isValidDeal(null)).toBe(false)
    expect(isValidDeal({ ...d, stock: d.stock.slice(1) })).toBe(false)
    expect(isValidDeal({ ...d, stock: [...d.stock.slice(1), d.stock[1]] })).toBe(false)
    expect(isValidDeal({ ...d, tableau: d.tableau.slice(1) })).toBe(false)
  })
})

/** A deal that wins by just moving every card up: each column is one suit in descending order. */
function trivialDeal() {
  // Columns: 7 → the bottom of the deck, then the stock in an order that plays straight up.
  // Built backwards: stock cards come out Ace first and go up at once.
  const order = []
  for (let s = 0; s < 4; s++) for (let r = 13; r >= 1; r--) order.push(cardId(s, r))
  return { tableau: Array.from({ length: 7 }, () => []), stock: order }
}

describe('solver', { timeout: 30000 }, () => {
  it('wins a stock-only deal by drawing and playing up', () => {
    const deal = trivialDeal()
    const game = { ...createGame({ tableau: deal.tableau, stock: deal.stock }, 1), hidden: [0, 0, 0, 0, 0, 0, 0] }
    const r = solve(game)
    expect(r.status).toBe('solved')
    let g = game
    for (const m of r.moves) g = applyMove(g, m).state
    expect(isWon(g)).toBe(true)
  })

  it('finds winning lines that really win, in both draw modes', () => {
    let solved = 0
    for (const draw of [1, 3]) {
      for (let s = 0; s < 8; s++) {
        const deal = dealFromSeed(`solver:${s}`)
        const r = solve(createGame(deal, draw), { maxNodes: 5000 })
        expect(['solved', 'unsolved', 'unknown']).toContain(r.status)
        if (r.status !== 'solved') continue
        solved++
        const played = replay(deal, draw, r.moves)
        expect(played, `solution for solver:${s} draw ${draw} replays`).not.toBeNull()
        expect(isWon(played.state)).toBe(true)
      }
    }
    expect(solved).toBeGreaterThan(8) // most random deals can be won
  })

  it('is deterministic', () => {
    const g = createGame(dealFromSeed('solver:det'), 3)
    expect(solve(g, { maxNodes: 3000 })).toEqual(solve(g, { maxNodes: 3000 }))
  })

  it('solves from the middle of a game, with foundations already started', () => {
    const deal = dealFromSeed('solver:mid')
    const full = solve(createGame(deal, 1), { maxNodes: 20000 })
    expect(full.status).toBe('solved')
    const half = replay(deal, 1, full.moves.slice(0, Math.floor(full.moves.length / 2)))
    const rest = solve(half.state, { maxNodes: 20000 })
    expect(rest.status).toBe('solved')
    let g = half.state
    for (const m of rest.moves) g = applyMove(g, m).state
    expect(isWon(g)).toBe(true)
  })

  it('reports a dead position as unsolved, and stops at its budget', () => {
    // Two Kings over the Aces they cover, nowhere to go and nothing in the stock.
    const dead = {
      draw: 1, stock: [], waste: [], foundations: [[], [], [], []],
      tableau: [[cardId(0, 1), cardId(1, 13)], [cardId(1, 1), cardId(0, 13)], [], [], [], [], []],
      hidden: [1, 1, 0, 0, 0, 0, 0], score: 0, moves: 0, recycles: 0,
    }
    // (the empty columns let a King move, which uncovers an Ace: not dead) — fill them so nothing can move
    const blocked = { ...dead, tableau: [[cardId(0, 1), cardId(1, 13)], [cardId(1, 1), cardId(0, 13)], [cardId(2, 5)], [cardId(3, 5)], [cardId(2, 9)], [cardId(3, 9)], [cardId(2, 3)]] }
    const r = solve(blocked)
    expect(r.status).toBe('unsolved')
    expect(r.moves).toEqual([])
    const capped = solve(createGame(dealFromSeed('solver:budget'), 3), { maxNodes: 1 })
    expect(capped.nodes).toBeLessThanOrEqual(1)
    expect(['unknown', 'solved']).toContain(capped.status)
  })
})
