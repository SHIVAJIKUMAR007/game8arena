import { MAPS } from './maps.js'

// Mafia Hunt game simulation. Pure and deterministic given its inputs (no sockets, no timers), so it can be tested
// directly. The server owns the truth: clients send inputs, and each gets back only what its player can see.

export const RADIUS = 14
export { WORLD } from './maps.js'

export const MAX_PLAYERS = 1 + MAPS[0].villagerSpawns.length

export const CONFIG = {
  mafiaSpeed: 200, // pixels per second: a little faster than the villagers, because the arena is big
  villagerSpeed: 190,
  mafiaVision: 320,
  villagerVision: 280,
  shotRange: 800,
  cooldown: 0.8, // seconds between shots
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/** True when a circle overlaps any wall. */
export function circleHitsWall(walls, x, y, r = RADIUS) {
  for (const w of walls) {
    const nx = clamp(x, w.x, w.x + w.w)
    const ny = clamp(y, w.y, w.y + w.h)
    const dx = x - nx
    const dy = y - ny
    if (dx * dx + dy * dy < r * r) return true
  }
  return false
}

/** Distance along a unit ray to the first wall, or `maxLen` when nothing is in the way. */
export function rayWallDistance(walls, x, y, dx, dy, maxLen) {
  let best = maxLen
  for (const w of walls) {
    let tmin = 0
    let tmax = best
    let hit = true
    for (let axis = 0; axis < 2; axis++) {
      const o = axis ? y : x
      const d = axis ? dy : dx
      const lo = axis ? w.y : w.x
      const hi = lo + (axis ? w.h : w.w)
      if (Math.abs(d) < 1e-9) {
        if (o < lo || o > hi) { hit = false; break }
      } else {
        let t1 = (lo - o) / d
        let t2 = (hi - o) / d
        if (t1 > t2) [t1, t2] = [t2, t1]
        tmin = Math.max(tmin, t1)
        tmax = Math.min(tmax, t2)
        if (tmin > tmax) { hit = false; break }
      }
    }
    if (hit && tmin < best) best = tmin
  }
  return best
}

/** Clear line of sight between two points. */
export function lineOfSight(walls, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const dist = Math.hypot(dx, dy)
  if (dist < 1e-6) return true
  return rayWallDistance(walls, ax, ay, dx / dist, dy / dist, dist) >= dist - 0.001
}

function moveWithCollision(map, p, mx, my) {
  const nx = clamp(p.x + mx, RADIUS, map.world.w - RADIUS)
  if (!circleHitsWall(map.walls, nx, p.y)) p.x = nx
  const ny = clamp(p.y + my, RADIUS, map.world.h - RADIUS)
  if (!circleHitsWall(map.walls, p.x, ny)) p.y = ny
}

const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback)

/**
 * @param {{ players: Array<{id: string, name: string}>, mafiaId: string, duration: number, hide?: number, map?: object, random?: () => number }} opts
 */
