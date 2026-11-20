import { describe, expect, it } from 'vitest'
import { createRng } from '../../platform/rng'
import {
  CELL_DIST, CELL_X, CELL_Y, COLS, CX, CY, D, H, N, NEIGHBORS, RING_R, ROWS, ROW_H, W,
  cellX, cellY, index, isAnchor, nearestCell, neighborsOf,
} from './hex'
import {
  BOMB, EMPTY, MAX_COLORS, METER_SLOTS, PALETTE, RAINBOW,
  blastArea, chainBonus, comboMultiplier, countFilled, creep, findFloating, generateField, holeMask, levelParams,
  matchGroup, newLevel, openSpace, pickBubble, pickColor, presentColors, resolveShot, sanitizeHand, scoreShot,
  starsFor, swapHand, touchesRing,
} from './logic'
import { SPEED, makeShot, snapCell, stepShot, touching, traceAim } from './physics'

const blank = () => new Int8Array(N)
const fill = (cells, list, v) => list.forEach(([r, c]) => (cells[index(r, c)] = v))
const idx = list => list.map(([r, c]) => index(r, c)).sort((a, b) => a - b)
const sorted = a => [...a].sort((x, y) => x - y)

describe('hex grid', () => {
  it('has a 16:10-ish playfield', () => {
    expect(W / H).toBeGreaterThan(1.5)
    expect(W / H).toBeLessThan(1.7)
    expect(N).toBe(COLS * ROWS)
  })

  it('places odd rows half a bubble to the right and rows ROW_H apart', () => {
    expect(cellX(0, 0)).toBe(D / 2)
    expect(cellX(1, 0)).toBe(D)
    expect(cellY(3) - cellY(2)).toBeCloseTo(ROW_H)
  })

  it('finds the neighbours of an even row cell (columns c-1 and c above and below)', () => {
    expect(sorted(neighborsOf(4, 5))).toEqual(idx([[4, 4], [4, 6], [3, 4], [3, 5], [5, 4], [5, 5]]))
  })

  it('finds the neighbours of an odd row cell (columns c and c+1 above and below)', () => {
    expect(sorted(neighborsOf(5, 5))).toEqual(idx([[5, 4], [5, 6], [4, 5], [4, 6], [6, 5], [6, 6]]))
  })

  it('clips neighbours at the edges', () => {
    expect(sorted(neighborsOf(0, 0))).toEqual(idx([[0, 1], [1, 0]]))
    expect(neighborsOf(0, 0)).toHaveLength(2)
    expect(sorted(neighborsOf(1, 0))).toEqual(idx([[1, 1], [0, 0], [0, 1], [2, 0], [2, 1]]))
    expect(sorted(neighborsOf(2, COLS - 1))).toEqual(idx([[2, COLS - 2], [1, COLS - 2], [1, COLS - 1], [3, COLS - 2], [3, COLS - 1]]))
  })

  it('has symmetric neighbour lists whose centres are one bubble apart', () => {
    for (let i = 0; i < N; i++) {
      for (const n of NEIGHBORS[i]) {
        expect(NEIGHBORS[n]).toContain(i)
        expect(Math.hypot(CELL_X[i] - CELL_X[n], CELL_Y[i] - CELL_Y[n])).toBeCloseTo(D, 3)
      }
    }
  })

  it('snaps a pixel position to the nearest cell centre', () => {
    for (const [r, c] of [[0, 0], [7, 12], [8, 12], [ROWS - 1, COLS - 1], [10, 0]]) {
      const i = index(r, c)
      expect(nearestCell(CELL_X[i] + 3, CELL_Y[i] - 4)).toBe(i)
    }
    expect(nearestCell(-500, -500)).toBe(index(0, 0))
    expect(nearestCell(99999, 99999)).toBe(index(ROWS - 1, COLS - 1))
  })

  it('marks the four edges as anchors', () => {
    expect(isAnchor(index(0, 7))).toBe(true)
    expect(isAnchor(index(ROWS - 1, 7))).toBe(true)
    expect(isAnchor(index(9, 0))).toBe(true)
    expect(isAnchor(index(9, COLS - 1))).toBe(true)
    expect(isAnchor(index(9, 9))).toBe(false)
  })
})

