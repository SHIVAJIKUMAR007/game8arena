import { describe, expect, it } from 'vitest'
import { createRng } from '../../platform/rng'
import { COLORS, SHAPES, SHAPE_BY_ID, makePiece } from './pieces'
import {
  PERFECT_BONUS,
  SIZE,
  START_REROLLS,
  canPlace,
  clearLines,
  emptyBoard,
  findFullLines,
  generatePieces,
  hasAnyMove,
  holdFromTray,
  isBoardEmpty,
  levelProgress,
  newGame,
  placeCells,
  playPiece,
  rerollTray,
  sanitizeState,
  scoreMove,
  serializeState,
  targetForLevel,
} from './logic'

const [PINK, BLUE] = COLORS
const piece = (id, color = PINK) => makePiece(id, color)

/** Board with the listed cells filled. */
function boardWith(cells, color = BLUE) {
  const b = emptyBoard()
  for (const [r, c] of cells) b[r][c] = color
  return b
}
const rowCells = (r, skip = []) => Array.from({ length: SIZE }, (_, c) => [r, c]).filter(([, c]) => !skip.includes(c))
const colCells = (c, skip = []) => Array.from({ length: SIZE }, (_, r) => [r, c]).filter(([r]) => !skip.includes(r))
const stateWith = (over = {}) => ({
  board: emptyBoard(),
  tray: [piece('dot'), piece('h2'), piece('v2')],
  hold: null,
  score: 0,
  level: 1,
  streak: 0,
  rerolls: START_REROLLS,
  over: false,
  ...over,
})
const FULL_ROW_EXCEPT = r => rowCells(r, [0])

describe('piece catalogue', () => {
  it('has every required family of shapes, with no duplicate orientations', () => {
    const key = s => s.cells.map(c => c.join()).sort().join('|')
    expect(new Set(SHAPES.map(key)).size).toBe(SHAPES.length)
    const cellCounts = SHAPES.map(s => s.cells.length)
    expect(Math.min(...cellCounts)).toBe(1)
    expect(Math.max(...cellCounts)).toBe(9)
    // 4 L-trominoes, 8 L/J tetrominoes, 4 T, 4 S/Z, 4 corner Ls
    expect(SHAPES.filter(s => s.id.startsWith('l3')).length).toBe(4)
    expect(SHAPES.filter(s => /^[LJ]\d$/.test(s.id)).length).toBe(8)
    expect(SHAPES.filter(s => /^T\d$/.test(s.id)).length).toBe(4)
    expect(SHAPES.filter(s => /^[sz][HV]$/.test(s.id)).length).toBe(4)
    expect(SHAPES.filter(s => s.id.startsWith('c5')).length).toBe(4)
    for (const id of ['h5', 'v5', 'sq3', 'r23', 'r32']) expect(SHAPE_BY_ID[id]).toBeTruthy()
  })

  it('weights small pieces above big ones', () => {
    expect(SHAPE_BY_ID.h2.weight).toBeGreaterThan(SHAPE_BY_ID.h5.weight)
    expect(SHAPE_BY_ID.sq2.weight).toBeGreaterThan(SHAPE_BY_ID.sq3.weight)
  })
})

describe('placement', () => {
  it('accepts a legal placement', () => {
    expect(canPlace(emptyBoard(), piece('sq2').cells, 3, 3)).toBe(true)
  })

  it('rejects placements outside the bounds', () => {
    const b = emptyBoard()
    const sq = piece('sq2').cells
    expect(canPlace(b, sq, 7, 7)).toBe(false)
    expect(canPlace(b, sq, -1, 0)).toBe(false)
    expect(canPlace(b, sq, 0, -1)).toBe(false)
    expect(canPlace(b, piece('h5').cells, 0, 4)).toBe(false)
    expect(canPlace(b, piece('h5').cells, 0, 3)).toBe(true)
    expect(canPlace(b, sq, 0.5, 0)).toBe(false)
    expect(() => placeCells(b, sq, 7, 7, PINK)).toThrow()
  })

  it('rejects overlapping an occupied cell', () => {
    const b = boardWith([[2, 2]])
    expect(canPlace(b, piece('h2').cells, 2, 1)).toBe(false)
    expect(canPlace(b, piece('h2').cells, 2, 3)).toBe(true)
  })

  it('does not mutate the board it is given', () => {
    const b = emptyBoard()
    placeCells(b, piece('dot').cells, 0, 0, PINK)
    expect(isBoardEmpty(b)).toBe(true)
  })
})

