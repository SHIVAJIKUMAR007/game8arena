// The computer opponent. It reads the match like a player would and returns the same input object a keyboard
// would, so it can only do what a human can: walk, jump, double jump, swing, block and use its special.
// `skill` (0..1) sets how quickly it reacts, how often it attacks, blocks and dodges, and how well it
// uses its special. Decisions are made every `reaction` seconds; ledge and recovery checks run every step so a
// slow thinker still does not walk off an edge for no reason (unless it is in a "reckless" moment).
import { WEAPONS } from './data'

const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0)
const clamp01 = v => Math.min(1, Math.max(0, v))

export function aiParams(skill) {
  const s = clamp01(skill)
  return {
    reaction: 0.55 - 0.43 * s, // seconds between decisions
    aggression: 0.3 + 0.6 * s, // chance to swing when in range
    block: 0.05 + 0.5 * s, // chance to block an incoming swing
    dodge: 0.05 + 0.55 * s, // chance to jump a projectile or shockwave
    special: 0.15 + 0.7 * s, // chance to use the special when it makes sense
    reckless: 0.12 * (1 - s), // chance per decision to ignore a ledge
  }
}

/** Is there a platform to stand on beneath x, no further than `drop` below y? */
function groundBelow(m, x, y, drop) {
  for (const p of m.plats) if (x > p.x && x < p.x + p.w && p.y >= y - 6 && p.y <= y + drop) return true
  return false
}

/** A platform to land on across a gap, reachable by a jump, in the direction `dir`. */
function platformAhead(m, f, dir) {
  for (let i = 0; i < m.plats.length; i++) {
    const p = m.plats[i]
    if (i === f.platform) continue
    const gap = dir > 0 ? p.x - f.x : f.x - (p.x + p.w)
    if (gap > -f.w && gap < 270 && (dir > 0 ? p.x + p.w > f.x : p.x < f.x) && p.y >= f.y - 175 && p.y <= f.y + 220) return true
  }
  return false
}

/** True if no platform sits between the fighter and the foe at arrow height. */
function lineClear(m, f, foe) {
  const lo = Math.min(f.x, foe.x)
  const hi = Math.max(f.x, foe.x)
  const band0 = f.y - 70
  const band1 = f.y - 50
  return !m.plats.some(p => p.x < hi && p.x + p.w > lo && p.y < band1 && p.y + p.h > band0)
}

/** A spike strip on the platform we stand on, just ahead of us in the direction `dir`. */
function spikeAhead(m, f, dir) {
  for (const s of m.spikes) {
    if (Math.abs(s.y + s.h - f.y) > 6) continue
    const dist = dir > 0 ? s.x - (f.x + f.w / 2) : f.x - f.w / 2 - (s.x + s.w)
    if (dist > -4 && dist < 95) return true
  }
  return false
}

/** The platform closest to the fighter, by sideways distance first. */
function nearestPlatform(m, f) {
  let best = null
  let bestScore = Infinity
  for (const p of m.plats) {
    const dx = f.x < p.x ? p.x - f.x : f.x > p.x + p.w ? f.x - (p.x + p.w) : 0
    const score = dx + Math.abs(f.y - p.y) * 0.5
    if (score < bestScore) {
      bestScore = score
      best = p
    }
  }
  return best
}

/** Past the edge with the nearest platform's top above our feet: time to steer back. (Jumping a gap is fine.) */
const inDanger = (m, f) => {
  const p = nearestPlatform(m, f)
  return Boolean(p) && f.y > p.y + 20 && f.vy > 0
}

