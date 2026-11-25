// The fight simulation: physics, platforms, combat, projectiles and hazards. It is plain JavaScript with no DOM,
// canvas or randomness, so the same inputs always give the same fight and the whole thing can be unit tested.
//
// Time runs in fixed steps (DT). Each fighter is driven by an input object, from the keyboard, the touch buttons
// or the AI, with these fields: { left, right, jump, attack, block, special }.
// Things that happened this step (hits, jumps, KOs…) are pushed on `match.events` for the engine to turn into
// sound and particles; the engine empties the list every frame.
import { ARENAS, FIGHTER, H, MAX_HP, W, WEAPONS, getLayout } from './data'

export const DT = 1 / 60
export const MATCH_TIME = 120

const GRAVITY = 2300
const RUN = 330
const JUMP = 840
const AIR_JUMP = 760
const MAX_FALL = 1400
const GROUND_ACCEL = 3200
const AIR_ACCEL = 1700
const GROUND_FRICTION = 2200
const ICE_ACCEL = 420
const ICE_FRICTION = 240
const COYOTE = 0.09
const BUFFER = 0.12

export const NEUTRAL = Object.freeze({ left: false, right: false, jump: false, attack: false, block: false, special: false })

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const approach = (v, to, d) => (v < to ? Math.min(to, v + d) : Math.max(to, v - d))

/**
 * @typedef {Object} FighterSpec
 * @property {string} name
 * @property {string} weapon       key of WEAPONS
 * @property {string} [color] @property {string} [skin] @property {string} [effect] @property {string} [design]
 * @property {number} [hpMax]      defaults to MAX_HP
 * @property {number} [dmgMult]    damage dealt multiplier, 1 = normal
 * @property {boolean} [isAI]
 */

function createFighter(spec, id, spawn) {
  const hpMax = spec.hpMax || MAX_HP
  return {
    id,
    name: spec.name || `Player ${id + 1}`,
    weapon: WEAPONS[spec.weapon] ? spec.weapon : 'sword',
    color: spec.color || 'blue',
    skin: spec.skin || 'classic',
    effect: spec.effect || 'none',
    design: spec.design || 'classic',
    isAI: Boolean(spec.isAI),
    w: FIGHTER.w,
    h: FIGHTER.h,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    face: id === 0 ? 1 : -1,
    hp: hpMax,
    hpMax,
    dmgMult: spec.dmgMult || 1,
    onGround: false,
    platform: -1,
    jumps: 1,
    coyote: 0,
    atk: null, // { t, dur, swing, hit: [ids], fired, hand }
    spec: null, // { def, t, hit: [ids], ... }
    blocking: false,
    guard: 100,
    guardBreak: 0,
    hurt: 0,
    tough: 0,
    invuln: 0,
    shield: 0,
    rage: 0,
    cdSpec: 2,
    spikeCd: 0,
    hand: 0,
    buf: { jump: 0, attack: 0, special: 0 },
    prev: { jump: false, attack: false, special: false },
    anim: 0,
    deadT: 0,
    state: 'idle',
    spawn,
    stats: { dealt: 0, taken: 0, hits: 0 },
  }
}

/**
 * @param {{ arenaId?: string, variant?: number, fighters: FighterSpec[] }} opts
 */
export function createMatch({ arenaId = 'floating', variant = 0, fighters }) {
  const { arena, layout, variant: v } = getLayout(arenaId, variant)
  const plats = layout.platforms.map(p => ({ ...p, bx: p.x, dx: 0, x: p.x + (p.move ? Math.sin(p.move.phase || 0) * p.move.range : 0) }))
  return {
    t: 0,
    status: 'fight', // 'fight' | 'over'
    winner: -1, // fighter id, or -1 for a draw / not decided
    reason: '', // 'ko' | 'time'
    arena,
    variant: v,
    plats,
    spikes: layout.spikes,
    pit: arena.pit,
    fighters: fighters.map((spec, i) => createFighter(spec, i, layout.spawns[i % layout.spawns.length])),
    projectiles: [],
    bolts: [],
    pending: [], // melee hits found this step, applied together so a trade is fair
    events: [],
    hitstop: 0,
    swingId: 0,
    nextId: 1,
  }
}

