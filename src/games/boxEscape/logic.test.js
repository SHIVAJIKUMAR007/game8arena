import { describe, expect, it } from 'vitest'
import { deadSquares, generateLevel, hintFor, isDeadlock, isFrozen, isSolved, parse, pushesToMoves, solve, step, toRows, walkPath } from './logic'

const ROOM = [
  '#######',
  '#.  $ #',
  '# @   #',
  '#   $.#',
  '#######',
]

describe('parse / step', () => {
  it('round-trips the text format', () => {
    expect(toRows(parse(ROOM))).toEqual(ROOM)
  })

  it('walks, pushes, and refuses blocked pushes', () => {
    const p = parse(['#####', '#@$$#', '#   #', '#####'])
    expect(step(p, p.player, p.boxes, 'up')).toBeNull()        // wall
    expect(step(p, p.player, p.boxes, 'right')).toBeNull()     // two crates in a row
    const down = step(p, p.player, p.boxes, 'down')
    expect(down).toMatchObject({ player: p.player + p.w, pushed: -1 })
    const q = parse(['#####', '#@$ #', '#####'])
    const push = step(q, q.player, q.boxes, 'right')
    expect(push.pushed).toBe(0)
    expect(push.boxes[0]).toBe(q.boxes[0] + 1)
  })

  it('finds walking paths around crates', () => {
    const p = parse(['#####', '#@$ #', '#   #', '#####'])
    const path = walkPath(p, p.player, p.boxes[0] + 1, p.boxes)
    expect(path).toEqual(['down', 'right', 'right', 'up'])
    expect(walkPath(p, p.player, p.boxes[0], p.boxes)).toBeNull()
  })
})

describe('deadlocks', () => {
  it('marks corners without a target as dead', () => {
    const p = parse(ROOM)
    const dead = deadSquares(p)
    expect(dead[1 * p.w + 5]).toBe(true)   // top-right corner
    expect(dead[1 * p.w + 1]).toBe(false)  // target in a corner is fine
    expect(dead[2 * p.w + 3]).toBe(false)
  })

  it('detects a 2×2 jam with a crate off-target', () => {
    const p = parse(['######', '#    #', '# $$ #', '# $$ #', '#. ..#', '#@  .#', '######'])
    expect(isFrozen(p, p.boxes, p.boxes[0])).toBe(true)
    expect(isDeadlock(p, p.boxes, p.boxes[0])).toBe(true)
  })
})

describe('solver', () => {
  it('solves a small room optimally and the moves replay to a solved state', () => {
    const p = parse(ROOM)
    const pushes = solve(p, p.player, p.boxes)
    expect(pushes.length).toBe(4)
    let player = p.player, boxes = p.boxes
    for (const dir of pushesToMoves(p, p.player, p.boxes, pushes)) ({ player, boxes } = step(p, player, boxes, dir))
    expect(isSolved(p, boxes)).toBe(true)
  })

  it('reports unsolvable positions as null', () => {
    const p = parse(['#####', '#$ .#', '# @ #', '#####'])
    expect(solve(p, p.player, p.boxes)).toBeNull()
    expect(hintFor(p, p.player, p.boxes)).toBeNull()
  })

  it('hints the first push of a shortest solution', () => {
    const p = parse(['######', '#@$ .#', '######'])
    expect(hintFor(p, p.player, p.boxes)).toEqual({ box: p.boxes[0], dir: 'right', stand: p.player, left: 2 })
  })
})

describe('generator', () => {
  it('is deterministic and every level is solvable at exactly par', () => {
    for (const level of [1, 2, 4, 6, 8]) {
      const p = generateLevel(`test:L${level}`, level)
      expect(generateLevel(`test:L${level}`, level)).toBe(p)
      expect(p.boxes.length).toBe(p.targets.length)
      expect(p.boxes.some(b => p.targets.includes(b))).toBe(false)
      expect(p.par).toBeGreaterThan(0)
      expect(solve(p, p.player, p.boxes).length).toBe(p.par)
    }
  })

  it('grows harder with the level', () => {
    expect(generateLevel('test:L1', 1).boxes.length).toBe(1)
    expect(generateLevel('test:L8', 8).boxes.length).toBe(4)
  })
})
