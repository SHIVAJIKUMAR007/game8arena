import { describe, expect, it } from 'vitest'
import { ARENAS, ARENA_ORDER, H, WEAPONS, WEAPON_ORDER, W } from './data'
import { DT, MATCH_TIME, NEUTRAL, createMatch, spikeActive, step } from './sim'

const duel = (over = {}) =>
  createMatch({ arenaId: 'floating', variant: 0, fighters: [{ name: 'A', weapon: 'sword' }, { name: 'B', weapon: 'sword' }], ...over })
const run = (m, n, inputs = []) => {
  for (let i = 0; i < n; i++) step(m, inputs)
}
const tap = (k, extra = {}) => ({ ...NEUTRAL, [k]: true, ...extra })
// put B right in front of A on the same platform, both settled on the ground
function faceOff(weapon = 'sword', gap = 60) {
  const m = createMatch({ arenaId: 'floating', variant: 0, fighters: [{ name: 'A', weapon }, { name: 'B', weapon: 'sword' }] })
  const [a, b] = m.fighters
  a.x = 450; a.y = 470
  b.x = 450 + gap; b.y = 470
  b.face = -1
  run(m, 10)
  return { m, a, b }
}
const clearEvents = m => (m.events.length = 0)

describe('physics', () => {
  it('lands on the platform under each spawn and stays there', () => {
    const m = duel()
    run(m, 60)
    for (const f of m.fighters) {
      expect(f.onGround).toBe(true)
      expect(f.y).toBeCloseTo(f.spawn.y, 3)
    }
  })

  it('jumps, double jumps once, then cannot jump again until landing', () => {
    const m = duel()
    run(m, 30)
    const a = m.fighters[0]
    step(m, [tap('jump')])
    expect(a.vy).toBeLessThan(0)
    run(m, 10)
    step(m, [tap('jump')])
    expect(m.events.some(e => e.type === 'djump')).toBe(true)
    clearEvents(m)
    const vy = a.vy
    run(m, 5)
    step(m, [tap('jump')]) // no third jump
    expect(m.events.some(e => e.type === 'djump')).toBe(false)
    expect(a.vy).toBeGreaterThan(vy)
    run(m, 200)
    expect(a.onGround).toBe(true)
  })

  it('cannot pass through a platform from any side, even at full fall speed', () => {
    const m = duel()
    const a = m.fighters[0]
    const p = m.plats[0]
    a.x = p.x + 30 // clear of the platform above
    a.y = p.y - 400
    a.vy = 1400
    run(m, 120)
    expect(a.y).toBeCloseTo(p.y, 3)
    // walk into the side of the big platform from the gap: blocked
    const b = m.fighters[1]
    b.x = p.x - 80
    b.y = p.y + 30 // below the top surface, beside the block
    b.vy = 0
    b.vx = 0
    for (let i = 0; i < 20; i++) {
      step(m, [NEUTRAL, tap('right')])
      b.vy = -GRAV_HOLD // hover beside the wall
      expect(b.x + b.w / 2).toBeLessThanOrEqual(p.x + 0.001)
    }
  })

  it('bumps its head on the underside of a platform', () => {
    const m = duel()
    const a = m.fighters[0]
    const p = m.plats[0]
    a.x = p.x + p.w / 2
    a.y = p.y + p.h + a.h + 60
    a.vy = -900
    a.onGround = false
    run(m, 20)
    expect(a.y - a.h).toBeGreaterThanOrEqual(p.y + p.h - 0.001)
  })

  it('falling out costs health and respawns on the spawn point with a moment of protection', () => {
    const m = duel()
    run(m, 30)
    const a = m.fighters[0]
    a.x = 640
    a.y = m.pit.y + 10
    step(m, [])
    expect(m.events.some(e => e.type === 'out')).toBe(true)
    expect(a.hp).toBe(100 - m.pit.damage)
    expect(a.x).toBe(a.spawn.x)
    expect(a.invuln).toBeGreaterThan(1)
    expect(m.status).toBe('fight')
  })

  it('knocks the fighter out of the match when the fall takes the last health', () => {
    const m = duel()
    const a = m.fighters[0]
    a.hp = 10
    a.y = m.pit.y + 10
    step(m, [])
    expect(m.status).toBe('over')
    expect(m.winner).toBe(1)
  })

  it('ice makes fighters slide further than on normal ground', () => {
    const slide = arenaId => {
      const m = createMatch({ arenaId, variant: 0, fighters: [{ weapon: 'sword' }, { weapon: 'sword' }] })
      run(m, 40)
      const a = m.fighters[0]
      for (let i = 0; i < 20; i++) step(m, [tap('right')])
      const x0 = a.x
      run(m, 30)
      return a.x - x0
    }
    expect(slide('ice')).toBeGreaterThan(slide('floating') + 10)
  })
})

