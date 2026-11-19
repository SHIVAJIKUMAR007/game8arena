import { describe, expect, it } from 'vitest'
import {
  DECK_SIZE, canFollowOnFoundation, canStack, cardId, cardLabel, cardName, isCard, isRed, isRun, newDeck, rankOf, suitOf,
} from './cards'
import { dealFromSeed } from './deal'
import {
  REASONS, SCORE, applyMove, autoFinishMove, canAutoFinish, createGame, foundationFor, hasUsefulMove, isMoveShape,
  isMovableRun, isWon, listMoves, parsePile, reachableTalon, replay, runLength, smartMove, validateMove,
} from './rules'

/* ───── helpers: build positions from card labels like '10H', 'KS', 'AD' ───── */
const SUIT = { S: 0, H: 1, D: 2, C: 3 }
const RANK = { A: 1, J: 11, Q: 12, K: 13 }
const c = label => {
  const suit = SUIT[label.at(-1)]
  const r = label.slice(0, -1)
  return cardId(suit, RANK[r] ?? Number(r))
}
const cs = s => (s ? s.split(' ').map(c) : [])
/** Full suit from Ace up to (and including) `top` rank, as foundation cards. */
const suitUpTo = (suit, top) => Array.from({ length: top }, (_, i) => cardId(SUIT[suit], i + 1))

function position({ tableau = [], hidden, stock = '', waste = '', foundations = [], draw = 1, score = 0 } = {}) {
  const cols = Array.from({ length: 7 }, (_, i) => cs(tableau[i]))
  return {
    draw,
    stock: cs(stock),
    waste: cs(waste),
    foundations: Array.from({ length: 4 }, (_, i) => foundations[i] || []),
    tableau: cols,
    hidden: hidden || cols.map(() => 0),
    score,
    moves: 0,
    recycles: 0,
  }
}
const mv = (from, to, count = 1) => ({ type: 'move', from, to, count })

describe('card model', () => {
  it('has 52 distinct cards with ranks Ace to King in four suits', () => {
    const deck = newDeck()
    expect(deck).toHaveLength(DECK_SIZE)
    expect(new Set(deck.map(x => `${rankOf(x)}-${suitOf(x)}`)).size).toBe(52)
    expect(deck.every(isCard)).toBe(true)
    expect(isCard(52)).toBe(false)
    expect(isCard(-1)).toBe(false)
    expect(isCard(1.5)).toBe(false)
  })

  it('names cards and knows their colour', () => {
    expect(cardLabel(c('10H'))).toBe('10♥')
    expect(cardName(c('QS'))).toBe('Queen of spades')
    expect(isRed(c('5H'))).toBe(true)
    expect(isRed(c('5D'))).toBe(true)
    expect(isRed(c('5S'))).toBe(false)
    expect(isRed(c('5C'))).toBe(false)
  })

  it('stacks down by one in alternating colours only', () => {
    expect(canStack(c('6H'), c('7S'))).toBe(true)
    expect(canStack(c('6D'), c('7C'))).toBe(true)
    expect(canStack(c('6S'), c('7H'))).toBe(true)
    expect(canStack(c('6S'), c('7C'))).toBe(false) // same colour
    expect(canStack(c('6H'), c('7D'))).toBe(false) // same colour
    expect(canStack(c('5H'), c('7S'))).toBe(false) // two ranks apart
    expect(canStack(c('8H'), c('7S'))).toBe(false) // going up
    expect(canStack(c('KH'), c('AS'))).toBe(false) // no wrapping
  })

  it('builds foundations up by suit from the Ace', () => {
    expect(canFollowOnFoundation(c('AS'), undefined)).toBe(true)
    expect(canFollowOnFoundation(c('2S'), undefined)).toBe(false)
    expect(canFollowOnFoundation(c('2S'), c('AS'))).toBe(true)
    expect(canFollowOnFoundation(c('2C'), c('AS'))).toBe(false) // same colour, other suit
    expect(canFollowOnFoundation(c('2H'), c('AS'))).toBe(false)
    expect(canFollowOnFoundation(c('3S'), c('AS'))).toBe(false)
    expect(canFollowOnFoundation(c('KD'), c('QD'))).toBe(true)
  })

  it('recognises runs', () => {
    expect(isRun(cs('KS QH JC 10D'))).toBe(true)
    expect(isRun(cs('KS QS'))).toBe(false)
    expect(isRun(cs('KS JH'))).toBe(false)
    expect(isRun([])).toBe(true)
  })
})

