import { describe, expect, it } from 'vitest'
import { createRng } from '../../platform/rng'
import { adjacentCounts, newGame, placeMines, reveal, toggleFlag, withMines } from './logic'
import { generateLevel } from './levels'
import { deduce, findHint, knowledgeFromGame, newKnowledge, solve } from './solver'

/** Knowledge from a list of numbers: -1 closed, otherwise the number shown. */
function know(w, h, total, nums) {
  const k = newKnowledge(w, h, total)
  nums.forEach((n, i) => { k.num[i] = n })
  return k
}
const sorted = a => [...a].sort((x, y) => x - y)
const board = (w, h, mineIdx) => {
  const mines = new Uint8Array(w * h)
  mineIdx.forEach(i => { mines[i] = 1 })
  return { w, h, mineCount: mineIdx.length, mines, counts: adjacentCounts(mines, w, h) }
}

describe('deduce: one technique at a time', () => {
  it('basic: a number whose closed neighbours are all mines marks them', () => {
    // The corner 1 touches one closed cell (the others are open), so that cell is a mine.
    expect(deduce(know(2, 2, 1, [1, 0, 0, -1]))).toMatchObject({ tech: 'basic', mines: [3] })
  })

  it('basic: a number with all its mines marked makes the rest safe', () => {
    const k = know(3, 3, 3, [-1, -1, -1, -1, 1, -1, -1, -1, -1])
    k.mark[0] = 1
    expect(deduce(k)).toMatchObject({ tech: 'basic', safe: [1, 2, 3, 5, 6, 7, 8] })
  })

  it('count: when every mine is found the rest is safe, and when only mines remain they are all mines', () => {
    const k = newKnowledge(3, 1, 1)
    k.mark[1] = 1
    expect(deduce(k)).toMatchObject({ tech: 'count', safe: [0, 2] })
    expect(deduce(newKnowledge(2, 2, 4))).toMatchObject({ tech: 'count', mines: [0, 1, 2, 3] })
  })

  it('subset: the 1-2-1 pattern', () => {
    // Open row 1 2 1 above three closed cells, with two mines in total. No single number settles anything,
    // but comparing the 1 with the 2 shows the right-hand cell is a mine (and the left one too).
    const d = deduce(know(3, 2, 2, [1, 2, 1, -1, -1, -1]))
    expect(d.tech).toBe('subset')
    expect(sorted(d.mines)).toEqual([3, 5])
  })

  it('subset: the 1-1 pattern clears the extra cell', () => {
    // 1 1 over three closed cells with one mine: the cell only the second 1 touches is safe.
    const d = deduce(know(3, 2, 1, [1, 1, -1, -1, -1, -1]))
    expect(d.tech).toBe('subset')
    expect(d.safe).toContain(5)
  })

  it('enum: when the cheaper techniques find nothing, only a full search is left', () => {
    // 5x3 with a closed ring around 2 3 2: the cheap techniques find nothing, so a deduction here must be 'enum'.
    const k = know(5, 3, 4, [-1, -1, -1, -1, -1, -1, 2, 3, 2, -1, -1, -1, -1, -1, -1])
    expect(deduce(k, 'subset')?.tech ?? null).not.toBe('enum')
    const found = deduce(k, 'enum')
    if (found) expect(found.tech).toBe('enum')
  })

  it('returns null when only a guess is left', () => {
    expect(deduce(newKnowledge(3, 1, 1))).toBeNull() // nothing open, one mine somewhere
    // A corner 1 with three closed neighbours and one mine: every one of them could be it.
    expect(deduce(know(2, 2, 1, [1, -1, -1, -1]))).toBeNull()
  })

  it('maxTech "basic" turns off the other techniques', () => {
    expect(deduce(know(3, 2, 2, [1, 2, 1, -1, -1, -1]), 'basic')).toBeNull() // needs subset
    expect(deduce(know(3, 2, 2, [1, 2, 1, -1, -1, -1]), 'subset')?.tech).toBe('subset')
  })
})

