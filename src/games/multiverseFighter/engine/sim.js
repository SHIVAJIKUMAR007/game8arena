// Multiverse Fighter simulation: the whole rules engine in plain JavaScript with no DOM, no React and no clock.
// step(match, input0, input1) advances the fight by exactly one 60Hz tick. Given the same seed, fighters and input
// sequence it always produces the same match, because the only randomness is the seeded generator on the match.
// Online play relies on this: the host runs this module, the guest only renders snapshots of it.
//
// Units are pixels in a 1280x720 world. x runs left to right; y is height above the mat (up is positive).
import { createRng } from '../../../platform/rng'
import { fighterById } from '../roster'

export const STEP_MS = 1000 / 60
export const W = 1280
export const H = 720
export const WALL_L = 70
export const WALL_R = 1210
export const GRAVITY = 0.78
export const ROUNDS_TO_WIN = 2
export const ROUND_SECONDS = 60
export const INTRO_FRAMES = 100
export const KO_FRAMES = 150
export const ENERGY_MAX = 100

/** Held-key bitmask, the unit that crosses the network. */
export const INPUT = Object.freeze({ LEFT: 1, RIGHT: 2, UP: 4, DOWN: 8, PUNCH: 16, HEAVY: 32, KICK: 64, FKICK: 128, SPECIAL: 256 })
const ATTACK_BITS = INPUT.PUNCH | INPUT.HEAVY | INPUT.KICK | INPUT.FKICK

/** Normal moves. Frames are ticks at 60Hz; hitboxes are relative to the fighter and scale with its size. */
export const MOVES = {
  punch: { bit: INPUT.PUNCH, start: 5, active: 3, rec: 9, dmg: 36, x0: 10, reach: 100, y0: 90, y1: 165, stun: 22, bstun: 12, kb: 3.5, en: 5 },
  heavy: { bit: INPUT.HEAVY, start: 13, active: 4, rec: 20, dmg: 82, x0: 10, reach: 118, y0: 60, y1: 175, stun: 30, bstun: 18, kb: 9, en: 9, big: true },
  kick: { bit: INPUT.KICK, start: 8, active: 4, rec: 14, dmg: 54, x0: 10, reach: 128, y0: 15, y1: 115, stun: 26, bstun: 14, kb: 6, en: 7 },
  fkick: { bit: INPUT.FKICK, start: 5, active: 26, rec: 12, dmg: 64, x0: 0, reach: 120, y0: 0, y1: 130, stun: 24, bstun: 13, kb: 8, en: 9, big: true, flying: true },
}
const ATTACK_ORDER = ['heavy', 'fkick', 'kick', 'punch']

/** Per-fighter tuning of the chain-style specials (Black Panther, Paul Atreides). */
const CHAIN = {
  panther: { hits: 5, dmg: 30, gap: 6, dash: 15 },
  paul: { hits: 6, dmg: 24, gap: 5, dash: 18 },
}

const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0
const facing = (v, a) => (a.x - v.x) * v.face >= 0
const clampX = x => Math.min(WALL_R, Math.max(WALL_L, x))

export function makeFighter(idx, charId, stats, x, face) {
  const c = fighterById(charId)
  return {
    idx, char: c.id, scale: c.scale, x, y: 0, vx: 0, vy: 0, face,
    hp: stats.hpMax, hpMax: stats.hpMax, en: 0, dmgMult: stats.dmgMult, walk: stats.walk, jump: stats.jump,
    state: 'idle', st: 0, move: '', hitDone: false, stun: 0, bstun: 0, knockT: 0,
    combo: 0, comboT: 0, flash: 0, invuln: 0, hold: 0, hover: 0, bleedT: 0,
    counterOn: false, parryOn: false, prev: 0, buf: 0, bufT: 0, sp: null,
  }
}

/**
 * @param {{ seed?:number, chars:[string,string], stats:[object,object] }} cfg stats come from roster.statsFor()
 */
