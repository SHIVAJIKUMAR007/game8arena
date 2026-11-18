import { describe, expect, it } from 'vitest'
import { createRng } from '../../platform/rng'
import {
  adjacentCounts, chord, flagCount, flagsAround, maxMines, minesLeft, neighbours, newGame, placeMines, restore, reveal,
  safeZone, snapshot, toggleFlag, view, withMines,
} from './logic'

/** A playing game with mines at the given indexes. */
function game(w, h, mineIdx) {
  const mines = new Uint8Array(w * h)
  mineIdx.forEach(i => { mines[i] = 1 })
  return withMines(newGame(w, h, mineIdx.length), mines)
}
const indexes = a => Array.from(a, (v, i) => (v ? i : -1)).filter(i => i >= 0)
const openCells = g => indexes(g.revealed)

describe('neighbours', () => {
  it('has 8 around the middle, 5 along an edge and 3 in a corner', () => {
    expect(neighbours(12, 5, 5)).toHaveLength(8)
    expect(neighbours(2, 5, 5)).toHaveLength(5)
    expect(neighbours(0, 5, 5)).toHaveLength(3)
    expect([...neighbours(0, 3, 3)].sort()).toEqual([1, 3, 4])
  })
  it('does not wrap around the edges of a row', () => {
    expect(neighbours(4, 5, 3)).not.toContain(5) // last column of row 0 is not next to the first column of row 1
    expect(neighbours(5, 5, 3)).not.toContain(4)
  })
})

describe('mine placement', () => {
  it('places exactly the requested number of mines', () => {
    for (const [w, h, n] of [[9, 9, 10], [16, 16, 40], [30, 16, 99], [6, 6, 4]]) {
      const mines = placeMines(w, h, n, createRng(`count-${w}`), 0)
      expect(mines.reduce((t, m) => t + m, 0)).toBe(n)
      expect(mines).toHaveLength(w * h)
    }
  })

  it('keeps the first click and every neighbour free, wherever the click lands', () => {
    for (const first of [0, 8, 40, 72, 80, 4, 36]) {
      for (let s = 0; s < 20; s++) {
        const mines = placeMines(9, 9, 10, createRng(`safe-${first}-${s}`), first)
        expect(mines[first]).toBe(0)
        neighbours(first, 9, 9).forEach(j => expect(mines[j]).toBe(0))
      }
    }
  })

  it('is deterministic: same seed, same layout; different seed, different layout', () => {
    const a = placeMines(16, 16, 40, createRng('seed-a'), 100)
    const b = placeMines(16, 16, 40, createRng('seed-a'), 100)
    const c = placeMines(16, 16, 40, createRng('seed-b'), 100)
    expect(indexes(a)).toEqual(indexes(b))
    expect(indexes(a)).not.toEqual(indexes(c))
  })

  it('shrinks the safe zone to the clicked cell when the grid is too crowded, and never overfills', () => {
    expect(safeZone(4, 3, 3, 8)).toEqual([4])
    const full = placeMines(3, 3, 8, createRng('crowded'), 4)
    expect(full[4]).toBe(0)
    expect(full.reduce((t, m) => t + m, 0)).toBe(8)
    expect(maxMines(3, 3)).toBe(8)
    expect(placeMines(3, 3, 50, createRng('too-many'), 0).reduce((t, m) => t + m, 0)).toBe(8)
  })
})

describe('adjacent counts', () => {
  it('counts the mines in the eight surrounding cells', () => {
    // . * .
    // . . .
    // * * .
    // A mine's own number only counts its neighbours, never itself.
    const counts = adjacentCounts(Uint8Array.from([0, 1, 0, 0, 0, 0, 1, 1, 0]), 3, 3)
    expect(Array.from(counts)).toEqual([1, 0, 1, 3, 3, 2, 1, 1, 1])
  })

  it('corner and edge cells only look at cells that exist', () => {
    const counts = adjacentCounts(Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 1]), 3, 3)
    expect(Array.from(counts)).toEqual([0, 0, 0, 0, 1, 1, 0, 1, 0])
  })

  it('every number matches a manual count on a random board', () => {
    const w = 12
    const h = 9
    const mines = placeMines(w, h, 20, createRng('manual'), 0)
    const counts = adjacentCounts(mines, w, h)
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        let n = 0
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if ((dr || dc) && r + dr >= 0 && r + dr < h && c + dc >= 0 && c + dc < w) n += mines[(r + dr) * w + c + dc]
          }
        }
        expect(counts[r * w + c]).toBe(n)
      }
    }
  })
})