describe('new game', () => {
  it('deals seven columns of 1..7 cards with only the top card face up, and 24 in the stock', () => {
    const g = createGame(dealFromSeed('rules:new'), 1)
    expect(g.tableau.map(col => col.length)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(g.hidden).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(g.stock).toHaveLength(24)
    expect(g.waste).toEqual([])
    expect(g.foundations).toEqual([[], [], [], []])
    expect(new Set([...g.tableau.flat(), ...g.stock]).size).toBe(52)
    expect(g.score).toBe(0)
    expect(g.moves).toBe(0)
  })

  it('only accepts draw 1 or 3', () => {
    expect(createGame(dealFromSeed('x'), 3).draw).toBe(3)
    expect(createGame(dealFromSeed('x'), 2).draw).toBe(1)
  })

  it('parses pile names', () => {
    expect(parsePile('t6')).toEqual({ kind: 'tableau', index: 6 })
    expect(parsePile('f3')).toEqual({ kind: 'foundation', index: 3 })
    expect(parsePile('f')).toEqual({ kind: 'foundation', index: -1 })
    expect(parsePile('t7')).toBeNull()
    expect(parsePile('f4')).toBeNull()
    expect(parsePile('x1')).toBeNull()
    expect(parsePile(undefined)).toBeNull()
  })
})

describe('tableau moves', () => {
  it('moves a card onto one rank higher of the other colour', () => {
    const g = position({ tableau: ['7S', '6H'] })
    const r = applyMove(g, mv('t1', 't0'))
    expect(r.ok).toBe(true)
    expect(r.state.tableau[0]).toEqual(cs('7S 6H'))
    expect(r.state.tableau[1]).toEqual([])
    expect(r.state.moves).toBe(1)
  })

  it('rejects same colour, wrong rank and going up, with a reason', () => {
    const g = position({ tableau: ['7S', '6C', '5H', '8H'] })
    expect(validateMove(g, mv('t1', 't0'))).toEqual({ ok: false, reason: REASONS.tableau })
    expect(validateMove(g, mv('t2', 't0'))).toEqual({ ok: false, reason: REASONS.tableau })
    expect(validateMove(g, mv('t3', 't0'))).toEqual({ ok: false, reason: REASONS.tableau })
    expect(applyMove(g, mv('t1', 't0')).state).toBe(g) // unchanged on a bad move
  })

  it('moves a whole run as one move', () => {
    const g = position({ tableau: ['10D', '9C 8H 7S 6D'] })
    const r = applyMove(g, mv('t1', 't0', 4))
    expect(r.ok).toBe(true)
    expect(r.state.tableau[0]).toEqual(cs('10D 9C 8H 7S 6D'))
    expect(r.state.tableau[1]).toEqual([])
    expect(r.state.moves).toBe(1)
  })

  it('moves exactly the cards asked for', () => {
    const g = position({ tableau: ['9S', '10D 9C 8H 7S'] })
    // 8H 7S onto 9S
    const r = applyMove(g, mv('t1', 't0', 2))
    expect(r.ok).toBe(true)
    expect(r.state.tableau[0]).toEqual(cs('9S 8H 7S'))
    expect(r.state.tableau[1]).toEqual(cs('10D 9C'))
  })

  it('rejects a broken run and face-down cards', () => {
    const g = position({ tableau: ['10D', '9C 8C 7H', 'QS JH 10S'], hidden: [0, 0, 1] })
    expect(validateMove(g, mv('t1', 't0', 3))).toEqual({ ok: false, reason: REASONS.notRun })
    expect(validateMove(g, mv('t2', 't0', 3))).toEqual({ ok: false, reason: REASONS.faceDown })
    expect(validateMove(g, mv('t1', 't0', 4))).toEqual({ ok: false, reason: REASONS.empty })
    expect(isMovableRun(g, 1, 0)).toBe(false) // 9C 8C: same colour
    expect(isMovableRun(g, 1, 1)).toBe(true) // 8C 7H
    expect(isMovableRun(g, 1, 2)).toBe(true)
    expect(isMovableRun(g, 2, 0)).toBe(false) // QS is face down
    expect(runLength(g, 1)).toBe(2)
    expect(runLength(g, 2)).toBe(2)
  })

  it('lets only a King (or a run led by a King) into an empty column', () => {
    const g = position({ tableau: ['', 'QH', '5S KD QC', '2S'], hidden: [0, 0, 1, 0] })
    expect(validateMove(g, mv('t1', 't0'))).toEqual({ ok: false, reason: REASONS.kingOnly })
    expect(validateMove(g, mv('t3', 't0'))).toEqual({ ok: false, reason: REASONS.kingOnly })
    const r = applyMove(g, mv('t2', 't0', 2))
    expect(r.ok).toBe(true)
    expect(r.state.tableau[0]).toEqual(cs('KD QC'))
  })

  it('turns over the card left on top and scores it', () => {
    const g = position({ tableau: ['8S', '4C 9D 7H'], hidden: [0, 2] })
    const r = applyMove(g, mv('t1', 't0'))
    expect(r.ok).toBe(true)
    expect(r.flipped).toBe(true)
    expect(r.state.hidden[1]).toBe(1) // 9D now face up, 4C still down
    expect(r.state.score).toBe(SCORE.flip)
    const r2 = applyMove(r.state, mv('t1', 't0')) // 9D can't go on 7H
    expect(r2.ok).toBe(false)
  })

  it('never turns over a card in an emptied column', () => {
    const g = position({ tableau: ['8S', '7H'] })
    const r = applyMove(g, mv('t1', 't0'))
    expect(r.flipped).toBe(false)
    expect(r.state.hidden[1]).toBe(0)
  })

  it('does not change the state it was given', () => {
    const g = position({ tableau: ['8S', '4C 7H'], hidden: [0, 1] })
    const copy = JSON.parse(JSON.stringify(g))
    applyMove(g, mv('t1', 't0'))
    expect(g).toEqual(copy)
  })
})

describe('waste and stock', () => {
  it('draws one card in draw-one mode, top of the stock first', () => {
    const g = position({ stock: '2C 3C 4C' })
    const r = applyMove(g, { type: 'draw' })
    expect(r.state.waste).toEqual(cs('4C'))
    expect(r.state.stock).toEqual(cs('2C 3C'))
    expect(r.state.moves).toBe(1)
  })

  it('draws three in draw-three mode, leaving the third card turned on top', () => {
    const g = position({ stock: '2C 3C 4C 5C 6C', draw: 3 })
    const r = applyMove(g, { type: 'draw' })
    expect(r.state.waste).toEqual(cs('6C 5C 4C'))
    expect(r.state.stock).toEqual(cs('2C 3C'))
    const r2 = applyMove(r.state, { type: 'draw' })
    expect(r2.state.waste).toEqual(cs('6C 5C 4C 3C 2C'))
    expect(r2.state.stock).toEqual([])
  })

  it('turns the waste back over when the stock is empty, in the original order, with a penalty', () => {
    const g = position({ stock: '2C 3C 4C', score: 150 })
    let s = g
    for (let i = 0; i < 3; i++) s = applyMove(s, { type: 'draw' }).state
    expect(s.stock).toEqual([])
    const r = applyMove(s, { type: 'draw' })
    expect(r.recycled).toBe(true)
    expect(r.state.stock).toEqual(g.stock)
    expect(r.state.waste).toEqual([])
    expect(r.state.recycles).toBe(1)
    expect(r.state.score).toBe(150 + SCORE.recycle[1])
  })

  it('never lets the score go below zero, and charges less to recycle in draw three', () => {
    const one = applyMove(position({ waste: '2C', score: 30 }), { type: 'draw' }).state
    expect(one.score).toBe(0)
    const three = applyMove(position({ waste: '2C', score: 30, draw: 3 }), { type: 'draw' }).state
    expect(three.score).toBe(30 + SCORE.recycle[3])
  })

  it('refuses to draw when stock and waste are both empty', () => {
    expect(validateMove(position(), { type: 'draw' })).toEqual({ ok: false, reason: REASONS.stockEmpty })
  })

  it('plays only the top waste card, to a column (+5) or a foundation (+10)', () => {
    const g = position({ tableau: ['8S'], waste: '5C 7H' })
    const r = applyMove(g, mv('waste', 't0'))
    expect(r.state.tableau[0]).toEqual(cs('8S 7H'))
    expect(r.state.waste).toEqual(cs('5C'))
    expect(r.state.score).toBe(SCORE.wasteToTableau)
    expect(validateMove(g, mv('waste', 't0', 2))).toEqual({ ok: false, reason: REASONS.oneCard })

    const f = applyMove(position({ waste: 'AH' }), mv('waste', 'f'))
    expect(f.state.foundations[0]).toEqual(cs('AH'))
    expect(f.state.score).toBe(SCORE.toFoundation)
  })

  it('never takes cards to the stock or the waste, or from the stock', () => {
    const g = position({ tableau: ['8S'], stock: '7H', waste: '5C' })
    expect(validateMove(g, mv('t0', 'stock'))).toEqual({ ok: false, reason: REASONS.toStock })
    expect(validateMove(g, mv('t0', 'waste'))).toEqual({ ok: false, reason: REASONS.toWaste })
    expect(validateMove(g, mv('stock', 't0'))).toEqual({ ok: false, reason: REASONS.faceDown })
    expect(validateMove(g, mv('t0', 't0'))).toEqual({ ok: false, reason: REASONS.sameCard })
    expect(validateMove(g, mv('t9', 't0')).ok).toBe(false)
    expect(validateMove(g, mv('t1', 't0'))).toEqual({ ok: false, reason: REASONS.empty })
  })

  it('lists the cards reachable by drawing', () => {
    expect(reachableTalon(position({ stock: '2C 3C 4C' }))).toEqual(cs('4C 3C 2C'))
    // draw three from 2C..8C: reachable on the first pass are the 3rd, 6th and the last card
    const r = reachableTalon(position({ stock: '2C 3C 4C 5C 6C 7C 8C', draw: 3 }))
    expect(r).toEqual(cs('6C 3C 2C'))
    expect(reachableTalon(position())).toEqual([])
  })
})

describe('foundations', () => {
  it('starts any empty foundation with an Ace, and nothing else', () => {
    const g = position({ tableau: ['AS', '2S', 'AH'], foundations: [[], cs('AD')] })
    expect(validateMove(g, mv('t1', 'f0'))).toEqual({ ok: false, reason: REASONS.foundationAce })
    const r = applyMove(g, mv('t0', 'f2'))
    expect(r.ok).toBe(true)
    expect(r.state.foundations[2]).toEqual(cs('AS'))
    expect(r.state.score).toBe(SCORE.toFoundation)
  })

  it('builds by suit, one rank at a time', () => {
    const g = position({ tableau: ['2H', '2D', '3S'], foundations: [cs('AS'), cs('AH')] })
    expect(validateMove(g, mv('t0', 'f0'))).toEqual({ ok: false, reason: REASONS.foundation })
    expect(validateMove(g, mv('t0', 'f1')).ok).toBe(true)
    expect(validateMove(g, mv('t1', 'f1'))).toEqual({ ok: false, reason: REASONS.foundation })
    expect(validateMove(g, mv('t2', 'f0'))).toEqual({ ok: false, reason: REASONS.foundation })
  })

  it('"f" picks the pile already holding the suit, or the first empty one for an Ace', () => {
    const g = position({ tableau: ['2H', 'AC', '3H'], foundations: [[], [], cs('AH')] })
    expect(foundationFor(g, c('2H'))).toBe(2)
    expect(foundationFor(g, c('AC'))).toBe(0)
    expect(foundationFor(g, c('3H'))).toBe(-1)
    expect(validateMove(g, mv('t0', 'f'))).toMatchObject({ ok: true, to: 'f2' })
    expect(validateMove(g, mv('t2', 'f'))).toEqual({ ok: false, reason: REASONS.foundation })
  })

  it('takes one card at a time', () => {
    const g = position({ tableau: ['3S 2H'], foundations: [cs('AH')] })
    expect(validateMove(g, mv('t0', 'f0', 2))).toEqual({ ok: false, reason: REASONS.oneCard })
  })

  it('lets a card come back down to a column, at a cost', () => {
    const g = position({ tableau: ['3S'], foundations: [cs('AH 2H')], score: 40 })
    const r = applyMove(g, mv('f0', 't0'))
    expect(r.ok).toBe(true)
    expect(r.state.tableau[0]).toEqual(cs('3S 2H'))
    expect(r.state.foundations[0]).toEqual(cs('AH'))
    expect(r.state.score).toBe(40 + SCORE.foundationToTableau)
    expect(validateMove(g, mv('f0', 't0', 2))).toEqual({ ok: false, reason: REASONS.oneCard })
  })

  it('completes a whole suit from Ace to King', () => {
    let g = position({ tableau: ['KS QS JS 10S 9S 8S 7S 6S 5S 4S 3S 2S AS'] })
    g = { ...g, hidden: [0, 0, 0, 0, 0, 0, 0] }
    for (let i = 0; i < 13; i++) {
      const r = applyMove(g, mv('t0', 'f'))
      expect(r.ok).toBe(true)
      g = r.state
    }
    expect(g.foundations[0]).toEqual(suitUpTo('S', 13))
    expect(g.tableau[0]).toEqual([])
    expect(g.score).toBe(13 * SCORE.toFoundation)
  })

  it('detects the win when the last card goes up, and refuses moves after it', () => {
    const g = position({ tableau: ['KC'], foundations: [suitUpTo('S', 13), suitUpTo('H', 13), suitUpTo('D', 13), suitUpTo('C', 12)] })
    expect(isWon(g)).toBe(false)
    const r = applyMove(g, mv('t0', 'f'))
    expect(r.ok).toBe(true)
    expect(isWon(r.state)).toBe(true)
    expect(validateMove(r.state, { type: 'draw' })).toEqual({ ok: false, reason: REASONS.won })
    expect(hasUsefulMove(r.state)).toBe(false)
    expect(listMoves(r.state)).toEqual([])
  })
})

describe('finishing, smart moves and dead ends', () => {
  it('auto-finishes once every card is face up and the stock is used', () => {
    let g = position({
      tableau: ['KS QH', 'KH QS', 'KD QC', 'KC QD'],
      foundations: [suitUpTo('S', 11), suitUpTo('H', 11), suitUpTo('D', 11), suitUpTo('C', 11)],
    })
    expect(canAutoFinish(g)).toBe(true)
    let guard = 0
    while (!isWon(g) && guard++ < 20) {
      const m = autoFinishMove(g)
      expect(m).not.toBeNull()
      g = applyMove(g, m).state
    }
    expect(isWon(g)).toBe(true)
    expect(canAutoFinish(g)).toBe(false)
  })

  it('does not auto-finish while cards are face down or in the stock', () => {
    expect(canAutoFinish(position({ tableau: ['KS QH'], hidden: [1, 0, 0, 0, 0, 0, 0] }))).toBe(false)
    expect(canAutoFinish(position({ tableau: ['KS'], stock: 'QH' }))).toBe(false)
  })

  it('smart move prefers a foundation, then a column, then an empty column', () => {
    const g = position({ tableau: ['AS', '7H', '8C', '', 'KD 6S'], hidden: [0, 0, 0, 0, 1] })
    expect(smartMove(g, 't0', 1)).toEqual(mv('t0', 'f'))
    expect(smartMove(g, 't1', 1)).toEqual(mv('t1', 't2'))
    const k = position({ tableau: ['QS KH', '', 'JD'], hidden: [1, 0, 0] })
    expect(smartMove(k, 't0', 1)).toEqual(mv('t0', 't1'))
    // a King already at the bottom of its column has nowhere useful to go
    expect(smartMove(position({ tableau: ['KH', ''] }), 't0', 1)).toBeNull()
    expect(smartMove(position({ tableau: ['5H', '9C'] }), 't0', 1)).toBeNull()
  })

  it('notices when no move makes progress', () => {
    // 5H can't go anywhere, the stock card (9C) fits nowhere, nothing is face down
    const stuck = position({ tableau: ['5H', '9D'], stock: '9C', foundations: [cs('AS')] })
    expect(hasUsefulMove(stuck)).toBe(false)
    // …but a face-down card that a run can be moved off counts
    const flip = position({ tableau: ['3C 6H', '7S'], hidden: [1, 0] })
    expect(hasUsefulMove(flip)).toBe(true)
    // …and so does a stock card that fits a column
    expect(hasUsefulMove(position({ tableau: ['10H'], stock: '2D 9C' }))).toBe(true)
    // …and a card for a foundation
    expect(hasUsefulMove(position({ tableau: ['2S'], foundations: [cs('AS')] }))).toBe(true)
  })

  it('lists only legal moves, and includes drawing', () => {
    const g = createGame(dealFromSeed('rules:list'), 1)
    const moves = listMoves(g)
    expect(moves[0]).toEqual({ type: 'draw' })
    for (const m of moves) expect(validateMove(g, m).ok).toBe(true)
  })
})

describe('replay', () => {
  it('rebuilds a game from its moves, with the history for undo', () => {
    const deal = dealFromSeed('rules:replay')
    let g = createGame(deal, 1)
    const moves = []
    for (let i = 0; i < 30; i++) {
      const m = listMoves(g).find(x => x.type === 'move' && x.to === 'f') || { type: 'draw' }
      const r = applyMove(g, m)
      if (!r.ok) break
      moves.push(m)
      g = r.state
    }
    const back = replay(deal, 1, moves)
    expect(back.state).toEqual(g)
    expect(back.history).toHaveLength(moves.length)
    expect(back.history[0]).toEqual(createGame(deal, 1))
  })

  it('rejects a move list with an illegal move', () => {
    expect(replay(dealFromSeed('rules:bad'), 1, [mv('t0', 't0')])).toBeNull()
    expect(replay(dealFromSeed('rules:bad'), 1, [mv('waste', 't0')])).toBeNull()
  })

  it('checks the shape of saved moves', () => {
    expect(isMoveShape({ type: 'draw' })).toBe(true)
    expect(isMoveShape(mv('t1', 'f', 1))).toBe(true)
    expect(isMoveShape({ type: 'move', from: 'waste', to: 't3' })).toBe(true)
    expect(isMoveShape({ type: 'move', from: 't9', to: 't3' })).toBe(false)
    expect(isMoveShape({ type: 'move', from: 't1', to: 't3', count: 0 })).toBe(false)
    expect(isMoveShape({ type: 'move', from: 't1', to: 't3', count: 14 })).toBe(false)
    expect(isMoveShape({ type: 'jump' })).toBe(false)
    expect(isMoveShape(null)).toBe(false)
    expect(isMoveShape('draw')).toBe(false)
  })
})