export function createSim({ players, mafiaId, duration, hide = 15, map = MAPS[0], random = Math.random }) {
  if (players.length < 2 || players.length > MAX_PLAYERS) throw new RangeError(`need 2-${MAX_PLAYERS} players`)
  if (!players.some(p => p.id === mafiaId)) throw new RangeError('mafia must be one of the players')

  const spawns = [...map.villagerSpawns]
  for (let i = spawns.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [spawns[i], spawns[j]] = [spawns[j], spawns[i]]
  }
  const state = new Map()
  let s = 0
  for (const p of players) {
    const mafia = p.id === mafiaId
    const at = mafia ? map.mafiaSpawn : spawns[s++]
    state.set(p.id, {
      id: p.id, name: p.name, role: mafia ? 'mafia' : 'villager', x: at.x, y: at.y, alive: true,
      input: { dx: 0, dy: 0, aim: 0, fire: 0 }, lastFire: 0, cooldown: 0, aim: 0,
    })
  }

  const sim = {
    phase: hide > 0 ? 'hide' : 'play', // 'hide' -> 'play' -> 'over'
    left: hide > 0 ? hide : duration,
    duration,
    hide,
    winner: null, // 'mafia' | 'villagers'
    events: [],
    players: state,
    mafiaId,
    map,

    setInput(id, raw) {
      const p = state.get(id)
      if (!p || !raw || typeof raw !== 'object') return
      let dx = clamp(num(raw.dx), -1, 1)
      let dy = clamp(num(raw.dy), -1, 1)
      const len = Math.hypot(dx, dy)
      if (len > 1) {
        dx /= len
        dy /= len
      }
      p.input = { dx, dy, aim: num(raw.aim, p.aim), fire: Math.floor(num(raw.fire)) }
      p.aim = p.input.aim
    },

    /** A player left mid-game: they stop counting. */
    removePlayer(id) {
      const p = state.get(id)
      if (!p) return
      p.alive = false
      p.removed = true
    },

    aliveVillagers() {
      let n = 0
      for (const p of state.values()) if (p.role === 'villager' && p.alive) n++
      return n
    },

    totalVillagers() {
      return state.size - 1
    },

    shoot(shooter) {
      const dx = Math.cos(shooter.aim)
      const dy = Math.sin(shooter.aim)
      let reach = rayWallDistance(map.walls, shooter.x, shooter.y, dx, dy, CONFIG.shotRange)
      let victim = null
      for (const p of state.values()) {
        if (p.role !== 'villager' || !p.alive) continue
        const vx = p.x - shooter.x
        const vy = p.y - shooter.y
        const along = vx * dx + vy * dy
        if (along < 0) continue
        const perp2 = vx * vx + vy * vy - along * along
        if (perp2 > RADIUS * RADIUS) continue
        const at = along - Math.sqrt(RADIUS * RADIUS - perp2)
        if (at <= reach) {
          reach = Math.max(0, at)
          victim = p
        }
      }
      if (victim) victim.alive = false
      sim.events.push({
        type: 'shot', x1: Math.round(shooter.x), y1: Math.round(shooter.y),
        x2: Math.round(shooter.x + dx * reach), y2: Math.round(shooter.y + dy * reach), hit: victim ? victim.id : null,
      })
    },

    /** Advances the game by dt seconds. */
    step(dt) {
      sim.events = []
      if (sim.phase === 'over') return
      sim.left -= dt
      if (sim.phase === 'hide' && sim.left <= 0) {
        sim.phase = 'play'
        sim.left = duration
      }
      for (const p of state.values()) {
        if (!p.alive) continue
        p.cooldown = Math.max(0, p.cooldown - dt)
        const mafia = p.role === 'mafia'
        if (mafia && sim.phase === 'hide') {
          p.lastFire = p.input.fire // clicks while waiting are dropped, not saved up
          continue // the mafia waits while the others hide
        }
        const speed = mafia ? CONFIG.mafiaSpeed : CONFIG.villagerSpeed
        moveWithCollision(map, p, p.input.dx * speed * dt, p.input.dy * speed * dt)
        if (mafia && p.input.fire !== p.lastFire) {
          p.lastFire = p.input.fire
          if (p.cooldown <= 0) {
            p.cooldown = CONFIG.cooldown
            sim.shoot(p)
          }
        }
      }
      const mafia = state.get(mafiaId)
      if (!mafia.alive) sim.finish('villagers') // the mafia left the game
      else if (sim.aliveVillagers() === 0) sim.finish('mafia')
      else if (sim.phase === 'play' && sim.left <= 0) sim.finish('villagers')
    },

    finish(winner) {
      sim.phase = 'over'
      sim.winner = winner
      sim.left = 0
    },

    /** What one player is allowed to know right now. */
    snapshotFor(id) {
      const me = state.get(id)
      if (!me) return null
      const spectator = !me.alive
      const vision = me.role === 'mafia' ? CONFIG.mafiaVision : CONFIG.villagerVision
      const blind = me.role === 'mafia' && sim.phase === 'hide'
      const others = []
      for (const p of state.values()) {
        if (p === me || p.removed) continue
        let visible = spectator
        if (!visible && !blind && p.alive) {
          visible = Math.hypot(p.x - me.x, p.y - me.y) <= vision && lineOfSight(map.walls, me.x, me.y, p.x, p.y)
        }
        if (visible) others.push({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), alive: p.alive, aim: p.role === 'mafia' ? +p.aim.toFixed(2) : undefined })
      }
      return {
        phase: sim.phase,
        left: Math.max(0, +sim.left.toFixed(2)),
        me: { x: Math.round(me.x), y: Math.round(me.y), alive: me.alive, role: me.role, cooldown: +me.cooldown.toFixed(2), vision, blind },
        others,
        shots: sim.events,
        alive: sim.aliveVillagers(),
        total: sim.totalVillagers(),
      }
    },
  }
  return sim
}