export function createAI(skill, rng) {
  const P = aiParams(skill)
  let now = 0
  let nextThink = 0
  let blockUntil = 0
  let recklessUntil = 0
  let stuck = 0
  const plan = { dir: 0, jump: false, attack: false, special: false }

  function recovery(m, f, input) {
    // airborne with nothing beneath: steer to the nearest platform and use the double jump
    const best = nearestPlatform(m, f)
    if (!best) return
    const cx = best.x + best.w / 2
    if (f.x < best.x + 10 || f.x > best.x + best.w - 10) {
      if (cx > f.x) input.right = true
      else input.left = true
    }
    if (f.y > best.y - 20 && f.vy > -80 && f.jumps > 0) input.jump = true
  }

  function decide(m, f, foe) {
    const w = WEAPONS[f.weapon]
    const dx = foe.x - f.x
    const adx = Math.abs(dx)
    const dy = foe.y - f.y
    const ranged = w.style === 'bow'
    const reach = ranged ? 560 : w.range
    plan.dir = 0
    plan.jump = false
    plan.attack = false
    plan.special = false

    if (rng.next() < P.reckless) recklessUntil = now + 0.8

    // spacing (an archer closes in when a platform blocks its line of fire)
    const clear = !ranged || lineClear(m, f, foe)
    if (ranged && clear) {
      if (adx > 520) plan.dir = sign(dx)
      else if (adx < 230) plan.dir = -sign(dx)
    } else if (adx > reach * 0.8 || !clear) plan.dir = sign(dx)

    // not on the foe's level (an archer cannot shoot up or down): go and find it
    if (Math.abs(dy) > 100 && plan.dir === 0) plan.dir = sign(dx) || 1

    // foe on a platform below and nearly underneath: head for the edge and drop
    if (dy > 100 && f.onGround && adx < 140 && f.platform >= 0) {
      const p = m.plats[f.platform]
      plan.dir = f.x - p.x < p.x + p.w - f.x ? -1 : 1
    }

    // foe above: climb. foe far below: drop down if there is something to land on.
    if (dy < -110 && f.onGround && (adx < 170 || rng.next() < 0.3)) plan.jump = true

    // blocking and dodging
    const foeReach = WEAPONS[foe.weapon].range
    if (foe.atk && foe.atk.t / foe.atk.dur < 0.6 && adx < foeReach + 50 && foe.face === sign(f.x - foe.x) && f.onGround && rng.next() < P.block) {
      blockUntil = now + 0.35 + rng.next() * 0.2
    }
    for (const p of m.projectiles) {
      if (p.owner === f.id || sign(p.vx) !== sign(f.x - p.x) || Math.abs(p.x - f.x) > 360) continue
      if (Math.abs(p.y - (f.y - 45)) > 70) continue
      if (rng.next() < P.dodge) {
        if (p.kind === 'wave' || rng.next() < 0.5) plan.jump = f.onGround || f.jumps > 0
        else blockUntil = now + 0.4
      }
    }
    const fs = foe.spec
    if (fs && (fs.def.kind === 'smash' || fs.def.kind === 'spin') && adx < fs.def.radius + 40 && rng.next() < P.dodge) plan.jump = true

    // attacking
    const aligned = Math.abs(dy) < (ranged ? 90 : 70)
    const inRange = ranged ? adx > 190 && adx < 700 && clear : adx < reach + 6
    if (inRange && aligned && foe.state !== 'dead' && rng.next() < P.aggression) plan.attack = true

    // special
    if (f.cdSpec <= 0 && !f.spec && rng.next() < P.special) {
      const k = w.special.kind
      const near = adx < 150 && aligned
      const mid = adx > 120 && adx < 620 && aligned
      if (
        (k === 'wave' && mid) ||
        (k === 'volley' && adx > 220 && adx < 700) ||
        (k === 'lightning' && adx < 760) ||
        (k === 'smash' && adx < w.special.radius * 0.7 && dy > -100) ||
        (k === 'spin' && near) ||
        (k === 'dash' && adx > 130 && adx < 330 && aligned) ||
        (k === 'shield' && (adx < 160 || f.hp < f.hpMax * 0.5))
      ) plan.special = true
    }
  }

  return {
    skill,
    /** @returns an input object for fighter `id` */
    think(m, id, dt) {
      now += dt
      const f = m.fighters[id]
      const foe = m.fighters.find(x => x !== f && x.state !== 'dead')
      const input = { left: false, right: false, jump: false, attack: false, block: false, special: false }
      if (!foe || f.state === 'dead' || m.status !== 'fight') return input

      if (!f.onGround && f.state !== 'spec' && !groundBelow(m, f.x, f.y, 3000) && inDanger(m, f)) {
        recovery(m, f, input)
        return input
      }

      // climbing: use the double jump near the top of the first jump
      if (!f.onGround && f.state !== 'spec' && foe.y < f.y - 90 && f.vy > -120 && f.jumps > 0 && Math.abs(foe.x - f.x) < 420) input.jump = true

      if (now >= nextThink) {
        decide(m, f, foe)
        nextThink = now + P.reaction * (0.8 + rng.next() * 0.5)
        input.attack = plan.attack
        input.special = plan.special
        input.jump = plan.jump
        if (plan.attack || plan.special) {
          // turn to face the foe on the step the swing starts
          if (foe.x > f.x) input.right = true
          else input.left = true
        }
      }
      if (blockUntil > now && f.onGround && !f.atk) input.block = true

      let dir = plan.dir
      if (dir !== 0 && f.onGround) {
        const probe = f.x + dir * (f.w / 2 + 26)
        const safe = groundBelow(m, probe, f.y, 160)
        if (!safe) {
          if (now < recklessUntil) {
            /* walks off on purpose */
          } else if (foe.y - f.y > 60 && groundBelow(m, probe, f.y, 460)) {
            /* drops down to a platform below, where the foe is */
          } else if (platformAhead(m, f, dir)) input.jump = true
          else dir = 0
        } else if (spikeAhead(m, f, dir)) input.jump = true
      }
      stuck = dir !== 0 && f.onGround && !f.atk && f.hurt <= 0 && Math.abs(f.vx) < 5 ? stuck + dt : 0
      if (stuck > 0.25) {
        input.jump = true // pushed against a wall: hop it
        stuck = 0
      }
      if (!input.left && !input.right && !input.block) {
        if (dir > 0) input.right = true
        else if (dir < 0) input.left = true
      }
      return input
    },
  }
}