export function createMatch({ seed = 1, chars, stats }) {
  const m = {
    frame: 0, seed, rng: createRng(seed), round: 1, wins: [0, 0], phase: 'intro', phaseT: 0,
    timer: ROUND_SECONDS * 60, winner: -1, roundWinner: -1, timeUp: false, hitstop: 0,
    fighters: [], proj: [], zones: [], events: [], chars, stats,
  }
  resetRound(m)
  return m
}

function resetRound(m) {
  m.fighters = [0, 1].map(i => makeFighter(i, m.chars[i], m.stats[i], i ? 820 : 460, i ? -1 : 1))
  m.proj = []
  m.zones = []
  m.timer = ROUND_SECONDS * 60
  m.phase = 'intro'
  m.phaseT = 0
  m.hitstop = 0
  m.roundWinner = -1
}

const ev = (m, k, x, y, extra) => m.events.push({ k, x: Math.round(x), y: Math.round(y), ...extra })

// ───────────── movement ─────────────
/** Gravity, momentum and wall clamp for fighters that are not steering. Returns true on the tick they land. */
function physics(f) {
  if (f.hold > 0) {
    f.hold--
    return false
  }
  let landed = false
  if (f.y > 0 || f.vy > 0) {
    f.vy -= GRAVITY
    f.y += f.vy
    if (f.y <= 0) {
      f.y = 0
      f.vy = 0
      landed = true
    }
  }
  f.x = clampX(f.x + f.vx)
  if (f.y <= 0) f.vx *= 0.82
  return landed
}

/**
 * Walking, crouch-blocking, jumping and hovering for a fighter that is free to act. Exported because the online guest
 * runs the same function on its own fighter to predict movement before the host's answer arrives.
 */
export function locomote(f, mask) {
  const dir = (mask & INPUT.RIGHT ? 1 : 0) - (mask & INPUT.LEFT ? 1 : 0)
  const grounded = f.y <= 0 && f.vy <= 0
  if (grounded) {
    if (mask & INPUT.DOWN) {
      f.state = 'block'
      f.vx = 0
    } else {
      f.vx = dir * f.walk
      f.state = dir ? 'walk' : 'idle'
      if (mask & INPUT.UP) {
        f.vy = f.jump
        f.state = 'jump'
        f.hover = f.char === 'ironman' ? 55 : 0
      }
    }
  } else {
    f.state = 'jump'
    if (dir) f.vx += (dir * f.walk - f.vx) * 0.18
    if (f.char === 'ironman' && mask & INPUT.UP && f.vy <= 0 && f.hover > 0) {
      f.vy = 0
      f.hover--
    }
  }
  f.vy -= GRAVITY
  f.y += f.vy
  f.x = clampX(f.x + f.vx)
  if (f.y <= 0) {
    f.y = 0
    f.vy = 0
    if (f.state === 'jump') f.state = 'idle'
  }
}

// ───────────── hits ─────────────
const hurtBox = f => ({ x0: f.x - 26 * f.scale, x1: f.x + 26 * f.scale, y0: f.y, y1: f.y + (f.state === 'block' ? 150 : 225) * f.scale })

function cancelAction(f) {
  if (f.state === 'attack' || f.state === 'special') {
    f.sp = null
    f.move = ''
  }
  f.counterOn = false
  f.parryOn = false
}

/**
 * Applies one hit. Returns 0 for nothing, 1 for a clean hit, 2 for a block, parry or counter.
 * h: { dmg, stun, bstun, kb, kd, lift, kdT, unblock, melee, big, small, en, steal, bleed }
 */