const GRAV_HOLD = 2300 * DT

describe('combat', () => {
  it('a swing that connects hurts once, even though the hit box stays on the target', () => {
    const { m, a, b } = faceOff('sword', 60)
    step(m, [tap('attack')])
    run(m, 40)
    const hits = m.events.filter(e => e.type === 'hit')
    expect(hits).toHaveLength(1)
    expect(b.hp).toBe(100 - WEAPONS.sword.damage)
    expect(a.stats.hits).toBe(1)
  })

  it('a swing that misses does no damage', () => {
    const { m, b } = faceOff('sword', 300)
    step(m, [tap('attack')])
    run(m, 40)
    expect(b.hp).toBe(100)
    expect(m.events.some(e => e.type === 'hit')).toBe(false)
  })

  it('does not hit a target behind the attacker', () => {
    const { m, a, b } = faceOff('sword', 60)
    a.x = 640
    b.x = 580 // behind A, who faces right
    step(m, [tap('attack')])
    run(m, 40)
    expect(b.hp).toBe(100)
  })

  it('a second swing can hit again', () => {
    const { m, b } = faceOff('dual', 50)
    step(m, [tap('attack')])
    run(m, 30)
    step(m, [NEUTRAL])
    step(m, [tap('attack')])
    run(m, 30)
    expect(b.hp).toBeLessThan(100 - WEAPONS.dual.damage)
  })

  it('knockback pushes the target away and into the air', () => {
    const { m, a, b } = faceOff('hammer', 60)
    step(m, [tap('attack')])
    for (let i = 0; i < 60 && b.hurt <= 0; i++) step(m, [])
    expect(b.vx).toBeGreaterThan(200)
    expect(b.vy).toBeLessThan(0)
    expect(b.x).toBeGreaterThan(a.x)
  })

  it('blocking facing the attacker cuts damage and stops the hit stun', () => {
    const { m, b } = faceOff('sword', 60)
    step(m, [tap('attack'), tap('block')])
    run(m, 40, [NEUTRAL, tap('block')])
    expect(b.hp).toBeGreaterThan(95)
    expect(b.hp).toBeLessThan(100)
    expect(m.events.some(e => e.type === 'block')).toBe(true)
    expect(b.hurt).toBe(0)
  })

  it('blocking from behind does not help', () => {
    const { m, b } = faceOff('sword', 60)
    b.face = 1 // looking away
    step(m, [tap('attack'), tap('block')])
    run(m, 40, [NEUTRAL, tap('block')])
    expect(b.hp).toBe(100 - WEAPONS.sword.damage)
  })

  it('breaking the guard stuns the blocker', () => {
    const { m, b } = faceOff('sword', 60)
    b.guard = 3
    step(m, [tap('attack'), tap('block')])
    run(m, 40, [NEUTRAL, tap('block')])
    expect(m.events.some(e => e.type === 'guardbreak')).toBe(true)
    expect(b.guardBreak).toBeGreaterThan(0)
  })

  it('no one can hit a respawning fighter', () => {
    const { m, b } = faceOff('sword', 60)
    b.invuln = 2
    step(m, [tap('attack')])
    run(m, 40)
    expect(b.hp).toBe(100)
  })

  it('a knockout ends the match and names the winner', () => {
    const { m, a, b } = faceOff('sword', 60)
    b.hp = 5
    step(m, [tap('attack')])
    run(m, 40)
    expect(m.status).toBe('over')
    expect(m.winner).toBe(a.id)
    expect(b.state).toBe('dead')
    expect(m.reason).toBe('ko')
  })

  it('damage is scaled by the attacker multiplier', () => {
    const m = createMatch({ arenaId: 'floating', variant: 0, fighters: [{ weapon: 'sword', dmgMult: 2 }, { weapon: 'sword' }] })
    const [a, b] = m.fighters
    a.x = 600; a.y = 470; b.x = 660; b.y = 470
    run(m, 10)
    step(m, [tap('attack')])
    run(m, 40)
    expect(b.hp).toBe(100 - WEAPONS.sword.damage * 2)
  })

  it('the time limit decides by remaining health, or a draw', () => {
    const m = duel()
    m.t = MATCH_TIME - DT / 2
    m.fighters[1].hp = 40
    step(m, [])
    expect(m.status).toBe('over')
    expect(m.reason).toBe('time')
    expect(m.winner).toBe(0)
    const d = duel()
    d.t = MATCH_TIME
    step(d, [])
    expect(d.winner).toBe(-1)
  })

  it('stops taking input once the match is over', () => {
    const m = duel()
    run(m, 30)
    m.status = 'over'
    const x = m.fighters[0].x
    run(m, 30, [tap('right')])
    expect(m.fighters[0].x).toBeCloseTo(x, 3)
  })
})