describe('line clearing', () => {
  it('finds full rows and columns', () => {
    const b = boardWith([...rowCells(2), ...colCells(5)])
    expect(findFullLines(b)).toEqual({ rows: [2], cols: [5] })
  })

  it('clears a row and a column at the same time from one snapshot', () => {
    // row 0 and column 0 are both full except the shared corner (0,0); one dot completes both.
    const b = boardWith([...rowCells(0, [0]), ...colCells(0, [0]), [4, 4]])
    const placed = placeCells(b, piece('dot').cells, 0, 0, PINK)
    const lines = findFullLines(placed)
    expect(lines).toEqual({ rows: [0], cols: [0] })
    const { board, cleared } = clearLines(placed, lines)
    expect(cleared).toHaveLength(15) // 8 + 8 - the shared corner counted once
    expect(board[4][4]).toBe(BLUE) // unrelated cell survives
    expect(board.flat().filter(Boolean)).toHaveLength(1)
  })

  it('scores a simultaneous row and column clear as 2 lines', () => {
    const b = boardWith([...rowCells(0, [0]), ...colCells(0, [0]), [4, 4]])
    const s = stateWith({ board: b, tray: [piece('dot'), piece('h2'), piece('v2')] })
    const { move, state } = playPiece(s, { type: 'tray', index: 0 }, 0, 0, createRng(1))
    expect(move.lineCount).toBe(2)
    expect(move.points.bonus).toBe(40)
    expect(move.points.total).toBe(1 + 40)
    expect(state.score).toBe(41)
  })
})

describe('scoring', () => {
  it('gives 1 point per cell and 10 * lines^2 for clears', () => {
    expect(scoreMove({ cellCount: 4, lines: 0, streak: 0, perfect: false }).total).toBe(4)
    expect(scoreMove({ cellCount: 1, lines: 1, streak: 0, perfect: false }).bonus).toBe(10)
    expect(scoreMove({ cellCount: 1, lines: 2, streak: 0, perfect: false }).bonus).toBe(40)
    expect(scoreMove({ cellCount: 1, lines: 3, streak: 0, perfect: false }).bonus).toBe(90)
  })

  it('multiplies clear bonuses by 1 + 0.5 * streak, and resets after a move with no clear', () => {
    expect(scoreMove({ cellCount: 1, lines: 1, streak: 1, perfect: false }).bonus).toBe(15)
    expect(scoreMove({ cellCount: 1, lines: 1, streak: 2, perfect: false }).bonus).toBe(20)
    expect(scoreMove({ cellCount: 1, lines: 1, streak: 2, perfect: false }).nextStreak).toBe(3)
    expect(scoreMove({ cellCount: 1, lines: 0, streak: 5, perfect: false }).nextStreak).toBe(0)
    expect(scoreMove({ cellCount: 1, lines: 0, streak: 5, perfect: false }).bonus).toBe(0)
  })

  it('tracks the streak through playPiece', () => {
    const b = boardWith([...FULL_ROW_EXCEPT(0), ...FULL_ROW_EXCEPT(1)])
    let s = stateWith({ board: b, tray: [piece('dot'), piece('dot'), piece('dot')] })
    const rng = createRng(2)
    let r = playPiece(s, { type: 'tray', index: 0 }, 0, 0, rng)
    expect(r.state.streak).toBe(1)
    expect(r.move.points.bonus).toBe(10)
    s = r.state
    r = playPiece(s, { type: 'tray', index: 1 }, 1, 0, rng)
    expect(r.move.points.bonus).toBe(15) // second clear in a row
    expect(r.state.streak).toBe(2)
    r = playPiece(r.state, { type: 'tray', index: 2 }, 5, 5, rng)
    expect(r.state.streak).toBe(0)
  })

  it('detects a perfect clear and awards 200', () => {
    const b = boardWith(FULL_ROW_EXCEPT(3))
    const s = stateWith({ board: b })
    const { move, state } = playPiece(s, { type: 'tray', index: 0 }, 3, 0, createRng(3))
    expect(move.perfect).toBe(true)
    expect(move.points.perfect).toBe(PERFECT_BONUS)
    expect(isBoardEmpty(state.board)).toBe(true)
    expect(state.score).toBe(1 + 10 + 200)
  })

  it('does not call it perfect when cells remain', () => {
    const b = boardWith([...FULL_ROW_EXCEPT(3), [6, 6]])
    const { move } = playPiece(stateWith({ board: b }), { type: 'tray', index: 0 }, 3, 0, createRng(3))
    expect(move.perfect).toBe(false)
  })
})