function tryHit(m, a, v, h) {
  if (m.phase !== 'fight' || v.state === 'knock' || v.invuln > 0) return 0
  const front = facing(v, a)
  const away = Math.sign(v.x - a.x) || a.face
  if (v.counterOn && front && v.sp) {
    const back = Math.round(Math.max(90, h.dmg * a.dmgMult * 1.4))
    a.hp = Math.max(0, a.hp - back)
    cancelAction(a)
    a.state = 'knock'
    a.st = 0
    a.knockT = 56
    a.vy = 7
    a.vx = -away * 10
    v.sp.done = true
    v.sp.t0 = v.st
    v.counterOn = false
    v.en = Math.min(ENERGY_MAX, v.en + 10)
    m.hitstop = 9
    ev(m, 'counter', a.x, 110, { dmg: back, idx: a.idx })
    return 2
  }
  if (v.parryOn && front && h.melee && v.sp) {
    cancelAction(a)
    a.state = 'hit'
    a.stun = 48
    v.sp.parried = true
    v.parryOn = false
    v.en = Math.min(ENERGY_MAX, v.en + 15)
    m.hitstop = 9
    ev(m, 'parry', (a.x + v.x) / 2, 110, {})
    return 2
  }
  const blocked = !h.unblock && v.state === 'block' && v.y <= 0 && front
  const wasHit = v.state === 'hit'
  if (!blocked) a.combo = wasHit ? a.combo + 1 : 1
  else a.combo = 0
  a.comboT = 80
  let dmg = blocked ? h.dmg * a.dmgMult * 0.15 : h.dmg * a.dmgMult * Math.max(0.45, 1 - 0.07 * (a.combo - 1))
  dmg = Math.max(1, Math.round(dmg))
  v.hp = Math.max(0, v.hp - dmg)
  a.en = Math.min(ENERGY_MAX, a.en + (blocked ? 2 : (h.en || 5)))
  v.en = Math.min(ENERGY_MAX, v.en + (blocked ? 2 : 4 + dmg * 0.03))
  if (blocked) {
    v.bstun = h.bstun
    v.vx = away * h.kb * 0.7
    if (a.state === 'attack') a.vx = -away * h.kb * 0.3
  } else {
    cancelAction(v)
    v.flash = 6
    // Combo breaker: the fifth hit of a string always knocks down, so a jab chain cannot lock someone out.
    if (h.kd || a.combo >= 5) {
      v.state = 'knock'
      v.st = 0
      v.knockT = h.kdT || 54
      v.vy = h.lift ?? 6
      v.vx = away * Math.max(h.kb, 5)
    } else {
      v.state = 'hit'
      v.stun = h.stun
      v.vx = away * h.kb
      if (v.y > 0) v.vy = Math.max(v.vy, 3)
    }
    if (h.steal) a.hp = Math.min(a.hpMax, a.hp + Math.round(dmg * h.steal))
    if (h.bleed) v.bleedT = 240
  }
  m.hitstop = h.small ? 2 : h.big ? 8 : 4
  ev(m, 'hit', (a.x + v.x) / 2, v.y + 130 * v.scale, { dmg, block: blocked, big: Boolean(h.big || h.kd), idx: v.idx, combo: a.combo })
  return blocked ? 2 : 1
}

/** A melee hitbox in front of (or around) a fighter, tested against the opponent. */
function hitMelee(m, f, o, b) {
  const s = f.scale
  let x0
  let x1
  if (b.both) {
    x0 = f.x - b.reach * s
    x1 = f.x + b.reach * s
  } else {
    const p = f.x + f.face * (b.x0 || 0) * s
    const q = f.x + f.face * b.reach * s
    x0 = Math.min(p, q)
    x1 = Math.max(p, q)
  }
  // Move heights are tuned against a 180px fighter; the drawn fighters are 25% larger.
  if (!overlap({ x0, x1, y0: f.y + b.y0 * s * 1.25, y1: f.y + b.y1 * s * 1.25 }, hurtBox(o))) return 0
  return tryHit(m, f, o, { ...b, melee: true })
}

// ───────────── specials ─────────────
function startSpecial(m, f) {
  f.state = 'special'
  f.move = fighterById(f.char).special.kind
  f.st = 0
  f.sp = {}
  f.en = 0
  f.hitDone = false
  ev(m, 'special', f.x, 120, { idx: f.idx, kind: f.move })
}