describe('reveal and flood fill', () => {
  it('a number opens just that cell', () => {
    const g = reveal(game(4, 4, [15]), 14)
    expect(openCells(g)).toEqual([14])
    expect(g.status).toBe('playing')
  })

  it('an empty cell opens its whole empty region plus the numbered edge around it', () => {
    // One mine in the far corner: clicking the opposite corner opens everything except the mine.
    const g = reveal(game(5, 5, [24]), 0)
    expect(g.revealedCount).toBe(24)
    expect(g.revealed[24]).toBe(0)
    expect(g.status).toBe('won')
  })

  it('stops at numbers: the flood does not go through them', () => {
    // Mine wall down the middle column of a 5x3 grid splits the board.
    const g = reveal(game(5, 3, [2, 7, 12]), 0)
    expect(openCells(g)).toEqual([0, 1, 5, 6, 10, 11])
    expect(g.status).toBe('playing')
  })

  it('does not open flagged cells, even inside an empty region', () => {
    let g = game(4, 4, [15])
    g = toggleFlag(g, 5)
    g = reveal(g, 0)
    expect(g.revealed[5]).toBe(0)
    expect(g.flags[5]).toBe(1)
    expect(g.revealedCount).toBe(14) // 15 safe cells minus the flagged one
    expect(g.status).toBe('playing')
  })

  it('ignores clicks on open or flagged cells, and does not change the input game', () => {
    const start = game(4, 4, [15])
    const opened = reveal(start, 0)
    expect(start.revealedCount).toBe(0) // original untouched
    expect(reveal(opened, 0)).toBe(opened)
    const flagged = toggleFlag(start, 3)
    expect(reveal(flagged, 3)).toBe(flagged)
  })

  it('does nothing before the mines are placed', () => {
    const ready = newGame(4, 4, 3)
    expect(reveal(ready, 0)).toBe(ready)
  })
})

describe('flags', () => {
  it('toggles on and off and updates the mine counter', () => {
    let g = game(4, 4, [15, 14])
    expect(minesLeft(g)).toBe(2)
    g = toggleFlag(g, 0)
    expect(g.flags[0]).toBe(1)
    expect(flagCount(g)).toBe(1)
    expect(minesLeft(g)).toBe(1)
    g = toggleFlag(g, 0)
    expect(flagCount(g)).toBe(0)
    expect(minesLeft(g)).toBe(2)
  })

  it('the counter goes negative when you flag more cells than there are mines', () => {
    let g = game(4, 4, [15])
    g = toggleFlag(toggleFlag(g, 0), 1)
    expect(minesLeft(g)).toBe(-1)
  })

  it('cannot flag an open cell', () => {
    const g = reveal(game(4, 4, [15]), 14)
    expect(toggleFlag(g, 14)).toBe(g)
  })

  it('can be placed before the first click, and blocks that click until removed', () => {
    let g = toggleFlag(newGame(4, 4, 3), 5)
    expect(g.flags[5]).toBe(1)
    expect(g.status).toBe('ready')
    g = toggleFlag(g, 5)
    expect(g.flags[5]).toBe(0)
  })

  it('cannot be changed once the game is over', () => {
    const lost = reveal(game(3, 3, [0]), 0)
    expect(lost.status).toBe('lost')
    expect(toggleFlag(lost, 4)).toBe(lost)
  })
})

describe('chording', () => {
  // 3x3 with mines at 0 and 8: the centre shows 2.
  const base = () => reveal(game(3, 3, [0, 8]), 4)

  it('opens the other neighbours once the flag count matches the number', () => {
    let g = base()
    g = toggleFlag(toggleFlag(g, 0), 8)
    expect(flagsAround(g, 4)).toBe(2)
    g = chord(g, 4)
    expect(g.revealedCount).toBe(7)
    expect(g.status).toBe('won')
  })

  it('does nothing when the flags do not match', () => {
    const g = toggleFlag(base(), 0)
    expect(chord(g, 4)).toBe(g)
    const none = base()
    expect(chord(none, 4)).toBe(none)
  })

  it('a wrong flag makes it open a mine and lose', () => {
    let g = base()
    g = toggleFlag(toggleFlag(g, 1), 2) // two flags, but on safe cells
    g = chord(g, 4)
    expect(g.status).toBe('lost')
    expect(g.mines[g.exploded]).toBe(1)
  })

  it('does nothing on a closed cell or an empty cell', () => {
    const g = game(3, 3, [0])
    expect(chord(g, 5)).toBe(g)
    const opened = reveal(game(5, 5, [24]), 0)
    expect(chord(opened, 0)).toBe(opened)
  })
})