const emit = (m, e) => {
  if (m.events.length > 300) m.events.shift()
  m.events.push(e)
}

export const spikeActive = (s, t) => !s.period || (t + (s.phase || 0)) % s.period > s.period * 0.5
/** 0..1 while a timed spike is about to flare, for the warning glow. */
export const spikeWarning = (s, t) => {
  if (!s.period) return 0
  const ph = ((t + (s.phase || 0)) % s.period) / s.period
  return ph > 0.3 && ph <= 0.5 ? (ph - 0.3) / 0.2 : 0
}

const overlapsPlat = (f, p) => f.x + f.w / 2 > p.x && f.x - f.w / 2 < p.x + p.w && f.y > p.y && f.y - f.h < p.y + p.h
const boxHits = (b, e) => b.x1 > e.x - e.w / 2 && b.x0 < e.x + e.w / 2 && b.y1 > e.y - e.h && b.y0 < e.y

const enemiesOf = (m, f) => m.fighters.filter(e => e !== f && e.state !== 'dead')
const dmgOf = (f, base) => base * f.dmgMult * (f.rage > 0 ? WEAPONS[f.weapon].special.rage || 1 : 1)

// ───────────── hits ─────────────
function ko(m, tgt) {
  tgt.hp = 0
  tgt.state = 'dead'
  tgt.deadT = 0
  tgt.atk = null
  tgt.spec = null
  tgt.blocking = false
  if (m.status === 'over') {
    if (m.fighters.every(f => f.state === 'dead')) m.winner = -1 // both fighters fell on the same step
    return
  }
  m.status = 'over'
  m.reason = 'ko'
  const other = m.fighters.find(f => f !== tgt)
  m.winner = other ? other.id : -1
  emit(m, { type: 'ko', id: tgt.id, x: tgt.x, y: tgt.y - 45 })
}

/**
 * Applies one hit. `h` is { dmg, kb, up, dir, fromX, heavy, unblockable }. Returns true if it connected (a
 * blocked hit counts, a shielded or invulnerable target does not).
 */
function applyHit(m, src, tgt, h) {
  if ((m.status !== 'fight' && !m.trade) || tgt.state === 'dead' || tgt.invuln > 0) return false
  const px = tgt.x
  const py = tgt.y - tgt.h * 0.55
  if (tgt.shield > 0) {
    tgt.vx += h.dir * 60
    emit(m, { type: 'shield', id: tgt.id, x: px, y: py })
    return false
  }
  const facingSource = tgt.face === (h.fromX > tgt.x ? 1 : -1)
  if (tgt.blocking && facingSource && !h.unblockable) {
    tgt.hp = Math.max(1, tgt.hp - Math.max(0.5, h.dmg * 0.1))
    tgt.guard -= h.dmg * 2.4 + 4
    tgt.vx += h.dir * h.kb * 0.22
    m.hitstop = Math.max(m.hitstop, 0.04)
    emit(m, { type: 'block', id: tgt.id, by: src ? src.id : -1, x: px + tgt.face * 14, y: py })
    if (tgt.guard <= 0) {
      tgt.guard = 0
      tgt.blocking = false
      tgt.guardBreak = 1
      emit(m, { type: 'guardbreak', id: tgt.id, x: px, y: py })
    }
    return true
  }
  const dmg = h.dmg
  tgt.hp -= dmg
  tgt.stats.taken += dmg
  if (src) {
    src.stats.dealt += dmg
    src.stats.hits += 1
  }
  const kbm = 1 + (1 - clamp(tgt.hp / tgt.hpMax, 0, 1)) * 0.7
  const soft = tgt.tough > 0 ? 0.5 : 1
  tgt.vx = h.dir * h.kb * kbm * soft
  tgt.vy = -h.up * kbm * soft
  if (tgt.vy < 0) {
    tgt.onGround = false
    tgt.platform = -1
  }
  tgt.hurt = tgt.tough > 0 ? 0.08 : clamp(0.16 + dmg * 0.012, 0.18, 0.5)
  tgt.atk = null
  tgt.spec = null
  tgt.blocking = false
  m.hitstop = Math.max(m.hitstop, Math.min(0.12, 0.04 + dmg * 0.003))
  emit(m, { type: 'hit', id: tgt.id, by: src ? src.id : -1, x: px, y: py, dmg, dir: h.dir, heavy: Boolean(h.heavy) || dmg >= 16 })
  if (tgt.hp <= 0) ko(m, tgt)
  return true
}