describe('flood fill', () => {
  it('finds exactly the connected same-colour group', () => {
    const cells = blank()
    fill(cells, [[5, 5], [5, 6], [6, 5], [5, 9]], 1) // the last one is separate
    fill(cells, [[4, 5]], 2)
    const group = matchGroup(cells, index(5, 5), 1)
    expect(sorted(group)).toEqual(idx([[5, 5], [5, 6], [6, 5]]))
  })

  it('follows odd/even row offsets across rows', () => {
    const cells = blank()
    // a diagonal chain from an even row down through an odd row to an even row
    fill(cells, [[4, 5], [5, 5], [6, 5]], 3) // (4,5)-(5,5): odd row touches c and c+1 above, so (4,5) is above (5,5)
    expect(matchGroup(cells, index(4, 5), 3)).toHaveLength(3)
    const cells2 = blank()
    fill(cells2, [[4, 5], [5, 4]], 3) // (5,4) touches (4,4) and (4,5)
    expect(matchGroup(cells2, index(4, 5), 3)).toHaveLength(2)
    const cells3 = blank()
    fill(cells3, [[4, 5], [5, 6]], 3) // (5,6) touches (4,6) and (4,7), not (4,5)
    expect(matchGroup(cells3, index(4, 5), 3)).toHaveLength(1)
  })

  it('lets a rainbow bubble join the group it touches', () => {
    const cells = blank()
    fill(cells, [[5, 5], [5, 6]], 1)
    cells[index(5, 7)] = RAINBOW
    fill(cells, [[5, 8]], 1)
    expect(matchGroup(cells, index(5, 5), 1)).toHaveLength(4)
  })
})

describe('floating groups with edge anchors', () => {
  it('keeps everything joined to the top, left, right or bottom edge', () => {
    const cells = blank()
    fill(cells, [[0, 10], [1, 10], [2, 10]], 1) // hangs from the top row
    fill(cells, [[8, 0], [8, 1], [8, 2]], 2) // joined to the left column
    fill(cells, [[8, COLS - 1], [8, COLS - 2]], 3) // right column
    fill(cells, [[ROWS - 1, 4], [ROWS - 2, 4]], 1) // bottom row
    expect(findFloating(cells)).toEqual([])
  })

  it('finds an island cut off from every edge', () => {
    const cells = blank()
    fill(cells, [[8, 8], [8, 9], [9, 8]], 1)
    fill(cells, [[0, 3], [1, 3]], 2)
    expect(sorted(findFloating(cells))).toEqual(idx([[8, 8], [8, 9], [9, 8]]))
  })

  it('drops a cluster once the bubbles holding it to the edge are popped', () => {
    const cells = blank()
    fill(cells, [[0, 5]], 2) // anchor
    fill(cells, [[1, 5], [2, 5], [3, 5]], 1) // the stem
    fill(cells, [[3, 6], [4, 5]], 3) // hangs below
    expect(findFloating(cells)).toEqual([])
    cells[index(1, 5)] = EMPTY
    expect(sorted(findFloating(cells))).toEqual(idx([[2, 5], [3, 5], [3, 6], [4, 5]]))
  })
})

describe('bombs', () => {
  it('blasts every bubble within three cells', () => {
    const cells = new Int8Array(N).fill(1)
    const centre = index(10, 10)
    const area = blastArea(cells, centre, 3)
    expect(area).toHaveLength(37) // 1 + 6 + 12 + 18 on a hex grid
    expect(area).toContain(centre)
    expect(area).not.toContain(index(10, 14))
  })
})