function endSpecial(f) {
  f.state = f.y > 0 ? 'jump' : 'idle'
  f.sp = null
  f.move = ''
  f.counterOn = false
  f.parryOn = false
}

function stepSpecial(m, f, o) {
  const t = f.st
  const sp = f.sp
  const dir = f.face
  const dx = Math.abs(o.x - f.x)
  switch (f.move) {
    case 'shield':
      if (t === 10) m.proj.push({ type: 'shield', owner: f.idx, x: f.x + dir * 40, y: 140 * f.scale, vx: dir * 16, t: 0, mode: 0, dist: 0, hit: [false, false] })
      if (t >= 34) endSpecial(f)
      break
    case 'beam':
      if (t >= 14 && t < 50 && (t - 14) % 6 === 0) {
        hitMelee(m, f, o, { x0: 30, reach: 680, y0: 70, y1: 150, dmg: 30, stun: 14, bstun: 8, kb: 1.5, en: 2, small: true })
      }
      if (t >= 64) endSpecial(f)
      break
    case 'storm':
      if (t === 8 || t === 28 || t === 48) m.zones.push({ owner: f.idx, x: clampX(o.x + m.rng.int(-30, 30)), w: 90, t: 0, tele: 22, act: 5, dmg: 85, hit: false })
      if (t >= 58) endSpecial(f)
      break
    case 'chain': {
      const P = CHAIN[f.char] || CHAIN.paul
      sp.stage ??= 'dash'
      if (sp.stage === 'dash') {
        f.vx = dir * P.dash
        if (dx < 80) {
          sp.stage = 'hit'
          sp.t = 0
          sp.n = 0
          f.vx = 0
        } else if (t >= 16) {
          sp.stage = 'rec'
          sp.t = 0
        }
      } else if (sp.stage === 'hit') {
        sp.t++
        if (sp.t % P.gap === P.gap - 1) {
          const last = sp.n === P.hits - 1
          const r = hitMelee(m, f, o, { x0: 0, reach: 110, y0: 30, y1: 170, dmg: last ? P.dmg * 1.6 : P.dmg, stun: 16, bstun: 6, kb: last ? 11 : 0.8, kd: last, en: 2, small: !last, big: last })
          sp.n++
          if (!r || sp.n >= P.hits) {
            sp.stage = 'rec'
            sp.t = 0
          }
        }
      } else if (++sp.t >= 16) endSpecial(f)
      break
    }
    case 'smash':
      if (t === 24) {
        const aoe = dx < 140 && o.y < 50 && tryHit(m, f, o, { dmg: 100, kd: true, kb: 9, lift: 7, en: 4, big: true }) !== 0
        for (const d of [-1, 1]) m.proj.push({ type: 'wave', owner: f.idx, x: f.x + d * 70, y: 0, vx: d * 11, t: 0, mode: 0, hit: aoe, life: 60 })
        ev(m, 'shake', f.x, 0, { power: 12 })
      }
      if (t >= 60) endSpecial(f)
      break
    case 'web':
      sp.stage ??= 'cast'
      if (sp.stage === 'cast') {
        if (t === 8) {
          m.proj.push({ type: 'web', owner: f.idx, x: f.x + dir * 40, y: 145 * f.scale, vx: dir * 24, t: 0, mode: 0, dist: 0 })
          sp.stage = 'wait'
          sp.t = 0
        }
      } else if (sp.stage === 'wait') {
        if (sp.pulled) {
          sp.stage = 'pull'
          sp.t = 0
        } else if (++sp.t > 26) {
          sp.stage = 'rec'
          sp.t = 0
        }
      } else if (sp.stage === 'pull') {
        if (o.state === 'hit') {
          o.x = clampX(o.x + (sp.tx - o.x) * 0.3)
          o.stun = Math.max(o.stun, 8)
        }
        if (++sp.t >= 14) {
          sp.stage = 'up'
          sp.t = 0
        }
      } else if (sp.stage === 'up') {
        sp.t++
        if (sp.t === 4) tryHit(m, f, o, { dmg: 115, kd: true, kb: 4, lift: 15, kdT: 62, unblock: true, big: true, en: 4 })
        if (sp.t >= 16) {
          sp.stage = 'rec'
          sp.t = 0
        }
      } else if (++sp.t >= 14) endSpecial(f)
      break
    case 'lunge':
      if (t >= 6 && t < 17) {
        f.vx = dir * 22
        if (!sp.done && hitMelee(m, f, o, { x0: 0, reach: 80, y0: 30, y1: 160, dmg: 90, stun: 26, bstun: 14, kb: 7, en: 6, big: true, bleed: true })) sp.done = true
      }
      if (t >= 36) endSpecial(f)
      break
    case 'counter':
      f.counterOn = !sp.done && t >= 4 && t < 84
      if (t >= 92 || (sp.done && t >= sp.t0 + 16)) endSpecial(f)
      break
    case 'combo': {
      f.parryOn = t < 14 && !sp.parried
      if (t >= 16 && t < 46) f.vx = dir * 3
      const k = sp.parried ? 1.35 : 1
      if (t === 18 || t === 30 || t === 42) {
        const last = t === 42
        hitMelee(m, f, o, { x0: 0, reach: 135, y0: 30, y1: 170, dmg: (last ? 70 : 44) * k, stun: 18, bstun: 10, kb: last ? 9 : 2, kd: last, en: 4, big: last })
      }
      if (t >= 60) endSpecial(f)
      break
    }
    case 'spin':
      if (t >= 6 && t < 50) f.vx = dir * 3.2
      if (t === 10 || t === 18 || t === 26 || t === 34 || t === 42) {
        const last = t === 42
        hitMelee(m, f, o, { both: true, reach: 150, y0: 20, y1: 170, dmg: last ? 45 : 30, stun: 12, bstun: 6, kb: last ? 10 : 1.2, kd: last, steal: 0.5, en: 2, small: !last, big: last })
      }
      if (t >= 62) endSpecial(f)
      break
    case 'grav':
      if (t === 16) {
        if (dx < 580 && o.state !== 'knock' && o.invuln <= 0) {
          sp.hit = true
          sp.tx = clampX(f.x + dir * 120)
          cancelAction(o)
          o.state = 'hit'
          o.stun = 90
          ev(m, 'grav', o.x, 100, {})
        } else endSpecial(f)
      } else if (sp.hit && t > 16 && t <= 42) {
        o.x = clampX(o.x + (sp.tx - o.x) * 0.2)
        o.y += (170 - o.y) * 0.2
        o.vy = 0
        o.hold = 2
        o.stun = Math.max(o.stun, 8)
      } else if (sp.hit && t === 46) {
        o.hold = 0
        tryHit(m, f, o, { dmg: 135, kd: true, kb: 3, lift: -12, kdT: 70, unblock: true, big: true, en: 4 })
        ev(m, 'shake', o.x, 0, { power: 10 })
      }
      if (t >= 76) endSpecial(f)
      break
    default:
      endSpecial(f)
  }
}

