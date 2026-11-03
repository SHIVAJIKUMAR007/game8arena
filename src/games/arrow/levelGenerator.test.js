import { describe, expect, it } from 'vitest'
import { generateLevel, findBlocker } from './levelGenerator'
import { arrowCountFor } from './difficulty'

const gen = (level, mode = 'campaign', seed = `arrow:L${level}`) => generateLevel({ level, seed, mode })

function solvable({ arrows, cols, rows }) {
  let left = [...arrows]
  let progress = true
  while (left.length && progress) {
    progress = false
    const a = left.find(x => !findBlocker(x, left, cols, rows))
    if (a) { left = left.filter(x => x !== a); progress = true }
  }
  return left.length === 0
}

describe('difficulty curve', () => {
  it('adds 2 arrows per level up to 60', () => {
    expect(arrowCountFor(1)).toBe(6)
    expect(arrowCountFor(2)).toBe(8)
    expect(arrowCountFor(28)).toBe(60)
  })
  it('uses a seeded random count between 30 and 100 after the cap', () => {
    for (let l = 29; l < 200; l++) {
      const n = arrowCountFor(l)
      expect(n).toBeGreaterThanOrEqual(30)
      expect(n).toBeLessThanOrEqual(100)
      expect(arrowCountFor(l)).toBe(n) // stable for the same level
    }
  })
})

describe('level generation', () => {
  it('is deterministic for the same seed', () => {
    const strip = lv => lv.arrows.map(a => ({ cells: a.cells, dir: a.dir }))
    expect(strip(gen(12))).toEqual(strip(gen(12)))
    expect(strip(gen(12))).not.toEqual(strip(gen(13)))
  })

  it('is always solvable and hits the arrow target', () => {
    const levels = [1, 2, 3, 5, 10, 20, 28, 29, 35, 50, 75, 120]
    for (const level of levels) {
      for (let s = 0; s < 5; s++) {
        const lv = gen(level, 'campaign', `arrow:L${level}:${s}`)
        expect(lv.arrows.length).toBeGreaterThan(0)
        expect(solvable(lv)).toBe(true)
        // at least 90% of the requested count is placed; never more than requested
        expect(lv.arrows.length).toBeLessThanOrEqual(lv.target)
        expect(lv.arrows.length).toBeGreaterThanOrEqual(Math.floor(lv.target * 0.9))
      }
    }
  })

  it('daily levels are solvable and stable per date', () => {
    const a = gen(15, 'daily', 'arrow:daily:2026-11-03')
    const b = gen(15, 'daily', 'arrow:daily:2026-11-03')
    expect(a.arrows.map(x => x.dir)).toEqual(b.arrows.map(x => x.dir))
    expect(solvable(a)).toBe(true)
    expect(a.target).toBeGreaterThanOrEqual(25)
    expect(a.target).toBeLessThanOrEqual(70)
  })
})