describe('level generation', () => {
  it('is deterministic for a seed and different for another', () => {
    const p = levelParams(3)
    const a = generateField(p, createRng('lvl:3'))
    const b = generateField(p, createRng('lvl:3'))
    const c = generateField(p, createRng('other'))
    expect([...a]).toEqual([...b])
    expect([...a]).not.toEqual([...c])
  })

  it('leaves a clear hole around the shooter and fills the rest', () => {
    const cells = generateField(levelParams(1), createRng(1))
    expect(cells[index(Math.round(ROWS / 2), Math.round(COLS / 2))]).toBe(EMPTY)
    expect(countFilled(cells)).toBeGreaterThan(450)
    expect(countFilled(cells)).toBeLessThan(N - 20)
    expect(touchesRing(cells)).toBe(false)
    const mask = holeMask(1)
    for (let i = 0; i < N; i++) expect(cells[i] === EMPTY).toBe(mask[i] === 1)
  })

  it('makes clumps, not noise: most bubbles touch one of their own colour', () => {
    const cells = generateField(levelParams(1), createRng(2))
    let same = 0
    let total = 0
    for (let i = 0; i < N; i++) {
      if (!cells[i]) continue
      total++
      if (NEIGHBORS[i].some(n => cells[n] === cells[i])) same++
    }
    expect(same / total).toBeGreaterThan(0.85)
  })

  it('keeps colour groups small enough that one shot cannot clear the field', () => {
    for (const level of [1, 5, 20, 60]) {
      const params = levelParams(level)
      for (let k = 0; k < 6; k++) {
        const cells = generateField(params, createRng(`groups:${level}:${k}`))
        const seen = new Uint8Array(N)
        const sizes = []
        for (let i = 0; i < N; i++) {
          if (!cells[i] || seen[i]) continue
          const g = matchGroup(cells, i, cells[i])
          g.forEach(x => (seen[x] = 1))
          sizes.push(g.length)
        }
        expect(Math.max(...sizes), `level ${level} seed ${k}`).toBeLessThanOrEqual(params.maxGroup)
        sizes.sort((p, q) => p - q)
        expect(sizes[Math.floor(sizes.length / 2)]).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('starts with only red, green and blue, and unlocks more colours', () => {
    expect(PALETTE.slice(0, 3)).toEqual(['#e8201c', '#3ddc2a', '#1428e8'])
    expect(presentColors(generateField(levelParams(1), createRng(3))).sort()).toEqual([1, 2, 3])
    expect(levelParams(1).colors).toBe(3)
    expect(levelParams(3).colors).toBe(4)
    expect(levelParams(5).colors).toBe(5)
    expect(presentColors(generateField(levelParams(6), createRng(4))).length).toBe(5)
  })

  it('gets harder gradually and stops at the caps', () => {
    let prev = levelParams(1)
    for (let l = 2; l <= 60; l++) {
      const cur = levelParams(l)
      expect(cur.colors).toBeGreaterThanOrEqual(prev.colors)
      expect(cur.hole).toBeLessThanOrEqual(prev.hole)
      expect(cur.creepEvery).toBeLessThanOrEqual(prev.creepEvery)
      expect(cur.target).toBeGreaterThanOrEqual(prev.target)
      expect(cur.colors - prev.colors).toBeLessThanOrEqual(1)
      prev = cur
    }
    const top = levelParams(500)
    expect(top.colors).toBe(MAX_COLORS)
    expect(top.hole).toBe(0.85)
    expect(top.creepEvery).toBe(4)
    expect(top.target).toBe(0.85)
    expect(levelParams(1).creepEvery).toBe(8)
  })

  it('every level, even the smallest hole, starts clear of the ring', () => {
    for (const level of [1, 10, 25, 500]) {
      const cells = generateField(levelParams(level), createRng(level))
      expect(touchesRing(cells)).toBe(false)
    }
  })
})

describe('next bubble', () => {
  it('only picks colours that are still on the field', () => {
    const rng = createRng(5)
    const cells = blank()
    fill(cells, [[5, 5], [5, 6]], 2)
    fill(cells, [[7, 7]], 4)
    for (let i = 0; i < 200; i++) expect([2, 4]).toContain(pickColor(cells, rng))
  })

  it('always picks a present colour when dealing bubbles, apart from rainbows', () => {
    const rng = createRng(6)
    const state = newLevel(3, createRng(6))
    const present = new Set(presentColors(state.cells))
    for (let i = 0; i < 300; i++) {
      const b = pickBubble(state.cells, rng, state.params)
      expect(b === RAINBOW || present.has(b)).toBe(true)
    }
  })

  it('replaces a held colour that has been cleared from the field', () => {
    const cells = blank()
    fill(cells, [[5, 5]], 1)
    fill(cells, [[8, 8]], 3)
    const hand = sanitizeHand(cells, { cur: 2, next: 3 }, createRng(7), 3)
    expect([1, 3]).toContain(hand.cur)
    expect(hand.next).toBe(3)
    expect(sanitizeHand(cells, { cur: BOMB, next: RAINBOW }, createRng(7), 3)).toEqual({ cur: BOMB, next: RAINBOW })
  })

  it('after a shot, both held bubbles are still on the field', () => {
    const rng = createRng(8)
    let state = newLevel(1, createRng(8))
    for (let k = 0; k < 40 && state.status === 'playing'; k++) {
      // shoot a bubble of the held colour next to a same-colour bubble when there is one
      const color = state.hand.cur
      const target = [...Array(N).keys()].find(i => state.cells[i] === color && NEIGHBORS[i].some(n => state.cells[n] === EMPTY))
      if (target === undefined) break
      const land = NEIGHBORS[target].find(n => state.cells[n] === EMPTY)
      state = resolveShot(state, land, color, rng).state
      const present = new Set(presentColors(state.cells))
      for (const v of [state.hand.cur, state.hand.next]) if (v >= 1 && v <= MAX_COLORS) expect(present.has(v)).toBe(true)
    }
  })

  it('swaps the shooter and the waiting bubble', () => {
    const s = newLevel(1, createRng(9))
    const t = swapHand(s)
    expect(t.hand).toEqual({ cur: s.hand.next, next: s.hand.cur })
    expect(swapHand(t).hand).toEqual(s.hand)
  })
})

describe('shots and scoring', () => {
  /** A tiny scenario: three-in-a-row potential in open space, with an anchor so nothing else floats. */
  function scenario() {
    const state = newLevel(1, createRng(10))
    state.cells = blank()
    fill(state.cells, [[0, 12], [1, 12], [2, 12]], 2) // anchored stem
    fill(state.cells, [[3, 12], [3, 13]], 1) // a pair of reds
    fill(state.cells, [[21, 3]], 2)
    fill(state.cells, [[10, 0], [21, 20]], 3) // keep other colours on the field
    state.total = countFilled(state.cells)
    state.goal = state.total
    return state
  }

  it('pops a group of three or more of the same colour and scores 10 each', () => {
    const state = scenario()
    const { state: after, events } = resolveShot(state, index(4, 12), 1, createRng(11))
    expect(events.popped).toHaveLength(3)
    expect(after.cells[index(3, 12)]).toBe(EMPTY)
    expect(events.points.pop).toBe(30)
    expect(after.score).toBe(30)
    expect(after.streak).toBe(1)
    expect(after.meter).toBe(1)
    expect(after.misses).toBe(0)
  })

  it('does not pop a group of two', () => {
    const state = scenario()
    const { state: after, events } = resolveShot(state, index(3, 14), 2, createRng(11))
    expect(events.popped).toHaveLength(0)
    expect(after.cells[index(3, 14)]).toBe(2)
    expect(after.misses).toBe(1)
    expect(after.streak).toBe(0)
    expect(after.meter).toBe(0)
  })

  it('drops bubbles that lose their anchor and scores 20 each', () => {
    const state = scenario()
    state.cells = blank()
    fill(state.cells, [[0, 5]], 2)
    fill(state.cells, [[1, 5], [2, 5]], 1) // popped with the shot below
    fill(state.cells, [[3, 5]], 1)
    fill(state.cells, [[4, 5], [5, 5]], 3) // hang from the popped stem
    fill(state.cells, [[21, 15]], 2)
    fill(state.cells, [[21, 16]], 3)
    state.total = countFilled(state.cells)
    state.goal = state.total
    // popping row 1-2-3 removes the stem; the bubbles below are no longer joined to an edge
    state.cells[index(0, 5)] = 2
    const { events, state: after } = resolveShot(state, index(3, 6), 1, createRng(12))
    expect(events.popped.length).toBeGreaterThanOrEqual(3)
    expect(events.dropped.length).toBe(2)
    expect(events.points.drop).toBe(40)
    expect(after.cells[index(4, 5)]).toBe(EMPTY)
  })

  it('applies chain size and combo bonuses', () => {
    expect(chainBonus(3)).toBe(1)
    expect(chainBonus(5)).toBe(1.5)
    expect(chainBonus(8)).toBe(2)
    expect(comboMultiplier(1)).toBe(1)
    expect(comboMultiplier(3)).toBe(1.5)
    expect(comboMultiplier(99)).toBe(2.5)
    expect(scoreShot({ popped: 3, dropped: 0, streak: 1 }).total).toBe(30)
    expect(scoreShot({ popped: 5, dropped: 0, streak: 1 }).total).toBe(75)
    expect(scoreShot({ popped: 8, dropped: 2, streak: 1 }).total).toBe(160 + 40)
    expect(scoreShot({ popped: 3, dropped: 0, streak: 3 }).total).toBe(45)
  })

  it('a rainbow takes the colour of the biggest group it touches', () => {
    const state = scenario()
    state.cells = blank()
    fill(state.cells, [[0, 12], [1, 12]], 2)
    fill(state.cells, [[5, 12], [5, 13]], 1)
    fill(state.cells, [[6, 12]], 3)
    fill(state.cells, [[10, 0], [21, 20]], 3)
    state.total = countFilled(state.cells)
    state.goal = state.total
    const { events } = resolveShot(state, index(5, 11), RAINBOW, createRng(13))
    expect(events.popped).toHaveLength(3) // rainbow + two reds
  })

  it('a bomb pops everything within three cells and resets the meter', () => {
    const state = scenario()
    state.cells = new Int8Array(N).fill(1)
    state.cells[index(10, 10)] = EMPTY
    state.total = countFilled(state.cells)
    state.goal = state.total
    state.meter = METER_SLOTS
    state.hand = { cur: BOMB, next: 1 }
    const { state: after, events } = resolveShot(state, index(10, 10), BOMB, createRng(14))
    expect(events.bombFired).toBe(true)
    expect(events.popped).toHaveLength(36) // 37 cells in the blast, minus the empty landing cell
    expect(after.meter).toBe(0)
  })

  it('turns the shooter bubble into a bomb when the meter fills', () => {
    const state = scenario()
    state.meter = METER_SLOTS - 1
    const { state: after, events } = resolveShot(state, index(4, 12), 1, createRng(15))
    expect(after.meter).toBe(METER_SLOTS)
    expect(after.hand.cur).toBe(BOMB)
    expect(events.bombLoaded).toBe(true)
  })

  it('creeps the field in after enough shots without a pop', () => {
    let state = newLevel(1, createRng(16))
    const rng = createRng(17)
    const before = countFilled(state.cells)
    let creeped = false
    for (let k = 0; k < state.params.creepEvery; k++) {
      // a shot that cannot match: drop a bubble of a colour into an isolated empty cell of the hole edge
      const edge = [...Array(N).keys()].find(i => state.cells[i] === EMPTY && NEIGHBORS[i].every(n => state.cells[n] !== state.hand.cur))
      const res = resolveShot(state, edge, state.hand.cur, rng)
      state = res.state
      if (res.events.creepAdded.length) creeped = true
      if (state.status !== 'playing') break
    }
    expect(creeped || state.status === 'over').toBe(true)
    expect(countFilled(state.cells)).toBeGreaterThan(before)
  })
})

describe('pressure and game over', () => {
  it('creep adds one layer around the open space and shrinks the hole', () => {
    const cells = generateField(levelParams(1), createRng(18))
    const openBefore = openSpace(cells).reduce((a, b) => a + b, 0)
    const { cells: grown, added } = creep(cells, createRng(19), 3)
    const openAfter = openSpace(grown).reduce((a, b) => a + b, 0)
    expect(added.length).toBeGreaterThan(10)
    expect(openAfter).toBeLessThan(openBefore)
    for (const i of added) expect(cells[i]).toBe(EMPTY)
    // colours used for new bubbles already exist on the field
    const present = new Set(presentColors(cells))
    for (const i of added) expect(present.has(grown[i])).toBe(true)
  })

  it('is game over the moment a bubble touches the shooter ring', () => {
    const cells = blank()
    expect(touchesRing(cells)).toBe(false)
    const centre = nearestCell(CX, CY)
    expect(touchesRing(Object.assign(blank(), { [centre]: 1 }))).toBe(true)
    // a bubble just outside the ring distance is fine; one just inside is not
    const far = [...Array(N).keys()].filter(i => CELL_DIST[i] > RING_R + D / 2 + 2).sort((a, b) => CELL_DIST[a] - CELL_DIST[b])[0]
    const near = [...Array(N).keys()].filter(i => CELL_DIST[i] < RING_R + D / 2 - 2).sort((a, b) => CELL_DIST[b] - CELL_DIST[a])[0]
    expect(touchesRing(Object.assign(blank(), { [far]: 1 }))).toBe(false)
    expect(touchesRing(Object.assign(blank(), { [near]: 1 }))).toBe(true)
  })

  it('resolveShot ends the game when a landed or creeping bubble reaches the ring', () => {
    const state = newLevel(1, createRng(20))
    const near = [...Array(N).keys()].filter(i => state.cells[i] === EMPTY && CELL_DIST[i] < RING_R + D / 2 - 2)[0]
    expect(near).toBeDefined()
    const { state: after } = resolveShot(state, near, state.hand.cur === RAINBOW ? 1 : state.hand.cur, createRng(21))
    // landing next to nothing of its colour: no pop, and the bubble touches the ring
    expect(after.status).toBe('over')
  })

  it('creeping can end the game on its own', () => {
    let state = newLevel(1, createRng(22))
    const rng = createRng(23)
    // keep creeping the field with misses far from the ring until it reaches the ring
    let over = false
    for (let k = 0; k < 40 && !over; k++) {
      const { cells } = creep(state.cells, rng, 3)
      state = { ...state, cells }
      over = touchesRing(state.cells)
    }
    expect(over).toBe(true)
  })

  it('wins when enough of the field is cleared, with stars by shots', () => {
    const state = scenario2()
    const { state: after } = resolveShot(state, index(4, 12), 1, createRng(24))
    expect(after.status).toBe('won')
    expect(after.stars).toBe(3)
    expect(starsFor(10, 10)).toBe(3)
    expect(starsFor(14, 10)).toBe(2)
    expect(starsFor(15, 10)).toBe(1)
  })
})

function scenario2() {
  const state = newLevel(1, createRng(30))
  state.cells = blank()
  fill(state.cells, [[0, 12], [1, 12]], 2)
  fill(state.cells, [[3, 12], [3, 13]], 1)
  fill(state.cells, [[10, 0], [21, 20]], 3)
  state.total = countFilled(state.cells)
  state.goal = 2
  state.par = 5
  return state
}

describe('physics', () => {
  it('flies in a straight line at a fixed speed', () => {
    const cells = blank()
    const { shot, hit } = stepShot(cells, makeShot(0), 0.1)
    expect(hit).toBe(-1)
    expect(shot.x).toBeCloseTo(CX + SPEED * 0.1, 0)
    expect(shot.y).toBeCloseTo(CY, 3)
  })

  it('bounces off the left and right walls', () => {
    const cells = blank()
    let shot = makeShot(0)
    for (let t = 0; t < 120; t++) shot = stepShot(cells, shot, 1 / 60).shot
    expect(shot.bounces).toBeGreaterThanOrEqual(1)
    expect(shot.x).toBeGreaterThanOrEqual(D / 2 - 0.01)
    expect(shot.x).toBeLessThanOrEqual(W - D / 2 + 0.01)
  })

  it('bounces off the top and bottom walls too', () => {
    const cells = blank()
    let shot = makeShot(-Math.PI / 2)
    let bounced = false
    for (let t = 0; t < 120; t++) {
      shot = stepShot(cells, shot, 1 / 60).shot
      if (shot.vy > 0) bounced = true
    }
    expect(bounced).toBe(true)
    expect(shot.y).toBeGreaterThanOrEqual(D / 2 - 0.01)
    expect(shot.y).toBeLessThanOrEqual(H - D / 2 + 0.01)
  })

  it('sticks to the first bubble it touches and snaps into a free cell next to it', () => {
    const cells = blank()
    const target = nearestCell(CX + 300, CY)
    cells[target] = 2
    let shot = makeShot(0)
    let hit = -1
    for (let t = 0; t < 120 && hit < 0; t++) ({ shot, hit } = stepShot(cells, shot, 1 / 120))
    expect(hit).toBe(target)
    const cell = snapCell(cells, shot.x, shot.y)
    expect(cells[cell]).toBe(EMPTY)
    expect(NEIGHBORS[target]).toContain(cell)
  })

  it('never tunnels through a bubble at high speed', () => {
    const cells = blank()
    const target = nearestCell(CX + 200, CY)
    cells[target] = 1
    const { hit } = stepShot(cells, makeShot(0), 0.5) // one big step
    expect(hit).toBe(target)
  })

  it('touching() only reports filled cells within reach', () => {
    const cells = blank()
    const i = nearestCell(500, 400)
    expect(touching(cells, CELL_X[i], CELL_Y[i])).toBe(-1)
    cells[i] = 3
    expect(touching(cells, CELL_X[i] + 5, CELL_Y[i])).toBe(i)
    expect(touching(cells, CELL_X[i] + D * 1.5, CELL_Y[i])).toBe(-1)
  })

  it('aim guide bounces and stops at the first bubble', () => {
    const empty = traceAim(blank(), 0, 2)
    expect(empty.length).toBeGreaterThan(20)
    const cells = blank()
    cells[nearestCell(CX + 200, CY)] = 1
    const stopped = traceAim(cells, 0, 2)
    expect(stopped.every(d => d.x < CX + 200)).toBe(true)
    // more bounces allowed means a longer guide
    expect(traceAim(blank(), 0.4, 3).length).toBeGreaterThanOrEqual(traceAim(blank(), 0.4, 1).length)
  })

  it('snapCell falls back to the nearest empty cell anywhere', () => {
    const cells = new Int8Array(N).fill(1)
    cells[index(9, 9)] = EMPTY
    expect(snapCell(cells, 5, 5)).toBe(index(9, 9))
    expect(cellY(9)).toBeGreaterThan(0)
  })
})