// ───────────── projectiles and zones ─────────────
function stepProjectiles(m) {
  for (const p of m.proj) {
    const o = m.fighters[p.owner]
    const v = m.fighters[1 - p.owner]
    p.t++
    if (p.type === 'shield') {
      if (p.mode === 0) {
        p.x += p.vx
        p.dist += Math.abs(p.vx)
        if (p.dist >= 440 || p.x < WALL_L - 30 || p.x > WALL_R + 30) p.mode = 1
      } else {
        p.x += (Math.sign(o.x - p.x) || 1) * 18
        p.y += (140 * o.scale - p.y) * 0.1
        if (Math.abs(o.x - p.x) < 34) p.dead = true
      }
      if (!p.hit[p.mode] && overlap({ x0: p.x - 34, x1: p.x + 34, y0: p.y - 34, y1: p.y + 34 }, hurtBox(v))) {
        const r = tryHit(m, o, v, { dmg: 72, stun: 22, bstun: 12, kb: 5, en: 3, kd: p.mode === 1, small: true })
        if (r) {
          p.hit[p.mode] = true
          if (p.mode === 0) p.mode = 1
        }
      }
    } else if (p.type === 'web') {
      p.x += p.vx
      p.dist += Math.abs(p.vx)
      if (p.dist > 620 || p.x < WALL_L - 40 || p.x > WALL_R + 40) p.dead = true
      else if (overlap({ x0: p.x - 14, x1: p.x + 14, y0: p.y - 14, y1: p.y + 14 }, hurtBox(v))) {
        const r = tryHit(m, o, v, { dmg: 25, stun: 70, bstun: 6, kb: 0, en: 2, small: true })
        if (r === 1 && o.sp && o.move === 'web') {
          o.sp.pulled = true
          o.sp.tx = clampX(o.x + o.face * 85)
        }
        if (r) p.dead = true
      }
    } else if (p.type === 'wave') {
      p.x += p.vx
      if (p.t >= p.life || p.x < WALL_L - 60 || p.x > WALL_R + 60) p.dead = true
      if (!p.hit && v.y < 45 && Math.abs(v.x - p.x) < 44) {
        if (tryHit(m, o, v, { dmg: 100, kd: true, kb: 8, lift: 9, en: 3, big: true })) p.hit = true
      }
    }
  }
  m.proj = m.proj.filter(p => !p.dead)
}