// ───────────── projectiles ─────────────
function spawnProjectile(m, f, p) {
  m.projectiles.push({
    id: m.nextId++,
    owner: f.id,
    kind: 'arrow',
    x: f.x + f.face * 30,
    y: f.y - 62,
    vx: 0,
    vy: 0,
    g: 0,
    r: 8,
    dmg: 0,
    kb: 200,
    up: 80,
    life: 1.4,
    pierce: false,
    hit: [],
    ...p,
  })
}

function updateProjectiles(m, dt) {
  for (const p of m.projectiles) {
    p.life -= dt
    p.vy += p.g * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    if (p.x < -200 || p.x > W + 200 || p.y > H + 200 || p.y < -400) p.life = 0
    if (p.life <= 0) continue
    if (m.plats.some(pl => p.x > pl.x && p.x < pl.x + pl.w && p.y > pl.y && p.y < pl.y + pl.h)) {
      p.life = 0
      emit(m, { type: 'wall', x: p.x, y: p.y, kind: p.kind })
      continue
    }
    const owner = m.fighters[p.owner]
    for (const e of m.fighters) {
      if (e.id === p.owner || e.state === 'dead' || p.hit.includes(e.id)) continue
      const cx = clamp(p.x, e.x - e.w / 2, e.x + e.w / 2)
      const cy = clamp(p.y, e.y - e.h, e.y)
      if ((p.x - cx) ** 2 + (p.y - cy) ** 2 > p.r * p.r) continue
      p.hit.push(e.id)
      const dir = p.vx >= 0 ? 1 : -1
      const connected = applyHit(m, owner, e, { dmg: p.dmg, kb: p.kb, up: p.up, dir, fromX: p.x - dir * 20, heavy: p.kind === 'wave' })
      if (!p.pierce || !connected) p.life = 0
      if (p.life <= 0) break
    }
  }
  m.projectiles = m.projectiles.filter(p => p.life > 0)
}

function updateBolts(m, dt) {
  for (const b of m.bolts) {
    b.t += dt
    const owner = m.fighters[b.owner]
    const tgt = owner ? enemiesOf(m, owner)[0] : null
    if (tgt && b.t < b.warn - 0.22) b.x = approach(b.x, tgt.x, 280 * dt) // follows its target until the last moment
    if (tgt && b.t < b.warn) b.y = tgt.y
    if (!b.struck && b.t >= b.warn) {
      b.struck = true
      emit(m, { type: 'bolt', x: b.x })
      for (const e of owner ? enemiesOf(m, owner) : []) {
        if (Math.abs(e.x - b.x) < b.radius + e.w / 2) {
          applyHit(m, owner, e, { dmg: b.dmg, kb: b.kb, up: 360, dir: e.x >= b.x ? 1 : -1, fromX: b.x, heavy: true, unblockable: true })
        }
      }
    }
  }
  m.bolts = m.bolts.filter(b => b.t < b.warn + 0.35)
}

// ───────────── fighter actions ─────────────
function startAttack(m, f) {
  const w = WEAPONS[f.weapon]
  f.atk = { t: 0, dur: w.dur, swing: ++m.swingId, hit: [], fired: false, hand: f.hand }
  f.hand ^= 1
  f.buf.attack = 0
  if (f.onGround) f.vx += f.face * 70
  emit(m, { type: 'swing', id: f.id, weapon: f.weapon, x: f.x, y: f.y - 60 })
}