describe('projectiles and specials', () => {
  it('a bow fires an arrow that hits from a distance, once', () => {
    const { m, b } = faceOff('bow', 350)
    step(m, [tap('attack')])
    run(m, 60)
    expect(b.hp).toBe(100 - WEAPONS.bow.damage)
    expect(m.projectiles).toHaveLength(0)
  })

  it('arrows stop at platforms', () => {
    const { m, b } = faceOff('bow', 350)
    b.y = 470 - 400 // out of the line of fire
    b.x = 1100
    step(m, [tap('attack')])
    run(m, 120)
    expect(m.projectiles).toHaveLength(0)
    expect(b.hp).toBe(100)
  })

  it('every weapon special starts, honours its cooldown and ends', () => {
    for (const id of WEAPON_ORDER) {
      const { m, a } = faceOff(id, 90)
      a.cdSpec = 0
      step(m, [tap('special')])
      expect(a.spec, id).toBeTruthy()
      expect(a.cdSpec, id).toBeGreaterThan(5)
      run(m, 150)
      expect(a.spec, id).toBeNull()
      const before = a.cdSpec
      step(m, [NEUTRAL])
      step(m, [tap('special')])
      expect(a.spec, `${id} on cooldown`).toBeNull()
      expect(a.cdSpec).toBeLessThanOrEqual(before)
    }
  })

  it('energy wave pierces and hurts', () => {
    const { m, b } = faceOff('sword', 300)
    m.fighters[0].cdSpec = 0
    step(m, [tap('special')])
    run(m, 70)
    expect(b.hp).toBeLessThan(100)
  })

  it('thunder strike lands on the target after its warning', () => {
    const { m, b } = faceOff('spear', 300)
    m.fighters[0].cdSpec = 0
    step(m, [tap('special')])
    run(m, 20)
    expect(m.bolts.length).toBe(1)
    expect(b.hp).toBe(100)
    run(m, 60)
    expect(m.events.some(e => e.type === 'bolt')).toBe(true)
    expect(b.hp).toBeLessThan(100)
  })

  it('ground smash hurts a grounded foe nearby but can be jumped', () => {
    const grounded = faceOff('hammer', 100)
    grounded.a.cdSpec = 0
    step(grounded.m, [tap('special')])
    run(grounded.m, 100)
    expect(grounded.b.hp).toBeLessThan(100)

    const airborne = faceOff('hammer', 100)
    airborne.a.cdSpec = 0
    airborne.b.y = airborne.a.y - 200
    airborne.b.vy = -10
    step(airborne.m, [tap('special')])
    for (let i = 0; i < 100; i++) {
      airborne.b.y = Math.min(airborne.b.y, airborne.a.y - 200)
      airborne.b.vy = 0
      step(airborne.m, [])
    }
    expect(airborne.b.hp).toBe(100)
  })

  it('iron guard blocks everything for its duration', () => {
    const { m, a, b } = faceOff('axe', 60)
    void a
    // B is the one with the axe special here: give B an axe
    b.weapon = 'axe'
    b.cdSpec = 0
    step(m, [NEUTRAL, tap('special')])
    run(m, 20, [NEUTRAL])
    expect(b.shield).toBeGreaterThan(2)
    step(m, [tap('attack')])
    run(m, 40)
    expect(b.hp).toBe(100)
  })

  it('dash slash passes through the target for damage and cannot hit it twice', () => {
    const { m, b } = faceOff('katana', 150)
    m.fighters[0].cdSpec = 0
    step(m, [tap('special')])
    run(m, 30)
    expect(b.hp).toBe(100 - WEAPONS.katana.special.damage)
  })

  it('spin storm hits repeatedly', () => {
    const { m, b } = faceOff('dual', 60)
    m.fighters[0].cdSpec = 0
    b.tough = 0
    step(m, [tap('special')])
    let hits = 0
    for (let i = 0; i < 90; i++) {
      step(m, [])
      hits += m.events.filter(e => e.type === 'hit').length
      clearEvents(m)
    }
    expect(hits).toBeGreaterThan(1)
  })
})