function stepZones(m) {
  for (const z of m.zones) {
    z.t++
    const o = m.fighters[z.owner]
    const v = m.fighters[1 - z.owner]
    if (!z.hit && z.t >= z.tele && z.t < z.tele + z.act && Math.abs(v.x - z.x) < z.w / 2 + 24) {
      if (tryHit(m, o, v, { dmg: z.dmg, stun: 26, bstun: 14, kb: 5, kd: true, lift: 7, en: 3, big: true })) z.hit = true
    }
    if (z.t === z.tele) ev(m, 'bolt', z.x, 0, {})
  }
  m.zones = m.zones.filter(z => z.t < z.tele + z.act + 10)
}

// ───────────── fighters ─────────────
function startAttack(f, key) {
  const mv = MOVES[key]
  f.state = 'attack'
  f.move = key
  f.st = 0
  f.hitDone = false
  if (mv.flying && f.y <= 0) {
    f.vy = 10.5
    f.vx = f.face * 7.5
  }
}

function stepAttack(m, f, o) {
  const mv = MOVES[f.move]
  const landed = physics(f)
  if (mv.flying && landed && f.st < mv.start + mv.active) {
    f.st = mv.start + mv.active
    f.vx = 0
  }
  if (!f.hitDone && f.st >= mv.start && f.st < mv.start + mv.active && hitMelee(m, f, o, mv)) f.hitDone = true
  if (f.state === 'attack' && f.st >= mv.start + mv.active + mv.rec) {
    f.state = f.y > 0 ? 'jump' : 'idle'
    f.move = ''
  }
}