function updateAttack(m, f, dt) {
  const w = WEAPONS[f.weapon]
  const a = f.atk
  a.t += dt
  const p = a.t / a.dur
  if (w.style === 'bow') {
    if (!a.fired && p >= w.hit[0]) {
      a.fired = true
      spawnProjectile(m, f, { kind: 'arrow', vx: f.face * w.arrowSpeed, vy: 0, g: 200, dmg: dmgOf(f, w.damage), kb: w.kb, up: w.up })
      emit(m, { type: 'shoot', id: f.id, x: f.x, y: f.y - 62 })
    }
  } else if (p >= w.hit[0] && p < w.hit[1]) {
    const x0 = f.x - f.face * 6
    const x1 = f.x + f.face * w.range
    const box = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: f.y - w.top, y1: f.y - w.bottom }
    for (const e of enemiesOf(m, f)) {
      if (a.hit.includes(e.id) || !boxHits(box, e)) continue
      a.hit.push(e.id) // one swing can hit a target once, however long the box overlaps it
      queueHit(m, f, e, { dmg: dmgOf(f, w.damage), kb: w.kb, up: w.up, dir: f.face, fromX: f.x, heavy: w.damage >= 15 })
    }
  }
  if (a.t >= a.dur) f.atk = null
}

function startSpecial(m, f) {
  const def = WEAPONS[f.weapon].special
  f.spec = { def, t: 0, hit: [], phase: 'start', done: false, slamT: 0 }
  f.cdSpec = def.cd
  f.buf.special = 0
  f.atk = null
  f.blocking = false
  emit(m, { type: 'special', id: f.id, kind: def.kind, x: f.x, y: f.y - 50 })
}

function shockwave(m, f, def) {
  emit(m, { type: 'shock', x: f.x, y: f.y, radius: def.radius })
  for (const e of enemiesOf(m, f)) {
    if (Math.abs(e.x - f.x) > def.radius || e.y < f.y - 120 || e.y > f.y + 80) continue // jump it to dodge
    queueHit(m, f, e, { dmg: dmgOf(f, def.damage), kb: 460, up: def.launch, dir: e.x >= f.x ? 1 : -1, fromX: f.x, heavy: true, unblockable: true })
  }
}

const queueHit = (m, src, tgt, h) => m.pending.push({ src, tgt, h })

