import { describe, expect, it } from 'vitest'
import { CONFIG, MAX_PLAYERS, RADIUS, circleHitsWall, createSim, lineOfSight, rayWallDistance } from './hideSeekSim.js'
import { MAPS, MAP_IDS, WORLD, getMap } from './maps.js'

// A small fixed arena for the rules tests, so they do not depend on how the real maps are laid out.
const WALLS = [
  { x: 200, y: 150, w: 160, h: 100 }, { x: 840, y: 150, w: 160, h: 100 }, { x: 540, y: 90, w: 120, h: 60 }, { x: 540, y: 650, w: 120, h: 60 },
  { x: 200, y: 560, w: 160, h: 100 }, { x: 840, y: 560, w: 160, h: 100 }, { x: 380, y: 300, w: 100, h: 60 }, { x: 720, y: 300, w: 100, h: 60 },
  { x: 380, y: 440, w: 100, h: 60 }, { x: 720, y: 440, w: 100, h: 60 }, { x: 100, y: 330, w: 60, h: 140 }, { x: 1040, y: 330, w: 60, h: 140 },
]
const TEST_MAP = {
  id: 'test', name: 'Test', world: { w: 1200, h: 800 }, walls: WALLS, mafiaSpawn: { x: 600, y: 400 },
  villagerSpawns: [{ x: 60, y: 60 }, { x: 1140, y: 60 }, { x: 60, y: 740 }, { x: 1140, y: 740 }, { x: 450, y: 50 }, { x: 750, y: 50 }, { x: 450, y: 750 }, { x: 750, y: 750 }],
}
const MAFIA_SPAWN = TEST_MAP.mafiaSpawn