describe('levels', () => {
  it('starts at 1600 and rises by 800 x the level just finished', () => {
    expect(targetForLevel(1)).toBe(1600)
    expect(targetForLevel(2)).toBe(2400)
    expect(targetForLevel(3)).toBe(4000)
    expect(targetForLevel(4)).toBe(6400)
    for (let l = 1; l < 30; l++) expect(targetForLevel(l + 1)).toBeGreaterThan(targetForLevel(l))
  })

  it('reports progress through the level', () => {
    expect(levelProgress(0, 1)).toBe(0)
    expect(levelProgress(800, 1)).toBe(0.5)
    expect(levelProgress(1600, 2)).toBe(0)
    expect(levelProgress(2000, 2)).toBe(0.5)
  })

  it('levels up, raises the target and grants a re-roll', () => {
    const s = stateWith({ score: 1599, rerolls: 0 })
    const { state, move } = playPiece(s, { type: 'tray', index: 1 }, 0, 0, createRng(4)) // h2 = +2
    expect(state.level).toBe(2)
    expect(state.rerolls).toBe(1)
    expect(move.levelsGained).toBe(1)
    expect(targetForLevel(state.level)).toBe(2400)
  })

  it('can gain several levels from one big score', () => {
    const s = stateWith({ score: 3999 })
    const { state } = playPiece(s, { type: 'tray', index: 1 }, 0, 0, createRng(4))
    expect(state.level).toBe(4)
    expect(state.rerolls).toBe(START_REROLLS + 3)
  })
})

describe('tray, hold and game over', () => {
  it('deals three new pieces only when the tray is used up', () => {
    const rng = createRng(5)
    let s = stateWith()
    let r = playPiece(s, { type: 'tray', index: 0 }, 0, 0, rng)
    expect(r.move.dealt).toBe(false)
    r = playPiece(r.state, { type: 'tray', index: 1 }, 2, 2, rng)
    expect(r.move.dealt).toBe(false)
    r = playPiece(r.state, { type: 'tray', index: 2 }, 5, 5, rng)
    expect(r.move.dealt).toBe(true)
    expect(r.state.tray.every(Boolean)).toBe(true)
  })

  it('rejects an illegal move without changing anything', () => {
    const s = stateWith({ board: boardWith([[0, 0]]) })
    const r = playPiece(s, { type: 'tray', index: 0 }, 0, 0, createRng(1))
    expect(r.ok).toBe(false)
    expect(r.state).toBe(s)
  })

  it('moves a tray piece into hold, and swaps when hold is occupied', () => {
    const rng = createRng(6)
    let s = holdFromTray(stateWith(), 1, rng)
    expect(s.hold.id).toBe('h2')
    expect(s.tray[1]).toBeNull()
    s = holdFromTray(s, 0, rng)
    expect(s.hold.id).toBe('dot')
    expect(s.tray[0].id).toBe('h2') // swapped in
  })

  it('placing the held piece does not deal a new set', () => {
    const rng = createRng(7)
    const s = stateWith({ hold: piece('sq2') })
    const r = playPiece(s, { type: 'hold' }, 0, 0, rng)
    expect(r.ok).toBe(true)
    expect(r.state.hold).toBeNull()
    expect(r.move.dealt).toBe(false)
    expect(r.state.tray.map(p => p?.id)).toEqual(['dot', 'h2', 'v2'])
  })

  it('deals a fresh set if holding the last tray piece empties the tray', () => {
    const s = stateWith({ tray: [null, piece('h2'), null] })
    const next = holdFromTray(s, 1, createRng(8))
    expect(next.hold.id).toBe('h2')
    expect(next.tray.every(Boolean)).toBe(true)
  })

  it('is game over when no tray piece fits and nothing is held', () => {
    // Checkerboard: every empty cell is isolated, so only a dot would fit.
    const cells = []
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if ((r + c) % 2 === 0) cells.push([r, c])
    const b = boardWith(cells)
    expect(hasAnyMove(b, [piece('h2'), piece('sq2')])).toBe(false)
    const s = stateWith({ board: b, tray: [piece('h2'), piece('sq2'), null] })
    const next = holdFromTray(s, 0, createRng(1)) // hold h2: still nothing fits
    expect(next.over).toBe(true)
  })

  it('is NOT game over while a held piece still fits', () => {
    const cells = []
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if ((r + c) % 2 === 0) cells.push([r, c])
    const b = boardWith(cells)
    const s = stateWith({ board: b, tray: [piece('h2'), piece('sq2'), piece('dot')], hold: piece('dot') })
    // place the dot from the tray: board changes, tray still has h2 and sq2 that don't fit, hold dot does.
    const r = playPiece(s, { type: 'tray', index: 2 }, 0, 1, createRng(1))
    expect(r.ok).toBe(true)
    expect(r.state.over).toBe(false)
    // spend the held dot too and nothing is left that fits
    const r2 = playPiece(r.state, { type: 'hold' }, 1, 0, createRng(1))
    expect(r2.state.over).toBe(true)
  })

  it('refuses to play once the game is over', () => {
    const s = stateWith({ over: true })
    expect(playPiece(s, { type: 'tray', index: 0 }, 0, 0, createRng(1)).ok).toBe(false)
    expect(rerollTray(s, createRng(1))).toBe(s)
  })
})

