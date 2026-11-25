import { describe, expect, it } from 'vitest'
import { createRng } from '../../platform/rng'
import { createAI, aiParams } from './ai'
import { ARENA_ORDER, WEAPON_ORDER } from './data'
import { DT, MATCH_TIME, NEUTRAL, createMatch, step } from './sim'

// Plays a whole fight with no browser: fighter 0 gets `p0(m, dt)` as its input, fighter 1 is an AI.
function fight({ arenaId = 'floating', variant = 0, w0 = 'sword', w1 = 'sword', skill = 0.5, p0, maxSeconds = MATCH_TIME + 5, seed = 'x' }) {
  const m = createMatch({ arenaId, variant, fighters: [{ weapon: w0 }, { weapon: w1, isAI: true }] })
  const ai = createAI(skill, createRng(seed))
  const steps = Math.ceil(maxSeconds / DT)
  for (let i = 0; i < steps && m.status === 'fight'; i++) {
    m.events.length = 0
    step(m, [p0 ? p0(m, DT) : NEUTRAL, ai.think(m, 1, DT)])
  }
  return m
}

describe('AI', () => {
  it('gets sharper as skill rises, within sane limits', () => {
    const lo = aiParams(0)
    const hi = aiParams(1)
    expect(hi.reaction).toBeLessThan(lo.reaction)
    expect(hi.reaction).toBeGreaterThan(0.05)
    expect(hi.aggression).toBeGreaterThan(lo.aggression)
    expect(hi.block).toBeGreaterThan(lo.block)
    expect(hi.block).toBeLessThanOrEqual(0.6)
    expect(aiParams(5).reaction).toBe(hi.reaction) // out-of-range skill is clamped
  })

  it('beats a player who stands still, with every weapon, on every arena', () => {
    for (const w of WEAPON_ORDER) {
      const arenaId = ARENA_ORDER[WEAPON_ORDER.indexOf(w) % ARENA_ORDER.length]
      const m = fight({ arenaId, variant: 0, w1: w, skill: 0.8 })
      expect(m.status, `${w} on ${arenaId}`).toBe('over')
      expect(m.winner, `${w} on ${arenaId}`).toBe(1)
    }
  })

  it('can walk, jump and drop its way to a still foe in every layout, starting from either side', () => {
    for (const id of ARENA_ORDER) {
      for (const variant of [0, 1]) {
        for (const mover of [0, 1]) {
          const m = createMatch({ arenaId: id, variant, fighters: [{ weapon: 'sword' }, { weapon: 'sword' }] })
          const ai = createAI(0.8, createRng('cross'))
          let closest = Infinity
          for (let i = 0; i < 60 * 30 && m.status === 'fight'; i++) {
            m.events.length = 0
            const inputs = [NEUTRAL, NEUTRAL]
            inputs[mover] = ai.think(m, mover, DT)
            step(m, inputs)
            closest = Math.min(closest, Math.hypot(m.fighters[0].x - m.fighters[1].x, m.fighters[0].y - m.fighters[1].y))
          }
          expect(closest, `${id} layout ${variant}, fighter ${mover} moving`).toBeLessThan(150)
        }
      }
    }
  })

  it('is deterministic: same seed, same fight', () => {
    const a = fight({ skill: 0.6, seed: 's1' })
    const b = fight({ skill: 0.6, seed: 's1' })
    expect(a.t).toBe(b.t)
    expect(a.fighters[0].hp).toBe(b.fighters[0].hp)
  })

  it('a stronger AI deals more damage to a passive target than a weaker one', () => {
    const dmg = skill => fight({ skill, maxSeconds: 20 }).fighters[1].stats.dealt
    expect(dmg(0.95)).toBeGreaterThan(dmg(0.05))
  })

  it('blocking really does reduce the damage the AI deals', () => {
    const taken = p0 => fight({ skill: 0.9, maxSeconds: 8, p0 }).fighters[0].stats.taken
    const idle = taken(null)
    const blocking = taken(() => ({ ...NEUTRAL, block: true }))
    expect(idle).toBeGreaterThan(0)
    expect(blocking).toBeLessThan(idle)
  })

  it('does not keep walking itself off the map on a small arena', () => {
    const m = createMatch({ arenaId: 'sky', variant: 1, fighters: [{ weapon: 'bow' }, { weapon: 'bow', isAI: true }] })
    const ai = createAI(0.9, createRng('edge'))
    let outs = 0
    for (let i = 0; i < 60 * 20 && m.status === 'fight'; i++) {
      step(m, [NEUTRAL, ai.think(m, 1, DT)])
      outs += m.events.filter(e => e.type === 'out' && e.id === 1).length
      m.events.length = 0
    }
    expect(outs).toBeLessThanOrEqual(1)
  })
})
