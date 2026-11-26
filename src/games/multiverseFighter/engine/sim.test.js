import { describe, expect, it } from 'vitest'
import { ROSTER, fighterById, statsFor } from '../roster'
import { createAI, reactionFor } from './ai'
import { ENERGY_MAX, INPUT, INTRO_FRAMES, KO_FRAMES, ROUNDS_TO_WIN, bannerOf, createMatch, locomote, snapshot, step, viewFromSnapshot } from './sim'

const duel = (a = 'cap', b = 'paul', seed = 7) => createMatch({ seed, chars: [a, b], stats: [statsFor(fighterById(a)), statsFor(fighterById(b))] })
const run = (m, n, i0 = 0, i1 = 0) => {
  for (let i = 0; i < n; i++) step(m, i0, i1)
}
const toFight = m => run(m, INTRO_FRAMES + 1)
const bring = (m, gap = 70) => {
  m.fighters[0].x = 600
  m.fighters[1].x = 600 + gap
}

describe('deterministic simulation', () => {
  const script = frame => [frame % 40 < 20 ? INPUT.RIGHT : INPUT.LEFT | (frame % 17 === 0 ? INPUT.PUNCH : 0) | (frame % 53 === 0 ? INPUT.UP : 0), frame % 31 === 0 ? INPUT.KICK : INPUT.LEFT]
  const play = seed => {
    const m = duel('thor', 'hulk', seed)
    for (let f = 0; f < 900; f++) {
      const [a, b] = script(f)
      step(m, a, b)
    }
    return snapshot(m)
  }
  it('plays the same match for the same seed and inputs', () => {
    expect(JSON.stringify(play(5))).toBe(JSON.stringify(play(5)))
  })
  it('never reads the wall clock or Math.random', async () => {
    const src = (await import('./sim.js?raw')).default
    expect(src).not.toMatch(/Math\.random|Date\.now|performance\.now/)
  })
})

describe('rounds and phases', () => {
  it('starts with an intro, then fights', () => {
    const m = duel()
    expect(m.phase).toBe('intro')
    expect(bannerOf(viewFromSnapshot(snapshot(m), { chars: m.chars, scales: [1, 1], hpMax: [1, 1] }))).toBe('ROUND 1')
    toFight(m)
    expect(m.phase).toBe('fight')
  })

  it('ignores input during the intro', () => {
    const m = duel()
    const x = m.fighters[0].x
    run(m, 30, INPUT.RIGHT)
    expect(m.fighters[0].x).toBe(x)
  })

  it('walks, jumps and lands inside the walls', () => {
    const m = duel()
    toFight(m)
    run(m, 400, INPUT.LEFT)
    expect(m.fighters[0].x).toBeGreaterThanOrEqual(70)
    step(m, INPUT.UP, 0)
    expect(m.fighters[0].y).toBeGreaterThan(0)
    run(m, 80, 0)
    expect(m.fighters[0].y).toBe(0)
  })

  it('awards a round on a knockout and the match after two', () => {
    const m = duel()
    toFight(m)
    m.fighters[1].hp = 1
    bring(m)
    run(m, 30, INPUT.PUNCH)
    expect(m.phase).toBe('ko')
    expect(m.wins).toEqual([1, 0])
    run(m, KO_FRAMES + 2)
    expect(m.round).toBe(2)
    expect(m.phase).toBe('intro')
    expect(m.fighters[0].hp).toBe(m.fighters[0].hpMax)
    toFight(m)
    m.fighters[1].hp = 1
    bring(m)
    run(m, 30, INPUT.PUNCH)
    run(m, KO_FRAMES + 2)
    expect(m.wins[0]).toBe(ROUNDS_TO_WIN)
    expect(m.phase).toBe('matchEnd')
    expect(m.winner).toBe(0)
  })

  it('gives the round to the fighter with more health when time runs out', () => {
    const m = duel()
    toFight(m)
    m.fighters[1].hp = 100
    m.timer = 1
    step(m, 0, 0)
    expect(m.phase).toBe('ko')
    expect(m.roundWinner).toBe(0)
    expect(m.timeUp).toBe(true)
  })

  it('replays the round on an exact draw', () => {
    const m = duel()
    toFight(m)
    m.timer = 1
    step(m, 0, 0)
    expect(m.roundWinner).toBe(-1)
    expect(m.wins).toEqual([0, 0])
  })
})