function updateFighter(m, f, o, mask, live) {
  const press = mask & ~f.prev
  f.prev = mask
  if (f.flash > 0) f.flash--
  if (f.invuln > 0) f.invuln--
  if (f.comboT > 0 && --f.comboT === 0) f.combo = 0
  if (f.bleedT > 0) {
    f.bleedT--
    if (live && f.bleedT % 20 === 0) {
      f.hp = Math.max(0, f.hp - 3)
      ev(m, 'bleed', f.x, 120, { idx: f.idx })
    }
  }
  if (press & ATTACK_BITS) {
    f.buf = press & ATTACK_BITS
    f.bufT = 8
  } else if (f.bufT > 0 && --f.bufT === 0) f.buf = 0
  f.st++
  switch (f.state) {
    case 'hit':
      if (--f.stun <= 0) f.state = f.y > 0 ? 'jump' : 'idle'
      physics(f)
      return
    case 'knock':
      physics(f)
      if (f.st >= f.knockT) {
        f.state = 'idle'
        f.invuln = 12
      }
      return
    case 'attack':
      stepAttack(m, f, o)
      return
    case 'special':
      stepSpecial(m, f, o)
      if (f.state === 'special') physics(f)
      return
    case 'victory':
      physics(f)
      return
    default:
  }
  if (f.bstun > 0) {
    f.bstun--
    f.state = 'block'
    physics(f)
    return
  }
  if (f.y <= 0) f.face = o.x >= f.x ? 1 : -1
  if (!live) {
    locomote(f, 0)
    return
  }
  if (press & INPUT.SPECIAL && f.en >= ENERGY_MAX) {
    startSpecial(m, f)
    return
  }
  if (f.bufT > 0 && f.buf) {
    const key = ATTACK_ORDER.find(k => f.buf & MOVES[k].bit)
    f.buf = 0
    f.bufT = 0
    if (key) {
      startAttack(f, key)
      return
    }
  }
  locomote(f, mask)
}

function separate(m) {
  const [a, b] = m.fighters
  if (a.y > 40 || b.y > 40 || a.state === 'knock' || b.state === 'knock' || a.hold || b.hold) return
  const min = (a.scale + b.scale) * 28
  const d = b.x - a.x
  if (Math.abs(d) >= min) return
  const push = (min - Math.abs(d)) / 2
  const dir = d >= 0 ? 1 : -1
  a.x = clampX(a.x - dir * push)
  b.x = clampX(b.x + dir * push)
}

// ───────────── the match ─────────────
function endRound(m, winner, why) {
  m.phase = 'ko'
  m.phaseT = 0
  m.roundWinner = winner
  m.timeUp = why === 'time'
  m.proj = []
  m.zones = []
  if (winner >= 0) m.wins[winner]++
  m.fighters.forEach((f, i) => {
    cancelAction(f)
    f.bleedT = 0
    if (i !== winner) {
      const away = Math.sign(f.x - m.fighters[1 - i].x) || 1
      f.state = 'knock'
      f.st = 0
      f.knockT = 99999
      f.vy = 7
      f.vx = away * 8
    } else {
      f.state = 'idle'
    }
  })
  ev(m, why === 'time' ? 'timeup' : 'ko', m.fighters[winner < 0 ? 0 : 1 - winner].x, 100, {})
}

/** Advances the match one tick. in0 and in1 are INPUT bitmasks. */
export function step(m, in0 = 0, in1 = 0) {
  m.frame++
  if (m.hitstop > 0) {
    m.hitstop--
    return
  }
  m.phaseT++
  const [a, b] = m.fighters
  if (m.phase === 'intro') {
    for (const f of m.fighters) {
      f.face = f === a ? (b.x >= a.x ? 1 : -1) : a.x >= b.x ? 1 : -1
      physics(f)
    }
    if (m.phaseT >= INTRO_FRAMES) {
      m.phase = 'fight'
      m.phaseT = 0
    }
    return
  }
  const live = m.phase === 'fight'
  updateFighter(m, a, b, live ? in0 : 0, live)
  updateFighter(m, b, a, live ? in1 : 0, live)
  separate(m)
  stepProjectiles(m)
  stepZones(m)
  if (m.phase === 'fight') {
    m.timer--
    if (a.hp <= 0 || b.hp <= 0) {
      endRound(m, a.hp <= 0 && b.hp <= 0 ? -1 : a.hp > 0 ? 0 : 1, 'ko')
    } else if (m.timer <= 0) {
      const ra = a.hp / a.hpMax
      const rb = b.hp / b.hpMax
      endRound(m, ra === rb ? -1 : ra > rb ? 0 : 1, 'time')
    }
  } else if (m.phase === 'ko') {
    const w = m.roundWinner
    if (m.phaseT === 70 && w >= 0 && m.fighters[w].state === 'idle') {
      m.fighters[w].state = 'victory'
      m.fighters[w].st = 0
    }
    if (m.phaseT >= KO_FRAMES) {
      if (w >= 0 && m.wins[w] >= ROUNDS_TO_WIN) {
        m.phase = 'matchEnd'
        m.phaseT = 0
        m.winner = w
        if (m.fighters[w].state !== 'victory') {
          m.fighters[w].state = 'victory'
          m.fighters[w].st = 0
        }
      } else {
        m.round++
        resetRound(m)
      }
    }
  }
}