describe('hazards and arenas', () => {
  it('spikes hurt once per touch and launch the fighter', () => {
    const m = createMatch({ arenaId: 'forest', variant: 0, fighters: [{ weapon: 'sword' }, { weapon: 'sword' }] })
    const s = m.spikes[0]
    const a = m.fighters[0]
    a.x = s.x + s.w / 2
    a.y = s.y + s.h
    step(m, [])
    expect(a.hp).toBe(92)
    expect(a.vy).toBeLessThan(0)
    step(m, [])
    expect(a.hp).toBe(92)
  })

  it('timed fire jets are only dangerous while flaring', () => {
    const s = { x: 0, y: 0, w: 10, h: 10, period: 4 }
    expect(spikeActive(s, 0.5)).toBe(false)
    expect(spikeActive(s, 3)).toBe(true)
    expect(spikeActive({ x: 0, y: 0, w: 1, h: 1 }, 1)).toBe(true)
  })

  it('moving platforms carry the fighter standing on them', () => {
    const m = createMatch({ arenaId: 'sky', variant: 0, fighters: [{ weapon: 'sword' }, { weapon: 'sword' }] })
    const idx = m.plats.findIndex(p => p.move)
    const p = m.plats[idx]
    const a = m.fighters[0]
    a.x = p.x + p.w / 2
    a.y = p.y - 5
    run(m, 5)
    expect(a.platform).toBe(idx)
    const x0 = a.x
    const px0 = p.x
    run(m, 60)
    expect(p.x).not.toBeCloseTo(px0, 1)
    expect(a.x - x0).toBeCloseTo(p.x - px0, 0)
  })

  it('has six themed arenas with two layouts, a hazard, and spawns standing on a platform', () => {
    expect(ARENA_ORDER).toHaveLength(6)
    for (const id of ARENA_ORDER) {
      const arena = ARENAS[id]
      expect(arena.layouts, id).toHaveLength(2)
      expect(arena.hazard, id).toBeTruthy()
      for (const layout of arena.layouts) {
        expect(layout.spawns).toHaveLength(2)
        for (const sp of layout.spawns) {
          const on = layout.platforms.some(p => sp.y === p.y && sp.x > p.x + 17 && sp.x < p.x + p.w - 17 && !p.move)
          expect(on, `${id} spawn ${sp.x},${sp.y}`).toBe(true)
          // not standing in a spike
          expect(layout.spikes.some(s => sp.x + 17 > s.x && sp.x - 17 < s.x + s.w && sp.y > s.y && sp.y - 90 < s.y + s.h), `${id} spike on spawn`).toBe(false)
        }
        for (const p of layout.platforms) {
          expect(p.h).toBeGreaterThanOrEqual(40) // thick enough that nothing can fall through in one step
          expect(p.x + (p.move ? -p.move.range : 0)).toBeGreaterThanOrEqual(-10)
          expect(p.x + p.w + (p.move ? p.move.range : 0)).toBeLessThanOrEqual(W + 10)
          expect(p.y + p.h).toBeLessThan(H)
        }
      }
    }
  })

  it('every platform in every layout can be reached by jumping from the spawn', () => {
    // a platform is a step away if the gap is within a double-jump's reach and it is not too high above
    const MAX_GAP = 230
    const MAX_UP = 180
    for (const id of ARENA_ORDER) {
      for (const layout of ARENAS[id].layouts) {
        const nodes = layout.platforms.map(p => ({ x0: p.x - (p.move?.range || 0), x1: p.x + p.w + (p.move?.range || 0), top: p.y }))
        const seen = new Set()
        const start = layout.platforms.findIndex(p => layout.spawns[0].y === p.y && layout.spawns[0].x >= p.x && layout.spawns[0].x <= p.x + p.w)
        const queue = [start]
        while (queue.length) {
          const i = queue.pop()
          if (seen.has(i)) continue
          seen.add(i)
          nodes.forEach((n, j) => {
            const gap = Math.max(0, n.x0 - nodes[i].x1, nodes[i].x0 - n.x1)
            if (gap <= MAX_GAP && n.top >= nodes[i].top - MAX_UP) queue.push(j)
          })
        }
        expect(seen.size, `${id} layout reachability`).toBe(nodes.length)
        const second = layout.platforms.findIndex(p => layout.spawns[1].y === p.y && layout.spawns[1].x >= p.x && layout.spawns[1].x <= p.x + p.w)
        expect(seen.has(second), `${id} spawns connected`).toBe(true)
      }
    }
  })
})