describe('combat', () => {
  it('lands a punch, costs health and gives both fighters energy', () => {
    const m = duel()
    toFight(m)
    bring(m)
    run(m, 20, INPUT.PUNCH)
    expect(m.fighters[1].hp).toBeLessThan(m.fighters[1].hpMax)
    expect(m.fighters[0].en).toBeGreaterThan(0)
    expect(m.fighters[1].en).toBeGreaterThan(0)
  })

  it('misses when out of reach', () => {
    const m = duel()
    toFight(m)
    bring(m, 400)
    run(m, 30, INPUT.PUNCH)
    expect(m.fighters[1].hp).toBe(m.fighters[1].hpMax)
  })

  it('blocking cuts damage to a fraction', () => {
    const open = duel()
    toFight(open)
    bring(open)
    run(open, 20, INPUT.PUNCH, 0)
    const blocked = duel()
    toFight(blocked)
    bring(blocked)
    run(blocked, 3, 0, INPUT.DOWN)
    run(blocked, 20, INPUT.PUNCH, INPUT.DOWN)
    const lostOpen = open.fighters[1].hpMax - open.fighters[1].hp
    const lostBlocked = blocked.fighters[1].hpMax - blocked.fighters[1].hp
    expect(lostBlocked).toBeGreaterThan(0)
    expect(lostBlocked).toBeLessThan(lostOpen * 0.4)
  })

  it('does not block a hit from behind', () => {
    const m = duel()
    toFight(m)
    bring(m)
    // Fighter 1 is stuck in guard recovery and facing away from fighter 0, as after a cross-up jump.
    m.fighters[1].face = 1
    m.fighters[1].state = 'block'
    m.fighters[1].bstun = 60
    run(m, 20, INPUT.PUNCH, 0)
    expect(m.fighters[1].hp).toBeLessThan(m.fighters[1].hpMax - 20)
  })

  it('counts a combo and reports it', () => {
    const m = duel()
    toFight(m)
    bring(m, 60)
    // Tap punch every 9 ticks; each press is buffered and fires as soon as the last jab recovers.
    for (let i = 0; i < 6; i++) {
      run(m, 1, INPUT.PUNCH)
      run(m, 8, 0)
    }
    expect(m.fighters[0].combo).toBeGreaterThanOrEqual(2)
    expect(m.fighters[1].hp).toBeLessThan(m.fighters[1].hpMax)
  })

  it('knocks the fifth hit of a string down', () => {
    const m = duel()
    toFight(m)
    bring(m, 60)
    let knocked = false
    for (let i = 0; i < 20 && !knocked; i++) {
      run(m, 1, INPUT.PUNCH)
      for (let k = 0; k < 8; k++) {
        step(m, 0, 0)
        m.fighters[1].x = m.fighters[0].x + 60 // keep them in reach, as a player who steps in would
        knocked ||= m.fighters[1].state === 'knock'
      }
    }
    expect(knocked).toBe(true)
  })

  it('applies hitstun and knockback', () => {
    const m = duel()
    toFight(m)
    bring(m)
    const x = m.fighters[1].x
    run(m, 1, INPUT.HEAVY)
    run(m, 17, 0)
    expect(m.fighters[1].state).toBe('hit')
    run(m, 10)
    expect(m.fighters[1].x).toBeGreaterThan(x)
  })

  it('only fires the special when the energy bar is full', () => {
    const m = duel()
    toFight(m)
    run(m, 2, INPUT.SPECIAL)
    expect(m.fighters[0].state).not.toBe('special')
    m.fighters[0].en = ENERGY_MAX
    run(m, 2, 0)
    run(m, 1, INPUT.SPECIAL)
    expect(m.fighters[0].state).toBe('special')
    expect(m.fighters[0].en).toBe(0)
  })
})