describe('fair piece generation', () => {
  it('is deterministic for a seed', () => {
    const a = generatePieces(emptyBoard(), createRng('seed')).map(p => `${p.id}:${p.color}`)
    const b = generatePieces(emptyBoard(), createRng('seed')).map(p => `${p.id}:${p.color}`)
    expect(a).toEqual(b)
    expect(newGame(createRng(9))).toEqual(newGame(createRng(9)))
  })

  it('always deals 3 pieces with one fixed colour each, from the palette', () => {
    const rng = createRng(10)
    for (let i = 0; i < 50; i++) {
      const set = generatePieces(emptyBoard(), rng)
      expect(set).toHaveLength(3)
      for (const p of set) expect(COLORS).toContain(p.color)
    }
  })

  it('every dealt set fits on a crowded board when any space is left', () => {
    const rng = createRng(11)
    for (let i = 0; i < 200; i++) {
      // random board with ~70% fill that still has some empty cells
      const b = emptyBoard()
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (rng.next() < 0.7) b[r][c] = BLUE
      b[rng.int(0, 7)][rng.int(0, 7)] = null // at least one hole
      const set = generatePieces(b, rng)
      expect(hasAnyMove(b, set)).toBe(true)
    }
  })

  it('falls back to small pieces on a nearly full board', () => {
    const rng = createRng(12)
    const b = boardWith(Array.from({ length: SIZE * SIZE - 1 }, (_, i) => [Math.floor(i / SIZE), i % SIZE]))
    const set = generatePieces(b, rng)
    expect(set.some(p => p.id === 'dot')).toBe(true)
  })

  it('offers a line-completing piece fairly often when one exists', () => {
    const rng = createRng(13)
    const b = boardWith(rowCells(4, [2, 3])) // a row missing two cells: h2 completes it
    let helped = 0
    for (let i = 0; i < 200; i++) {
      const set = generatePieces(b, rng)
      const clears = set.some(p => {
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
          if (canPlace(b, p.cells, r, c) && findFullLines(placeCells(b, p.cells, r, c, PINK)).rows.length) return true
        }
        return false
      })
      if (clears) helped++
    }
    expect(helped).toBeGreaterThan(40)
  })
})

describe('re-roll', () => {
  it('spends a re-roll and replaces only the unplayed tray pieces', () => {
    const rng = createRng(14)
    const s = stateWith({ tray: [piece('dot'), null, piece('v2')], hold: piece('h4') })
    const r = rerollTray(s, rng)
    expect(r.rerolls).toBe(START_REROLLS - 1)
    expect(r.tray[1]).toBeNull()
    expect(r.tray[0]).toBeTruthy()
    expect(r.tray[2]).toBeTruthy()
    expect(r.hold.id).toBe('h4')
  })

  it('does nothing at zero re-rolls', () => {
    const s = stateWith({ rerolls: 0 })
    expect(rerollTray(s, createRng(1))).toBe(s)
  })

  it('is fair: the new pieces always include one that fits', () => {
    const rng = createRng(15)
    for (let i = 0; i < 150; i++) {
      const b = emptyBoard()
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (rng.next() < 0.72) b[r][c] = BLUE
      b[rng.int(0, 7)][rng.int(0, 7)] = null
      const s = stateWith({ board: b, tray: [piece('h5'), piece('sq3'), piece('c5a')] })
      const r = rerollTray(s, rng)
      expect(hasAnyMove(b, r.tray)).toBe(true)
    }
  })
})

describe('saved games', () => {
  it('round-trips through serialize and sanitize', () => {
    const s = stateWith({ board: boardWith([[1, 1]]), hold: piece('T1', BLUE), score: 321, level: 1, streak: 2 })
    const copy = sanitizeState(JSON.parse(JSON.stringify(serializeState(s))))
    expect(copy).toEqual(s)
  })

  it.each([
    ['null', null],
    ['a string', 'nope'],
    ['wrong board size', { ...serializeState(stateWith()), board: [[null]] }],
    ['unknown colour', { ...serializeState(stateWith()), board: boardWith([[0, 0]], 'red') }],
    ['unknown piece', { ...serializeState(stateWith()), tray: [{ id: 'zzz', color: PINK }, null, null] }],
    ['empty tray', { ...serializeState(stateWith()), tray: [null, null, null] }],
    ['negative score', { ...serializeState(stateWith()), score: -5 }],
    ['fractional level', { ...serializeState(stateWith()), level: 1.5 }],
  ])('rejects corrupted data: %s', (_, raw) => {
    expect(sanitizeState(raw)).toBeNull()
  })
})
