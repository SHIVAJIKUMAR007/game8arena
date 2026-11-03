import { describe, expect, it } from 'vitest'
import { bestMove, hasMoves, initialTiles, isEndless, move, rescue, sizeFor, targetFor } from './logic'
import { createRng } from '../../platform/rng'

const T = (id, v, r, c) => ({ id, v, r, c })

describe('merge logic (powers of 3)', () => {
  it('merges three equal tiles into one tripled tile', () => {
    const res = move([T(1, 3, 0, 0), T(2, 3, 0, 1), T(3, 3, 0, 2)], 'left')
    expect(res.tiles.map(t => [t.c, t.v])).toEqual([[0, 9]])
    expect(res.gained).toBe(9)
    expect(res.gone).toHaveLength(2)
  })

  it('does not merge only two equal tiles, and merges once per move', () => {
    expect(move([T(1, 3, 0, 0), T(2, 3, 0, 1)], 'left').moved).toBe(false)
    const six = [0, 1, 2, 3, 4].map(c => T(c + 1, 3, 0, c))
    const res = move(six, 'left').tiles.sort((a, b) => a.c - b.c)
    expect(res.map(t => t.v)).toEqual([9, 3, 3])
  })

  it('detects a locked board and rescues it', () => {
    const tiles = []
    let id = 1
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) tiles.push(T(id++, [3, 9, 27][(r * 2 + c) % 3] , r, c))
    // no three equal in any row/column ⇒ locked
    const locked = tiles.map((t, i) => ({ ...t, v: [3, 9][((i % 5) + Math.floor(i / 5)) % 2] }))
    expect(hasMoves(locked)).toBe(false)
    expect(hasMoves(rescue(locked))).toBe(true)
  })

  it('is deterministic per seed with powers-of-3 targets', () => {
    const a = initialTiles(3, createRng('m:L3')).map(t => [t.v, t.r, t.c])
    expect(a).toEqual(initialTiles(3, createRng('m:L3')).map(t => [t.v, t.r, t.c]))
    expect(a.every(([v]) => v === 3 || v === 9)).toBe(true)
    expect([1, 5].map(targetFor)).toEqual([27, 2187])
    expect(targetFor(6)).toBeNull()
    expect(bestMove([T(1, 3, 0, 0), T(2, 3, 0, 1), T(3, 3, 0, 2)])).toBeTruthy()
  })

  it('uses 5x5 / 6x6 / 7x7 stages (7x7 from level 5) and is endless from level 6', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 50].map(sizeFor)).toEqual([5, 5, 5, 6, 7, 7, 7, 7])
    expect([5, 6, 99].map(isEndless)).toEqual([false, true, true])
    expect([1, 2, 3, 4, 5].map(targetFor)).toEqual([27, 81, 243, 729, 2187])
  })
})