describe('winning and losing', () => {
  it('opening a mine loses, marks the mine that exploded, and stops further play', () => {
    const g = reveal(game(4, 4, [5, 10]), 5)
    expect(g.status).toBe('lost')
    expect(g.exploded).toBe(5)
    expect(reveal(g, 0)).toBe(g)
    expect(chord(g, 0)).toBe(g)
  })

  it('wins exactly when the last safe cell opens, not before', () => {
    let g = game(3, 1, [1])
    g = reveal(g, 0)
    expect(g.status).toBe('playing')
    g = reveal(g, 2)
    expect(g.status).toBe('won')
  })

  it('a win flags every mine so the counter reads zero', () => {
    const g = reveal(reveal(game(3, 1, [1]), 0), 2)
    expect(g.flags[1]).toBe(1)
    expect(minesLeft(g)).toBe(0)
  })

  it('flags do not count as opened cells: a flagged safe cell is still needed to win', () => {
    let g = game(3, 1, [1])
    g = toggleFlag(g, 2)
    g = reveal(g, 0)
    expect(g.status).toBe('playing')
    g = toggleFlag(g, 2)
    g = reveal(g, 2)
    expect(g.status).toBe('won')
  })
})

describe('view', () => {
  it('reports no mines while the game is on, flagged or not', () => {
    let g = game(4, 4, [5, 10])
    g = reveal(g, 0)
    g = toggleFlag(g, 5)
    const cells = view(g)
    expect(cells.every(c => c.state !== 'mine' && c.state !== 'boom' && c.state !== 'wrong')).toBe(true)
    expect(cells[5].state).toBe('flag')
    expect(cells[10].state).toBe('hidden')
  })

  it('after a loss shows all mines, the exploded one, and wrong flags', () => {
    let g = game(4, 4, [5, 10])
    g = toggleFlag(g, 0) // wrong flag
    g = toggleFlag(g, 10) // right flag
    g = reveal(g, 5)
    const cells = view(g)
    expect(cells[5].state).toBe('boom')
    expect(cells[10].state).toBe('flag')
    expect(cells[0].state).toBe('wrong')
  })

  it('reports the number on open cells', () => {
    const g = reveal(game(3, 3, [0]), 4)
    expect(view(g)[4]).toEqual({ state: 'open', n: 1 })
  })
})

describe('saving and restoring a position', () => {
  it('round-trips revealed cells and flags', () => {
    let g = game(9, 9, [3, 40, 41, 70, 80])
    g = reveal(g, 20)
    g = toggleFlag(g, 40)
    const back = restore(9, 9, 5, g.mines, snapshot(g))
    expect(openCells(back)).toEqual(openCells(g))
    expect(indexes(back.flags)).toEqual(indexes(g.flags))
    expect(back.status).toBe('playing')
  })

  it('rejects saves that cannot belong to this board', () => {
    const g = game(4, 4, [5])
    expect(restore(4, 4, 1, g.mines, { revealed: [5], flags: [] })).toBeNull() // a mine can't be open
    expect(restore(4, 4, 1, g.mines, { revealed: [99], flags: [] })).toBeNull()
    expect(restore(4, 4, 1, g.mines, { revealed: [1.5], flags: [] })).toBeNull()
    expect(restore(4, 4, 1, g.mines, { revealed: 'x', flags: [] })).toBeNull()
    expect(restore(4, 4, 1, g.mines, null)).toBeNull()
  })

  it('a restored finished position is detected as won', () => {
    const g = reveal(game(3, 1, [1]), 0)
    const back = restore(3, 1, 1, g.mines, { revealed: [0, 2], flags: [] })
    expect(back.status).toBe('won')
  })
})
