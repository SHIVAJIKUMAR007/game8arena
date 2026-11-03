import { describe, expect, it } from 'vitest'
import { generateLevel } from './levelGenerator'
import { SPECIALS, freeArrows } from './specials'
import { createRng } from '../../platform/rng'

describe('special arrows', () => {
  it('only appear after level 20, in campaign mode', () => {
    for (const level of [1, 10, 20]) {
      expect(generateLevel({ level, seed: `arrow:L${level}` }).arrows.some(a => a.special)).toBe(false)
    }
    expect(generateLevel({ level: 21, seed: 'arrow:L21' }).arrows.filter(a => a.special === 'rainbow')).toHaveLength(1)
    expect(generateLevel({ level: 40, seed: 'arrow:L40' }).arrows.filter(a => a.special === 'rainbow')).toHaveLength(2)
    expect(generateLevel({ level: 30, seed: 'd', mode: 'daily' }).arrows.some(a => a.special)).toBe(false)
  })

  it('rainbow launches only arrows that are free right now', () => {
    const lv = generateLevel({ level: 25, seed: 'arrow:L25' })
    const rb = lv.arrows.find(a => a.special === 'rainbow')
    const rest = lv.arrows.filter(a => a !== rb)
    const [fx] = SPECIALS.rainbow.onLaunch({ arrow: rb, arrows: rest, cols: lv.cols, rows: lv.rows, level: 25, rng: createRng('x') })
    const free = new Set(freeArrows(rest, lv.cols, lv.rows).map(a => a.id))
    expect(fx.ids.length).toBeGreaterThan(0)
    expect(fx.ids.every(id => free.has(id))).toBe(true)
  })
})