/** Returns true while the special has taken over movement (dash). */
function updateSpecial(m, f, dt) {
  const s = f.spec
  const d = s.def
  const wp = WEAPONS[f.weapon]
  s.t += dt
  switch (d.kind) {
    case 'wave':
      if (!s.done && s.t >= 0.14) {
        s.done = true
        spawnProjectile(m, f, { kind: 'wave', vx: f.face * d.speed, r: 40, dmg: dmgOf(f, d.damage), kb: d.kb, up: 260, life: 1.1, pierce: true, y: f.y - 50 })
      }
      if (s.t >= 0.32) f.spec = null
      break
    case 'volley':
      if (!s.done && s.t >= 0.18) {
        s.done = true
        for (const a of [-0.16, 0, 0.16]) {
          spawnProjectile(m, f, { kind: 'arrow', vx: f.face * Math.cos(a) * d.speed, vy: Math.sin(a) * d.speed, g: 260, dmg: dmgOf(f, d.damage), kb: d.kb, up: 100 })
        }
        emit(m, { type: 'shoot', id: f.id, x: f.x, y: f.y - 62 })
      }
      if (s.t >= 0.4) f.spec = null
      break
    case 'shield':
      if (!s.done) {
        s.done = true
        f.shield = d.duration
        f.rage = d.duration
      }
      if (s.t >= 0.25) f.spec = null
      break
    case 'lightning':
      if (!s.done && s.t >= 0.2) {
        s.done = true
        const tgt = enemiesOf(m, f)[0]
        m.bolts.push({ owner: f.id, x: tgt ? tgt.x : f.x + f.face * 200, y: tgt ? tgt.y : f.y, t: 0, warn: d.warn, struck: false, dmg: dmgOf(f, d.damage), radius: d.radius, kb: d.kb })
      }
      if (s.t >= 0.45) f.spec = null
      break
    case 'smash':
      if (s.phase === 'start') {
        s.phase = 'rise'
        f.vy = -d.jump
        f.onGround = false
        f.platform = -1
      } else if (s.phase === 'rise' && s.t >= 0.32) {
        s.phase = 'slam'
        s.slamT = 0
        f.vy = 1500
      } else if (s.phase === 'slam') {
        s.slamT += dt
        if ((f.onGround && s.slamT > 0.03) || s.t > 1.6) {
          shockwave(m, f, d)
          s.phase = 'land'
          s.landT = 0
        }
      } else if (s.phase === 'land') {
        s.landT += dt
        if (s.landT >= 0.22) f.spec = null
      }
      break
    case 'spin': {
      const pulse = Math.floor(s.t / d.pulse)
      if (pulse > (s.pulse ?? -1) && s.t < d.duration) {
        s.pulse = pulse
        const box = { x0: f.x - d.radius, x1: f.x + d.radius, y0: f.y - f.h - 10, y1: f.y + 10 }
        for (const e of enemiesOf(m, f)) {
          if (!boxHits(box, e)) continue
          queueHit(m, f, e, { dmg: dmgOf(f, d.damage), kb: d.kb, up: 200, dir: e.x >= f.x ? 1 : -1, fromX: f.x, unblockable: false })
        }
        emit(m, { type: 'spin', id: f.id, x: f.x, y: f.y - 45 })
      }
      if (s.t >= d.duration) f.spec = null
      break
    }
    case 'dash': {
      f.vx = f.face * d.speed
      f.invuln = Math.max(f.invuln, dt * 2)
      const x0 = f.x
      const x1 = f.x + f.face * d.reach
      const box = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: f.y - wp.top, y1: f.y - 4 }
      for (const e of enemiesOf(m, f)) {
        if (s.hit.includes(e.id) || !boxHits(box, e)) continue
        s.hit.push(e.id)
        queueHit(m, f, e, { dmg: dmgOf(f, d.damage), kb: d.kb, up: 220, dir: f.face, fromX: f.x, heavy: true })
      }
      if (s.t >= d.duration) {
        f.spec = null
        f.vx = f.face * RUN
      }
      return true
    }
    default:
      f.spec = null
  }
  return false
}

// ───────────── physics ─────────────
function physics(m, f, dt) {
  const wasGround = f.onGround
  if (f.onGround && f.platform >= 0 && m.plats[f.platform]) f.x += m.plats[f.platform].dx
  const slam = f.spec && f.spec.def.kind === 'smash' && f.spec.phase === 'slam'
  f.vy = Math.min(slam ? 1600 : MAX_FALL, f.vy + GRAVITY * dt)
  const impact = f.vy

  f.x += f.vx * dt
  for (const p of m.plats) {
    if (!overlapsPlat(f, p)) continue
    f.x = f.vx > 0 || (f.vx === 0 && f.x < p.x + p.w / 2) ? p.x - f.w / 2 : p.x + p.w + f.w / 2
    f.vx = 0
  }

  const prevY = f.y
  f.y += f.vy * dt
  f.onGround = false
  f.platform = -1
  for (let i = 0; i < m.plats.length; i++) {
    const p = m.plats[i]
    if (!overlapsPlat(f, p)) continue
    if (f.vy >= 0 && prevY <= p.y + 1) {
      f.y = p.y
      f.vy = 0
      f.onGround = true
      f.platform = i
    } else if (f.vy < 0 && prevY - f.h >= p.y + p.h - 1) {
      f.y = p.y + p.h + f.h
      f.vy = 0
    } else {
      // squeezed in from the side (a moving platform): step out the short way so nobody is ever stuck inside
      f.x = f.x + f.w / 2 - p.x < p.x + p.w - (f.x - f.w / 2) ? p.x - f.w / 2 : p.x + p.w + f.w / 2
    }
  }

  if (f.onGround) {
    f.jumps = 1
    f.coyote = COYOTE
    if (!wasGround && impact > 500) emit(m, { type: 'land', id: f.id, x: f.x, y: f.y, power: Math.min(1, impact / 1200) })
  } else f.coyote = Math.max(0, f.coyote - dt)
}