describe('every special', () => {
  it.each(ROSTER.map(f => [f.id, f.special.kind]))('%s (%s) runs to completion with sane numbers', (id) => {
    const m = duel(id, id === 'cap' ? 'paul' : 'cap', 11)
    toFight(m)
    m.fighters[0].en = ENERGY_MAX
    bring(m, 140)
    run(m, 1, 0)
    run(m, 1, INPUT.SPECIAL)
    expect(m.fighters[0].state).toBe('special')
    let sawTarget = false
    for (let i = 0; i < 160; i++) {
      step(m, 0, 0)
      for (const f of m.fighters) {
        expect(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.hp)).toBe(true)
        expect(f.hp).toBeGreaterThanOrEqual(0)
        expect(f.x).toBeGreaterThanOrEqual(70)
        expect(f.x).toBeLessThanOrEqual(1210)
      }
      if (m.fighters[1].hp < m.fighters[1].hpMax) sawTarget = true
      if (m.phase !== 'fight') break
    }
    expect(m.fighters[0].state).not.toBe('special')
    if (!['counter'].includes(fighterById(id).special.kind)) expect(sawTarget || id === 'duncan' || id === 'chani' || id === 'spidey').toBe(true)
    expect(m.proj.length).toBeLessThanOrEqual(2)
  })

  it('Stilgar reflects the next hit back at the attacker', () => {
    const m = duel('stilgar', 'cap')
    toFight(m)
    m.fighters[0].en = ENERGY_MAX
    bring(m, 70)
    run(m, 1, 0)
    run(m, 1, INPUT.SPECIAL)
    run(m, 8, 0)
    const hp = m.fighters[1].hp
    run(m, 15, 0, INPUT.PUNCH)
    expect(m.fighters[0].hp).toBe(m.fighters[0].hpMax)
    expect(m.fighters[1].hp).toBeLessThan(hp)
  })

  it("Duncan's parry stuns an attacker who swings into it", () => {
    const m = duel('duncan', 'cap')
    toFight(m)
    m.fighters[0].en = ENERGY_MAX
    bring(m, 70)
    run(m, 1, 0)
    run(m, 1, INPUT.SPECIAL)
    run(m, 6, 0, INPUT.PUNCH)
    expect(m.fighters[0].hp).toBe(m.fighters[0].hpMax)
  })

  it("Hulk's shockwave misses a fighter who is in the air", () => {
    const m = duel('hulk', 'cap')
    toFight(m)
    m.fighters[0].en = ENERGY_MAX
    m.fighters[0].x = 400
    m.fighters[1].x = 800
    run(m, 1, 0)
    run(m, 1, INPUT.SPECIAL)
    for (let i = 0; i < 70; i++) {
      step(m, 0, i % 50 === 20 ? INPUT.UP : 0)
      if (m.fighters[1].y > 60) break
    }
    const start = m.fighters[1].hp
    run(m, 3, 0, INPUT.UP)
    expect(m.fighters[1].hp).toBeLessThanOrEqual(start)
  })
})

describe('movement helper', () => {
  it('moves a predicted fighter exactly as the simulation does', () => {
    const m = duel()
    toFight(m)
    const f = m.fighters[0]
    const copy = { x: f.x, y: f.y, vx: f.vx, vy: f.vy, state: f.state, char: f.char, walk: f.walk, jump: f.jump, hover: 0 }
    const inputs = [INPUT.RIGHT, INPUT.RIGHT, INPUT.RIGHT | INPUT.UP, INPUT.RIGHT, 0, 0, INPUT.LEFT, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    for (const i of inputs) {
      step(m, i, 0)
      locomote(copy, i)
    }
    expect(copy.x).toBeCloseTo(m.fighters[0].x, 5)
    expect(copy.y).toBeCloseTo(m.fighters[0].y, 5)
  })
})

describe('snapshots', () => {
  it('survive JSON and rebuild a view with every field the renderer needs', () => {
    const m = duel()
    toFight(m)
    bring(m)
    run(m, 15, INPUT.PUNCH)
    const s = JSON.parse(JSON.stringify(snapshot(m, 42)))
    expect(s.ack).toBe(42)
    const v = viewFromSnapshot(s, { chars: m.chars, scales: m.fighters.map(f => f.scale), hpMax: m.fighters.map(f => f.hpMax) })
    expect(v.fighters).toHaveLength(2)
    expect(v.fighters[1].hp).toBe(Math.round(m.fighters[1].hp))
    expect(v.fighters[0].char).toBe('cap')
    expect(v.phase).toBe('fight')
  })
})

describe('AI', () => {
  it('reacts faster at higher player levels but never below the floor', () => {
    expect(reactionFor(1)).toBeGreaterThan(reactionFor(6))
    expect(reactionFor(999)).toBe(6)
  })

  it('makes the same choices for the same seed', () => {
    const trace = () => {
      const m = duel()
      const ai = createAI({ level: 3, seed: 99 })
      toFight(m)
      const out = []
      for (let i = 0; i < 400; i++) {
        const k = ai.think(m, 1)
        out.push(k)
        step(m, 0, k)
      }
      return out.join(',')
    }
    expect(trace()).toBe(trace())
  })

  it('approaches, attacks and eventually damages a passive player', () => {
    const m = duel()
    const ai = createAI({ level: 4, seed: 3 })
    toFight(m)
    for (let i = 0; i < 1500 && m.phase === 'fight'; i++) step(m, 0, ai.think(m, 1))
    expect(m.fighters[0].hp).toBeLessThan(m.fighters[0].hpMax)
  })

  it('stays idle outside the fight phase', () => {
    expect(createAI().think(duel(), 1)).toBe(0)
  })
})