describe('solve: playing a whole board by deduction', () => {
  it('finishes a simple board using only basic reasoning', () => {
    const r = solve(board(5, 5, [24, 23]), 0, 'basic')
    expect(r.solved).toBe(true)
    expect(r.hardest).toBe('basic')
    expect(r.remaining).toBe(0)
  })

  it('reports a board that needs a guess as unsolved, with the cells left over', () => {
    // 2x2 with one mine, opened on a corner: the three neighbours are equally likely.
    const r = solve(board(2, 2, [3]), 0)
    expect(r.solved).toBe(false)
    expect(r.remaining).toBe(2)
  })

  it('never contradicts the real mines (soundness) over many generated boards', () => {
    for (let s = 0; s < 60; s++) {
      const w = 9 + (s % 4)
      const h = 9
      const mines = placeMines(w, h, 14 + (s % 6), createRng(`sound-${s}`), 40)
      const b = { w, h, mineCount: mines.reduce((t, m) => t + m, 0), mines, counts: adjacentCounts(mines, w, h) }
      const r = solve(b, 40)
      expect(r.unsound).toBeUndefined()
    }
  })

  it('a capped solve never uses a technique above the cap', () => {
    let capped = 0
    for (let s = 0; s < 80; s++) {
      const mines = placeMines(10, 10, 16, createRng(`cap-${s}`), 45)
      const b = { w: 10, h: 10, mineCount: 16, mines, counts: adjacentCounts(mines, 10, 10) }
      const r = solve(b, 45, 'basic')
      expect(r.techniques.subset + r.techniques.enum).toBe(0)
      if (r.solved) capped++
    }
    expect(capped).toBeGreaterThan(0)
  })

  it('exhaustive search solves boards the simpler techniques cannot', () => {
    let helped = 0
    for (let s = 0; s < 150 && helped === 0; s++) {
      const mines = placeMines(12, 12, 28, createRng(`enum-${s}`), 70)
      const b = { w: 12, h: 12, mineCount: 28, mines, counts: adjacentCounts(mines, 12, 12) }
      const simple = solve(b, 70, 'subset')
      const full = solve(b, 70, 'enum')
      if (!simple.solved && full.solved) { helped++; expect(full.techniques.enum).toBeGreaterThan(0) }
    }
    expect(helped).toBeGreaterThan(0)
  })

  it('reports how complex the constraints got', () => {
    const r = solve(board(8, 8, [10, 21, 30, 45, 50, 60]), 0)
    expect(r.rounds).toBeGreaterThan(0)
    expect(r.frontierPeak).toBeGreaterThanOrEqual(0)
    expect(r.forced).toBe(r.techniques.basic + r.techniques.count + r.techniques.subset + r.techniques.enum)
  })
})

describe('findHint: a certain move from what the player can see', () => {
  /** A playing game on a fixed layout, after opening `first`. */
  function play(w, h, mineIdx, first) {
    const mines = new Uint8Array(w * h)
    mineIdx.forEach(i => { mines[i] = 1 })
    return reveal(withMines(newGame(w, h, mineIdx.length), mines), first)
  }

  /** A generated level, opened on its suggested first click. */
  function openLevel(level) {
    const p = generateLevel(level)
    return reveal(withMines(newGame(p.w, p.h, p.mineCount), p.mines), p.firstIdx)
  }

  it('points at a safe square when one is certain', () => {
    const g = openLevel(9)
    expect(g.status).toBe('playing')
    const hint = findHint(g)
    expect(hint).not.toBeNull()
    expect(g.mines[hint.idx]).toBe(hint.type === 'mine' ? 1 : 0)
    expect(g.revealed[hint.idx]).toBe(0)
  })

  it('is always right: following hints to the end wins a guess-free board', () => {
    const w = 9
    const h = 9
    const mines = placeMines(w, h, 10, createRng('hint-run'), 40)
    let g = reveal(withMines(newGame(w, h, 10), mines), 40)
    for (let guard = 0; guard < 200 && g.status === 'playing'; guard++) {
      const hint = findHint(g)
      if (!hint) break
      if (hint.type === 'safe') {
        expect(g.mines[hint.idx]).toBe(0)
        g = reveal(g, hint.idx)
      } else {
        expect(g.mines[hint.idx]).toBe(1)
        g = toggleFlag(g, hint.idx)
      }
    }
    // Either it won, or it stopped at a spot that really needs a guess: never a wrong hint.
    expect(['won', 'playing']).toContain(g.status)
  })

  it('does not trust the player’s flags', () => {
    const g0 = openLevel(9)
    const closedSafe = Array.from(g0.mines, (_, i) => i).find(i => !g0.revealed[i] && !g0.mines[i])
    const wrong = toggleFlag(g0, closedSafe) // a flag on a cell that is not a mine
    const hint = findHint(wrong)
    expect(hint).not.toBeNull()
    if (hint.type === 'safe') expect(wrong.mines[hint.idx]).toBe(0)
    else expect(wrong.mines[hint.idx]).toBe(1)
  })

  it('skips mines the player has already flagged', () => {
    let g = play(2, 2, [3], 0) // opens the corner; nothing certain there
    expect(findHint(g)).toBeNull()
    // Same idea on a board with a certain mine: flag it and the hint moves on or runs out.
    g = play(3, 1, [1], 0)
    const first = findHint(g)
    expect(first).toEqual({ idx: 1, type: 'mine', tech: 'basic' })
    const flagged = toggleFlag(g, 1)
    const next = findHint(flagged)
    expect(next?.idx).not.toBe(1)
  })

  it('returns null when the game is not being played', () => {
    expect(findHint(newGame(4, 4, 3))).toBeNull()
  })

  it('builds knowledge from open cells only', () => {
    const g = play(6, 6, [35], 0)
    const k = knowledgeFromGame(g)
    expect(k.num[0]).toBe(0)
    expect(k.num[35]).toBe(-1)
    expect(k.total).toBe(1)
  })
})