function movePlatforms(m, dt) {
  for (const p of m.plats) {
    if (!p.move) {
      p.dx = 0
      continue
    }
    const nx = p.bx + Math.sin(m.t * p.move.speed + (p.move.phase || 0)) * p.move.range
    p.dx = nx - p.x
    p.x = nx
  }
  void dt
}

function respawn(m, f) {
  f.x = f.spawn.x
  f.y = f.spawn.y - 4
  f.vx = 0
  f.vy = 0
  f.atk = null
  f.spec = null
  f.blocking = false
  f.hurt = 0
  f.guardBreak = 0
  f.invuln = 2
  f.face = f.id === 0 ? 1 : -1
  emit(m, { type: 'respawn', id: f.id, x: f.x, y: f.y })
}

function fallOut(m, f) {
  const dmg = m.pit.damage
  f.hp -= dmg
  f.stats.taken += dmg
  emit(m, { type: 'out', id: f.id, x: clamp(f.x, 0, W), y: Math.min(f.y, m.pit.y), kind: m.pit.kind, dmg })
  if (f.hp <= 0) ko(m, f)
  else respawn(m, f)
}

// ───────────── one fighter, one step ─────────────
function updateFighter(m, f, inp, dt) {
  f.anim += dt

  if (f.state === 'dead') {
    f.deadT += dt
    f.vx = approach(f.vx, 0, GROUND_FRICTION * dt)
    physics(m, f, dt)
    return
  }

  for (const k of ['jump', 'attack', 'special']) {
    f.buf[k] = inp[k] && !f.prev[k] ? BUFFER : Math.max(0, f.buf[k] - dt)
    f.prev[k] = Boolean(inp[k])
  }
  f.invuln = Math.max(0, f.invuln - dt)
  f.shield = Math.max(0, f.shield - dt)
  f.rage = Math.max(0, f.rage - dt)
  f.spikeCd = Math.max(0, f.spikeCd - dt)
  f.cdSpec = Math.max(0, f.cdSpec - dt)
  f.tough = Math.max(0, f.tough - dt)
  if (f.hurt > 0) {
    f.hurt -= dt
    if (f.hurt <= 0) f.tough = 0.5
  }
  if (f.guardBreak > 0) {
    f.guardBreak -= dt
    if (f.guardBreak <= 0) f.guard = 45
  }
  const stunned = f.hurt > 0 || f.guardBreak > 0
  let dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0)

  // facing: free until a swing or special has started
  const committed = (f.atk && f.atk.t > 0) || (f.spec && f.spec.def.kind !== 'spin')
  if (!stunned && !committed && dir !== 0) f.face = dir

  let lockVel = false
  if (f.spec) lockVel = updateSpecial(m, f, dt)
  if (f.atk) updateAttack(m, f, dt)

  const busy = Boolean(f.atk || f.spec)
  f.blocking = Boolean(inp.block && f.onGround && !stunned && !busy && f.guard > 0)
  if (!f.blocking && f.guardBreak <= 0) f.guard = Math.min(100, f.guard + 16 * dt)

  if (!stunned && f.buf.special > 0 && f.cdSpec <= 0 && !f.spec) startSpecial(m, f)
  else if (!stunned && f.buf.attack > 0 && !f.atk && !f.spec && !f.blocking) startAttack(m, f)

  const inSpecial = Boolean(f.spec)
  if (!stunned && !inSpecial && f.buf.jump > 0) {
    if (f.onGround || f.coyote > 0) {
      f.vy = -JUMP
      f.onGround = false
      f.platform = -1
      f.coyote = 0
      f.buf.jump = 0
      emit(m, { type: 'jump', id: f.id, x: f.x, y: f.y })
    } else if (f.jumps > 0) {
      f.vy = -AIR_JUMP
      f.jumps -= 1
      f.buf.jump = 0
      emit(m, { type: 'djump', id: f.id, x: f.x, y: f.y })
    }
  }

  if (!lockVel) {
    if (stunned || f.blocking || (f.spec && f.spec.def.kind !== 'spin')) dir = 0
    const slowed = f.atk ? 0.4 : f.spec ? 0.6 : 1
    const ice = m.arena.ice && f.onGround
    if (stunned) {
      f.vx = approach(f.vx, 0, (ice ? ICE_FRICTION : GROUND_FRICTION * 0.5) * dt)
    } else if (dir !== 0) {
      f.vx = approach(f.vx, dir * RUN * slowed, (f.onGround ? (ice ? ICE_ACCEL : GROUND_ACCEL) : AIR_ACCEL) * dt)
    } else {
      f.vx = approach(f.vx, 0, (f.onGround ? (ice ? ICE_FRICTION : GROUND_FRICTION) : 500) * dt)
    }
  }

  physics(m, f, dt)

  // spikes
  for (const s of m.spikes) {
    if (!spikeActive(s, m.t) || f.spikeCd > 0 || f.invuln > 0 || f.shield > 0) continue
    if (f.x + f.w / 2 > s.x && f.x - f.w / 2 < s.x + s.w && f.y > s.y && f.y - f.h < s.y + s.h) {
      f.spikeCd = 1
      applyHit(m, null, f, { dmg: 8, kb: 160, up: 560, dir: f.x < s.x + s.w / 2 ? -1 : 1, fromX: s.x + s.w / 2, unblockable: true })
      if (f.state === 'dead') return
    }
  }

  if (f.y > m.pit.y || f.x < -240 || f.x > W + 240 || f.y < -900) fallOut(m, f)
}