const seeded = () => {
  let a = 7
  return () => ((a = (a * 16807) % 2147483647) - 1) / 2147483646
}
const make = (n = 3, extra = {}) =>
  createSim({
    players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` })), mafiaId: 'p0', duration: 60, hide: 5, map: TEST_MAP, random: seeded(), ...extra,
  })
const run = (sim, seconds, dt = 1 / 30) => {
  for (let t = 0; t < seconds; t += dt) sim.step(dt)
}
/** Puts a player somewhere exact. */
const put = (sim, id, x, y) => Object.assign(sim.players.get(id), { x, y })

describe('geometry', () => {
  it('blocks sight and shots with walls, and not in the open', () => {
    const w = WALLS[0] // x 200-360, y 150-250
    expect(lineOfSight(WALLS, 100, 200, 450, 200)).toBe(false)
    expect(lineOfSight(WALLS, 100, 60, 450, 60)).toBe(true)
    expect(rayWallDistance(WALLS, 100, 200, 1, 0, 700)).toBeCloseTo(w.x - 100)
    expect(rayWallDistance(WALLS, 100, 60, 1, 0, 300)).toBe(300)
    expect(lineOfSight(WALLS, 5, 5, 5, 5)).toBe(true)
  })
})

/** Can a player walk from the mafia spawn to every villager spawn? Flood fill on a 20px grid. */
function reachable(map) {
  const cell = 20
  const cols = Math.ceil(map.world.w / cell)
  const rows = Math.ceil(map.world.h / cell)
  const free = (cx, cy) => cx >= 0 && cy >= 0 && cx < cols && cy < rows && !circleHitsWall(map.walls, cx * cell + cell / 2, cy * cell + cell / 2, RADIUS)
  const seen = new Set()
  const stack = [[Math.floor(map.mafiaSpawn.x / cell), Math.floor(map.mafiaSpawn.y / cell)]]
  while (stack.length) {
    const [cx, cy] = stack.pop()
    const k = cy * cols + cx
    if (seen.has(k) || !free(cx, cy)) continue
    seen.add(k)
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1])
  }
  return map.villagerSpawns.every(s => seen.has(Math.floor(s.y / cell) * cols + Math.floor(s.x / cell)))
}

describe('the maps', () => {
  it('has five maps, each about three times the original area, with a name and id', () => {
    expect(MAPS).toHaveLength(5)
    expect(new Set(MAP_IDS).size).toBe(5)
    expect(WORLD.w * WORLD.h).toBeGreaterThanOrEqual(3 * 1200 * 800)
    expect(getMap('nope')).toBe(MAPS[0])
    for (const m of MAPS) {
      expect(m.name.length).toBeGreaterThan(2)
      expect(m.villagerSpawns).toHaveLength(8)
    }
    expect(MAX_PLAYERS).toBe(9)
  })

  for (const map of MAPS) {
    describe(map.name, () => {
      it('has free start spots inside the arena', () => {
        for (const s of [map.mafiaSpawn, ...map.villagerSpawns]) {
          expect(circleHitsWall(map.walls, s.x, s.y)).toBe(false)
          expect(s.x).toBeGreaterThanOrEqual(RADIUS)
          expect(s.x).toBeLessThanOrEqual(map.world.w - RADIUS)
          expect(s.y).toBeGreaterThanOrEqual(RADIUS)
          expect(s.y).toBeLessThanOrEqual(map.world.h - RADIUS)
        }
      })

      it('keeps every wall inside the arena and has plenty to hide behind', () => {
        expect(map.walls.length).toBeGreaterThanOrEqual(15)
        for (const w of map.walls) {
          expect(w.w).toBeGreaterThan(0)
          expect(w.h).toBeGreaterThan(0)
          expect(w.x).toBeGreaterThanOrEqual(0)
          expect(w.y).toBeGreaterThanOrEqual(0)
          expect(w.x + w.w).toBeLessThanOrEqual(map.world.w)
          expect(w.y + w.h).toBeLessThanOrEqual(map.world.h)
        }
      })

      it('lets the mafia reach every villager start spot on foot', () => {
        expect(reachable(map)).toBe(true)
      })

      it('runs a whole round in the simulation', () => {
        const sim = createSim({
          players: Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, name: `P${i}` })), mafiaId: 'p0', duration: 5, hide: 1, map, random: seeded(),
        })
        for (let i = 0; i < 30 * 8; i++) sim.step(1 / 30)
        expect(sim.phase).toBe('over')
        expect(sim.winner).toBe('villagers')
      })
    })
  }
})

describe('setting up', () => {
  it('needs 2 to 9 players and a mafia who is one of them', () => {
    expect(() => make(1)).toThrow(RangeError)
    expect(() => make(MAX_PLAYERS + 1)).toThrow(RangeError)
    expect(() => createSim({ players: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }], mafiaId: 'zzz', duration: 60 })).toThrow(RangeError)
    expect(make(MAX_PLAYERS).totalVillagers()).toBe(MAX_PLAYERS - 1)
    expect(MAX_PLAYERS).toBe(9)
  })

  it('puts the mafia in the middle and the villagers on different spots', () => {
    const sim = make(6)
    expect(sim.players.get('p0')).toMatchObject({ role: 'mafia', x: MAFIA_SPAWN.x, y: MAFIA_SPAWN.y })
    const spots = [...sim.players.values()].filter(p => p.role === 'villager').map(p => `${p.x},${p.y}`)
    expect(new Set(spots).size).toBe(5)
  })
})

describe('movement', () => {
  it('moves at the right speed and stops at walls and edges', () => {
    const sim = make(2)
    put(sim, 'p1', 60, 60)
    sim.setInput('p1', { dx: 1, dy: 0 })
    sim.step(1)
    expect(sim.players.get('p1').x).toBeCloseTo(60 + CONFIG.villagerSpeed, 3)
    put(sim, 'p1', 20, 400)
    sim.setInput('p1', { dx: -1, dy: 0 })
    run(sim, 1)
    expect(sim.players.get('p1').x).toBe(RADIUS)
    put(sim, 'p1', 100, 200)
    sim.setInput('p1', { dx: 1, dy: 0 })
    run(sim, 2)
    const p = sim.players.get('p1')
    expect(p.x).toBeLessThanOrEqual(WALLS[0].x - RADIUS + 0.01)
    expect(circleHitsWall(WALLS, p.x, p.y)).toBe(false)
  })

  it('does not let a huge input go faster than top speed', () => {
    const sim = make(2)
    put(sim, 'p1', 600, 700)
    sim.setInput('p1', { dx: 5, dy: 5 })
    sim.step(0.5)
    const p = sim.players.get('p1')
    expect(Math.hypot(p.x - 600, p.y - 700)).toBeLessThanOrEqual(CONFIG.villagerSpeed * 0.5 + 1)
  })

  it('ignores junk input', () => {
    const sim = make(2)
    sim.setInput('p1', { dx: 'a', dy: NaN, aim: Infinity, fire: 'x' })
    sim.setInput('nobody', { dx: 1 })
    sim.setInput('p1', null)
    expect(() => run(sim, 1)).not.toThrow()
    expect(Number.isFinite(sim.players.get('p1').x)).toBe(true)
  })
})

describe('phases', () => {
  it('holds the mafia during the hiding time, then releases them', () => {
    const sim = make(2)
    sim.setInput('p0', { dx: 1, dy: 0 })
    run(sim, 3)
    expect(sim.phase).toBe('hide')
    expect(sim.players.get('p0').x).toBe(MAFIA_SPAWN.x)
    run(sim, 3)
    expect(sim.phase).toBe('play')
    expect(sim.players.get('p0').x).toBeGreaterThan(MAFIA_SPAWN.x)
  })

  it('villagers win when the time runs out', () => {
    const sim = make(3, { duration: 10, hide: 0 })
    expect(sim.phase).toBe('play')
    run(sim, 10.5)
    expect(sim.phase).toBe('over')
    expect(sim.winner).toBe('villagers')
    sim.step(1)
    expect(sim.winner).toBe('villagers')
  })

  it('the mafia wins by shooting every villager before the time is up', () => {
    const sim = make(3, { hide: 0 })
    put(sim, 'p0', 100, 700)
    put(sim, 'p1', 300, 700)
    put(sim, 'p2', 300, 740)
    sim.setInput('p0', { aim: 0, fire: 1 })
    sim.step(0.05)
    expect(sim.players.get('p1').alive).toBe(false)
    expect(sim.phase).toBe('play')
    put(sim, 'p0', 100, 740)
    run(sim, CONFIG.cooldown + 0.1)
    sim.setInput('p0', { aim: 0, fire: 2 })
    sim.step(0.05)
    expect(sim.players.get('p2').alive).toBe(false)
    expect(sim.phase).toBe('over')
    expect(sim.winner).toBe('mafia')
  })

  it('villagers win if the mafia leaves the game', () => {
    const sim = make(3)
    sim.removePlayer('p0')
    sim.step(0.1)
    expect(sim.winner).toBe('villagers')
  })
})

describe('shooting', () => {
  it('only the mafia can shoot, only in the play phase, and only after the cooldown', () => {
    const sim = make(2, { hide: 1 })
    put(sim, 'p0', 100, 700)
    put(sim, 'p1', 300, 700)
    sim.setInput('p0', { aim: 0, fire: 1 })
    sim.step(0.1) // still hiding
    expect(sim.players.get('p1').alive).toBe(true)
    run(sim, 1)
    sim.setInput('p1', { aim: Math.PI / 2, fire: 1 }) // a villager has no gun
    sim.step(0.1)
    expect(sim.events).toEqual([])
    put(sim, 'p1', 300, 700)
    put(sim, 'p0', 100, 700)
    sim.setInput('p0', { aim: 0, fire: 2 })
    sim.step(0.05)
    expect(sim.events).toHaveLength(1)
    sim.setInput('p0', { aim: 0, fire: 3 })
    sim.step(0.05) // inside the cooldown: no second shot
    expect(sim.events).toHaveLength(0)
  })

  it('does not shoot through walls, out of range, or backwards', () => {
    const sim = make(3, { hide: 0 })
    put(sim, 'p1', 450, 200) // behind the first house
    put(sim, 'p2', 100, 700)
    put(sim, 'p0', 100, 200)
    sim.setInput('p0', { aim: 0, fire: 1 })
    sim.step(0.05)
    expect(sim.players.get('p1').alive).toBe(true)
    expect(sim.events[0].hit).toBeNull()
    expect(sim.events[0].x2).toBeLessThan(WALLS[0].x + 1)
    run(sim, 1)
    put(sim, 'p0', 20, 700)
    put(sim, 'p2', 20 + CONFIG.shotRange + 100, 700)
    sim.setInput('p0', { aim: 0, fire: 2 })
    run(sim, 1)
    expect(sim.players.get('p2').alive).toBe(true)
    put(sim, 'p2', 40, 700)
    put(sim, 'p0', 300, 700)
    sim.setInput('p0', { aim: 0, fire: 3 })
    run(sim, 1)
    expect(sim.players.get('p2').alive).toBe(true)
  })

  it('hits the nearest villager when two line up', () => {
    const sim = make(3, { hide: 0 })
    put(sim, 'p0', 100, 700)
    put(sim, 'p1', 500, 700)
    put(sim, 'p2', 300, 700)
    sim.setInput('p0', { aim: 0, fire: 1 })
    sim.step(0.05)
    expect(sim.players.get('p2').alive).toBe(false)
    expect(sim.players.get('p1').alive).toBe(true)
  })
})

describe('what each player can see', () => {
  it('shows only players that are close and in line of sight', () => {
    const sim = make(4, { hide: 0 })
    put(sim, 'p1', 100, 60)
    put(sim, 'p2', 200, 60)
    put(sim, 'p3', 1100, 740)
    const seen = sim.snapshotFor('p1').others.map(o => o.id)
    expect(seen).toContain('p2')
    expect(seen).not.toContain('p3') // too far
    put(sim, 'p1', 100, 200)
    put(sim, 'p2', 450, 200) // behind a house, within range
    expect(sim.snapshotFor('p1').others.map(o => o.id)).not.toContain('p2')
  })

  it('blinds the mafia while the others hide, and shows spectators everyone', () => {
    const sim = make(3, { hide: 5 })
    put(sim, 'p1', 600, 380)
    expect(sim.snapshotFor('p0').others).toEqual([])
    expect(sim.snapshotFor('p0').me.blind).toBe(true)
    sim.players.get('p2').alive = false
    expect(sim.snapshotFor('p2').others).toHaveLength(2)
  })

  it('reports the clock, the counts, and nothing for an unknown player', () => {
    const sim = make(4)
    const snap = sim.snapshotFor('p1')
    expect(snap).toMatchObject({ phase: 'hide', alive: 3, total: 3, shots: [] })
    expect(snap.me.role).toBe('villager')
    expect(snap.left).toBeCloseTo(5)
    expect(sim.snapshotFor('ghost')).toBeNull()
  })
})