/** Banner text for the current phase, from the point of view of fighter index `me`. */
export function bannerOf(v, me = 0) {
  const final = v.wins[0] === ROUNDS_TO_WIN - 1 && v.wins[1] === ROUNDS_TO_WIN - 1
  if (v.phase === 'intro') {
    if (v.phaseT < 50) return final ? 'FINAL ROUND' : `ROUND ${v.round}`
    return 'FIGHT!'
  }
  if (v.phase === 'fight') return v.phaseT < 24 ? 'FIGHT!' : ''
  if (v.phase === 'ko') {
    if (v.phaseT < 70) return v.timeUp ? 'TIME UP' : 'K.O.'
    return v.roundWinner < 0 ? 'DRAW' : v.roundWinner === me ? 'YOU WIN' : 'YOU LOSE'
  }
  if (v.phase === 'matchEnd') return v.winner === me ? 'YOU WIN' : 'YOU LOSE'
  return ''
}

// ───────────── network snapshots ─────────────
const r1 = n => Math.round(n * 10) / 10

/** A compact, JSON-safe copy of everything the guest needs to draw the match. */
export function snapshot(m, ack = 0) {
  return {
    fr: m.frame, ph: m.phase, pt: m.phaseT, rd: m.round, w: [...m.wins], tm: m.timer, win: m.winner, rw: m.roundWinner, tu: m.timeUp ? 1 : 0, ack,
    f: m.fighters.map(f => ({
      x: r1(f.x), y: r1(f.y), fc: f.face, s: f.state, mv: f.move, st: f.st, hp: Math.round(f.hp), en: Math.round(f.en),
      cb: f.combo, fl: f.flash, co: f.counterOn ? 1 : 0, pa: f.parryOn ? 1 : 0, vx: r1(f.vx), vy: r1(f.vy), hv: f.hover,
    })),
    p: m.proj.map(p => ({ t: p.type, x: r1(p.x), y: r1(p.y), o: p.owner, m: p.mode || 0, tt: p.t })),
    z: m.zones.map(z => ({ x: r1(z.x), t: z.t, te: z.tele, w: z.w, o: z.owner })),
    ev: m.events,
  }
}

/** Rebuilds render-ready state from a snapshot. `base` carries what never changes: chars, scale and max health. */
export function viewFromSnapshot(s, base) {
  return {
    frame: s.fr, phase: s.ph, phaseT: s.pt, round: s.rd, wins: s.w, timer: s.tm, winner: s.win, roundWinner: s.rw, timeUp: Boolean(s.tu),
    fighters: s.f.map((f, i) => ({
      idx: i, char: base.chars[i], scale: base.scales[i], hpMax: base.hpMax[i],
      x: f.x, y: f.y, face: f.fc, state: f.s, move: f.mv, st: f.st, hp: f.hp, en: f.en, combo: f.cb, flash: f.fl,
      counterOn: Boolean(f.co), parryOn: Boolean(f.pa),
    })),
    proj: s.p.map(p => ({ type: p.t, x: p.x, y: p.y, owner: p.o, mode: p.m, t: p.tt })),
    zones: s.z.map(z => ({ x: z.x, t: z.t, tele: z.te, w: z.w, owner: z.o })),
  }
}