function stateOf(f) {
  if (f.state === 'dead') return 'dead'
  if (f.hurt > 0 || f.guardBreak > 0) return 'hurt'
  if (f.spec) return 'spec'
  if (f.atk) return 'attack'
  if (f.blocking) return 'block'
  if (!f.onGround) return 'air'
  return Math.abs(f.vx) > 40 ? 'run' : 'idle'
}

function flushHits(m) {
  const list = m.pending
  m.pending = []
  m.trade = list.length > 1 // hits landing on the same step all count, even if the first one is a knockout
  for (const { src, tgt, h } of list) applyHit(m, src, tgt, h)
  m.trade = false
}

/** Advances the match by one step. `inputs` is indexed by fighter id; missing entries count as no input. */
export function step(m, inputs, dt = DT) {
  if (m.hitstop > 0) {
    m.hitstop -= dt
    return
  }
  const live = m.status === 'fight'
  if (live) m.t += dt
  movePlatforms(m, dt)
  for (const f of m.fighters) updateFighter(m, f, live ? inputs[f.id] || NEUTRAL : NEUTRAL, dt)
  flushHits(m)
  updateProjectiles(m, dt)
  updateBolts(m, dt)

  // fighters are not solid to each other, but never stand exactly on top of one another
  const [a, b] = m.fighters
  if (a && b && a.state !== 'dead' && b.state !== 'dead' && Math.abs(a.x - b.x) < 24 && Math.abs(a.y - b.y) < 60) {
    const s = a.x <= b.x ? 1 : -1
    a.x -= s * 90 * dt
    b.x += s * 90 * dt
  }

  for (const f of m.fighters) f.state = stateOf(f)

  if (live && m.status === 'fight' && m.t >= MATCH_TIME) {
    m.status = 'over'
    m.reason = 'time'
    const [p, q] = m.fighters
    const rp = p.hp / p.hpMax
    const rq = q.hp / q.hpMax
    m.winner = Math.abs(rp - rq) < 1e-9 ? -1 : rp > rq ? p.id : q.id
    emit(m, { type: 'timeup' })
  }
}

export { ARENAS }
