// Canvas drawing for Stickman Fight. Fighters are drawn procedurally from joint angles every frame (two-bone legs
// and arms), so every limb animates and every weapon can sit in a hand. The arena backdrop is painted once into an
// offscreen canvas; a frame is that image plus platforms, fighters, projectiles and effects.
import { DESIGNS, EFFECTS, H, W, WEAPONS, byId, colorHex } from './data'
import { drawFx, rainbow } from './fx'
import { spikeActive, spikeWarning } from './sim'

const lerp = (a, b, t) => a + (b - a) * t
const ease = t => t * t * (3 - 2 * t)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const seg = (p, a0, a1, from, wind, end, rec) =>
  p < a0 ? lerp(from, wind, ease(p / a0)) : p < a1 ? lerp(wind, end, ease((p - a0) / (a1 - a0))) : lerp(end, rec, ease((p - a1) / (1 - a1)))

// ───────────── weapon art ─────────────
const BASE = {
  sword: { blade: '#dfe8ef', edge: '#ffffff', accent: '#e0a526', handle: '#6b4423' },
  dual: { blade: '#cfd8e3', edge: '#ffffff', accent: '#e24b4b', handle: '#3b2a1a' },
  axe: { blade: '#aab6c4', edge: '#f2f7fb', accent: '#7a5230', handle: '#7a5230' },
  spear: { blade: '#e6eef5', edge: '#ffffff', accent: '#e24b4b', handle: '#8a5a2b' },
  hammer: { blade: '#e9f2f8', edge: '#ffffff', accent: '#3fa0ff', handle: '#8a5a2b' },
  bow: { blade: '#a8662f', edge: '#d99a5b', accent: '#f4efe0', handle: '#5b3a1a' },
  katana: { blade: '#e8eef4', edge: '#ffffff', accent: '#b02a2a', handle: '#1d1d26' },
  giant: { blade: '#c9d3df', edge: '#ffffff', accent: '#e0a526', handle: '#4b2e1a' },
}
const REACH = { sword: 66, dual: 52, axe: 68, spear: 122, hammer: 80, katana: 86, giant: 128, bow: 0 }

export function paletteFor(weapon, design) {
  const d = byId(DESIGNS, design)
  return d && d.palette ? d.palette : BASE[weapon] || BASE.sword
}

function poly(ctx, pts, fill, stroke) {
  ctx.beginPath()
  ctx.moveTo(pts[0], pts[1])
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1])
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}
const rect = (ctx, x, y, w, h, fill) => {
  ctx.fillStyle = fill
  ctx.fillRect(x, y, w, h)
}

/** Draws a weapon with its grip at the origin, pointing along +x. */
function drawWeapon(ctx, id, p, draw = 0, scale = 1) {
  ctx.save()
  ctx.scale(scale, scale)
  ctx.lineJoin = 'round'
  switch (id) {
    case 'sword':
    case 'dual':
      rect(ctx, -11, -2.5, 13, 5, p.handle)
      rect(ctx, 2, -8, 4, 16, p.accent)
      poly(ctx, [6, -4.5, 56, -4.5, 67, 0, 56, 4.5, 6, 4.5], p.blade, 'rgba(0,0,0,0.25)')
      rect(ctx, 8, -1, 50, 2, p.edge)
      break
    case 'katana':
      rect(ctx, -13, -2.5, 17, 5, p.handle)
      ctx.fillStyle = p.accent
      ctx.beginPath()
      ctx.ellipse(5, 0, 2.6, 7, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(7, -3)
      ctx.quadraticCurveTo(46, -9, 88, -2)
      ctx.lineTo(88, 1)
      ctx.quadraticCurveTo(46, 1, 7, 3)
      ctx.closePath()
      ctx.fillStyle = p.blade
      ctx.fill()
      ctx.strokeStyle = p.edge
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(10, -1)
      ctx.quadraticCurveTo(46, -6, 84, -1.5)
      ctx.stroke()
      break
    case 'axe':
      rect(ctx, -14, -2.5, 74, 5, p.handle)
      ctx.beginPath()
      ctx.moveTo(44, -3)
      ctx.quadraticCurveTo(46, -24, 70, -22)
      ctx.quadraticCurveTo(62, -8, 66, 4)
      ctx.quadraticCurveTo(52, 22, 44, 3)
      ctx.closePath()
      ctx.fillStyle = p.blade
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.strokeStyle = p.edge
      ctx.beginPath()
      ctx.moveTo(68, -20)
      ctx.quadraticCurveTo(62, -6, 64, 3)
      ctx.stroke()
      break
    case 'spear':
      rect(ctx, -30, -2, 120, 4, p.handle)
      poly(ctx, [88, -7, 124, 0, 88, 7], p.blade, 'rgba(0,0,0,0.25)')
      rect(ctx, 84, -3, 5, 6, p.accent)
      ctx.strokeStyle = p.accent
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(82, 0)
      ctx.quadraticCurveTo(76, 9, 70, 6)
      ctx.stroke()
      break
    case 'hammer':
      rect(ctx, -14, -2.5, 70, 5, p.handle)
      ctx.fillStyle = p.blade
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(50, -18, 30, 36, 6)
      ctx.fill()
      ctx.stroke()
      rect(ctx, 50, -5, 30, 10, p.accent)
      rect(ctx, 53, -16, 4, 32, p.edge)
      break
    case 'giant':
      rect(ctx, -16, -3, 22, 6, p.handle)
      rect(ctx, 5, -13, 6, 26, p.accent)
      poly(ctx, [11, -8, 112, -8, 130, 0, 112, 8, 11, 8], p.blade, 'rgba(0,0,0,0.3)')
      rect(ctx, 14, -1.5, 100, 3, p.edge)
      break
    case 'bow': {
      ctx.lineCap = 'round'
      ctx.strokeStyle = p.blade
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.arc(-14, 0, 34, -1.15, 1.15)
      ctx.stroke()
      ctx.strokeStyle = p.edge
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(-14, 0, 34, -1.1, 1.1)
      ctx.stroke()
      const ex = -14 + 34 * Math.cos(1.15)
      const ey = 34 * Math.sin(1.15)
      const pull = -draw * 22
      ctx.strokeStyle = p.accent
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(ex, -ey)
      ctx.lineTo(ex + pull, 0)
      ctx.lineTo(ex, ey)
      ctx.stroke()
      if (draw > 0.05) {
        ctx.strokeStyle = '#6b4423'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(ex + pull, 0)
        ctx.lineTo(30, 0)
        ctx.stroke()
        poly(ctx, [30, -4, 40, 0, 30, 4], '#dfe8ef')
      }
      break
    }
    default:
  }
  ctx.restore()
}

// ───────────── pose ─────────────
const HIP = -46
const L1 = 23
const L2 = 23
const A1 = 16
const A2 = 17

const REST_W = { slash: -1.0, dual: -1.0, overhead: -1.0, stab: -1.25, bow: 0 }

/** Joint angles for a fighter this frame. Angles: 0 = forward (+x, the fighter faces +x here), +y is down. */
export function computePose(f) {
  const w = WEAPONS[f.weapon]
  const style = w.style
  const st = f.state
  const ph = f.anim * (10 + Math.min(1, Math.abs(f.vx) / 330) * 6)
  const at = f.atk
  const sp = f.spec
  const pose = {
    lean: 0,
    legs: [[0.14, 0.1], [-0.14, 0.1]],
    front: { ang: 0.55, ext: 0.85, wang: REST_W[style] ?? -1, bow: 0 },
    back: { ang: 0.9, ext: 0.7, wang: 0, weapon: style === 'dual', draw: 0 },
    ground: true,
    bob: Math.sin(f.anim * 3.2) * 1.2,
  }
  if (style === 'dual') pose.back.wang = -1.0
  if (style === 'bow') {
    pose.front = { ang: 0.2, ext: 0.9, wang: 0, bow: 0 }
    pose.back = { ang: 0.5, ext: 0.7, wang: 0, weapon: false, draw: 0 }
  }

  if (st === 'run') {
    const s = Math.sin(ph)
    const c = Math.cos(ph)
    pose.legs = [[s * 0.9, Math.max(0, c) * 0.95 + 0.12], [-s * 0.9, Math.max(0, -c) * 0.95 + 0.12]]
    pose.lean = 0.14
    pose.bob = -Math.abs(s) * 2.5
    if (!at && !sp) {
      pose.back.ang = 0.9 + s * 0.9
      if (style !== 'bow') pose.front.ang = 0.55 - s * 0.35
    }
  } else if (st === 'air') {
    pose.ground = false
    pose.legs = f.vy < 0 ? [[0.85, 1.15], [0.1, 0.35]] : [[0.4, 0.55], [-0.2, 0.25]]
    pose.back.ang = f.vy < 0 ? -0.5 : 1.0
    pose.bob = 0
  } else if (st === 'block') {
    pose.legs = [[0.6, 0.95], [-0.55, 0.95]]
    pose.lean = -0.08
    pose.front = { ang: -0.15, ext: 0.7, wang: -1.45, bow: 0 }
    pose.back = { ang: -0.1, ext: 0.65, wang: -1.45, weapon: style === 'dual', draw: 0 }
    pose.bob = 0
  } else if (st === 'hurt' || st === 'dead') {
    pose.legs = [[0.35, 0.35], [-0.3, 0.4]]
    pose.lean = -0.35
    const fl = Math.sin(f.anim * 28)
    pose.front = { ang: -0.2 + fl * 0.5, ext: 0.8, wang: -0.4 + fl * 0.5, bow: 0 }
    pose.back = { ang: 0.2 - fl * 0.5, ext: 0.8, wang: 0, weapon: false, draw: 0 }
    if (st === 'dead') pose.ground = true
  }

  if (st === 'attack' && at) {
    const p = at.t / at.dur
    const [a0, a1] = w.hit
    pose.legs = [[0.55, 0.25], [-0.5, 0.3]]
    pose.lean = 0.1 + Math.sin(clamp((p - a0) / (a1 - a0), 0, 1) * Math.PI) * 0.18
    let arm
    if (style === 'slash' || style === 'dual') {
      const ang = seg(p, a0, a1, 0.55, -2.3, 1.0, 0.55)
      arm = { ang, ext: 1, wang: ang - 0.22, bow: 0 }
    } else if (style === 'overhead') {
      const ang = seg(p, a0, a1, 0.55, -2.75, 1.3, 0.55)
      arm = { ang, ext: 0.95, wang: ang, bow: 0 }
    } else if (style === 'stab') {
      arm = { ang: -0.05, ext: seg(p, a0, a1, 0.85, 0.2, 1.2, 0.85), wang: -0.05, bow: 0 }
    } else {
      const draw = p < a0 ? p / a0 : Math.max(0, 1 - (p - a0) / 0.3)
      arm = { ang: -0.05, ext: 1, wang: 0, bow: draw }
      pose.back = { ang: -0.05 + (draw > 0.05 ? 0.15 : 0.4), ext: 0.4 + (1 - draw) * 0.6, wang: 0, weapon: false, draw }
    }
    if (style === 'dual' && at.hand === 1) {
      pose.back = { ...arm, weapon: true }
      pose.front = { ang: 0.55, ext: 0.85, wang: -1.0, bow: 0 }
    } else pose.front = arm
  }

  if (st === 'spec' && sp) {
    const k = sp.def.kind
    const t = sp.t
    pose.legs = [[0.55, 0.25], [-0.5, 0.3]]
    if (k === 'wave') {
      const p = clamp(t / 0.32, 0, 1)
      const ang = seg(p, 0.3, 0.6, 0.55, -2.3, 1.0, 0.4)
      pose.front = { ang, ext: 1, wang: ang - 0.22, bow: 0 }
      pose.lean = 0.2
    } else if (k === 'volley') {
      const draw = t < 0.18 ? t / 0.18 : Math.max(0, 1 - (t - 0.18) / 0.2)
      pose.front = { ang: -0.2, ext: 1, wang: 0, bow: draw }
      pose.back = { ang: -0.1, ext: 0.4 + (1 - draw) * 0.6, wang: 0, weapon: false, draw }
    } else if (k === 'shield') {
      pose.front = { ang: -1.4, ext: 0.9, wang: -1.4, bow: 0 }
      pose.back = { ang: -1.2, ext: 0.9, wang: -1.2, weapon: style === 'dual', draw: 0 }
    } else if (k === 'lightning') {
      const a = t < 0.35 ? -1.45 : 0.2
      pose.front = { ang: a, ext: 1, wang: a, bow: 0 }
    } else if (k === 'smash') {
      const a = sp.phase === 'rise' || sp.phase === 'start' ? -2.7 : 1.3
      pose.front = { ang: a, ext: 0.95, wang: a, bow: 0 }
      pose.back = { ang: a, ext: 0.9, wang: 0, weapon: false, draw: 0 }
      pose.ground = f.onGround
      pose.legs = sp.phase === 'slam' ? [[0.2, 0.2], [0.1, 0.2]] : [[0.5, 1.0], [-0.1, 0.6]]
    } else if (k === 'spin') {
      const a = f.anim * 22
      pose.front = { ang: a, ext: 1, wang: a, bow: 0 }
      pose.back = { ang: a + Math.PI, ext: 1, wang: a + Math.PI, weapon: true, draw: 0 }
      pose.legs = [[0.35, 0.4], [-0.35, 0.4]]
      pose.lean = 0
    } else if (k === 'dash') {
      pose.front = { ang: -0.05, ext: 1, wang: -0.05, bow: 0 }
      pose.lean = 0.5
      pose.legs = [[1.0, 0.5], [-0.8, 0.9]]
    }
  }
  return pose
}

function ik(sx, sy, tx, ty, l1, l2, dir) {
  let dx = tx - sx
  let dy = ty - sy
  let d = Math.hypot(dx, dy)
  const max = l1 + l2 - 0.5
  if (d > max) {
    dx *= max / d
    dy *= max / d
    d = max
  }
  const a = Math.atan2(dy, dx)
  const cosB = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * (d || 1)), -1, 1)
  const ang = a + dir * Math.acos(cosB)
  return { ex: sx + Math.cos(ang) * l1, ey: sy + Math.sin(ang) * l1, hx: sx + dx, hy: sy + dy }
}

/** Layout of every joint, in local coordinates (origin at the feet, facing +x). Used by the drawing and by the trails. */
function skeleton(f, pose) {
  const legs = pose.legs.map(([a, b]) => {
    const kx = Math.sin(a) * L1
    const ky = HIP + Math.cos(a) * L1
    return { hx: 0, hy: HIP, kx, ky, fx: kx + Math.sin(a - b) * L2, fy: ky + Math.cos(a - b) * L2 }
  })
  const lowest = pose.ground ? Math.max(legs[0].fy, legs[1].fy) : 0
  const dy = pose.ground ? -lowest + pose.bob : 0
  const hipY = HIP + dy
  const neckX = Math.sin(pose.lean) * 30
  const neckY = hipY - Math.cos(pose.lean) * 30
  const head = { x: neckX + Math.sin(pose.lean) * 13, y: neckY - Math.cos(pose.lean) * 13 }
  const shoulder = { x: neckX, y: neckY + 3 }
  const arm = a => {
    const reach = (A1 + A2) * a.ext
    const up = a.ang < -0.9 && a.ang > -3.0
    const r = ik(shoulder.x, shoulder.y, shoulder.x + Math.cos(a.ang) * reach, shoulder.y + Math.sin(a.ang) * reach, A1, A2, up ? -1 : 1)
    return r
  }
  return { legs, dy, hip: { x: 0, y: hipY }, neck: { x: neckX, y: neckY }, head, shoulder, front: arm(pose.front), back: arm(pose.back) }
}

/** World position of the front weapon's tip, for the swing trail. Null for the bow. */
export function weaponTip(f) {
  const len = REACH[f.weapon]
  if (!len) return null
  const pose = computePose(f)
  const sk = skeleton(f, pose)
  const tips = []
  const add = (arm, wang) => tips.push({ x: f.x + f.face * (arm.hx + Math.cos(wang) * len), y: f.y + arm.hy + Math.sin(wang) * len })
  add(sk.front, pose.front.wang)
  if (pose.back.weapon) add(sk.back, pose.back.wang)
  return tips
}

// ───────────── fighter ─────────────
function limb(ctx, color, w, ...pts) {
  ctx.strokeStyle = color
  ctx.lineWidth = w
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(pts[0], pts[1])
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1])
  ctx.stroke()
}

function drawSkin(ctx, skin, hx, hy, t) {
  const r = 11
  switch (skin) {
    case 'cap':
      ctx.fillStyle = '#d6262b'
      ctx.beginPath()
      ctx.arc(hx, hy - 1, r + 1, Math.PI, 0)
      ctx.closePath()
      ctx.fill()
      ctx.fillRect(hx, hy - 3, r + 9, 4)
      break
    case 'ninja':
      rect(ctx, hx - r - 1, hy - 6, r * 2 + 2, 5, '#22222c')
      ctx.strokeStyle = '#22222c'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(hx - r, hy - 4)
      ctx.quadraticCurveTo(hx - r - 12, hy - 2 + Math.sin(t * 9) * 3, hx - r - 20, hy + 3 + Math.sin(t * 9 + 1) * 4)
      ctx.moveTo(hx - r, hy - 3)
      ctx.quadraticCurveTo(hx - r - 10, hy + 4 + Math.sin(t * 9 + 2) * 3, hx - r - 17, hy + 10 + Math.sin(t * 9 + 3) * 4)
      ctx.stroke()
      rect(ctx, hx + 1, hy - 4, 8, 3, '#fff')
      break
    case 'mask':
      rect(ctx, hx - r, hy - 5, r * 2, 6, '#111')
      ctx.fillStyle = '#fff'
      ctx.fillRect(hx + 2, hy - 3.5, 4, 3)
      ctx.fillRect(hx - 6, hy - 3.5, 4, 3)
      break
    case 'helmet':
      ctx.fillStyle = '#9aa7b6'
      ctx.beginPath()
      ctx.arc(hx, hy - 1, r + 2, Math.PI, 0)
      ctx.lineTo(hx + r + 2, hy + 5)
      ctx.lineTo(hx - r - 2, hy + 5)
      ctx.closePath()
      ctx.fill()
      rect(ctx, hx + 4, hy - 2, 3, 9, '#6f7c8c')
      rect(ctx, hx - 3, hy - 14, 6, 6, '#e24b4b')
      break
    case 'viking':
      ctx.fillStyle = '#8b6b3f'
      ctx.beginPath()
      ctx.arc(hx, hy - 1, r + 1, Math.PI, 0)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#f4efe0'
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(hx - r + 1, hy - 4)
      ctx.quadraticCurveTo(hx - r - 8, hy - 8, hx - r - 6, hy - 18)
      ctx.moveTo(hx + r - 1, hy - 4)
      ctx.quadraticCurveTo(hx + r + 8, hy - 8, hx + r + 6, hy - 18)
      ctx.stroke()
      break
    case 'crown':
      ctx.fillStyle = '#ffcb2e'
      ctx.beginPath()
      ctx.moveTo(hx - 9, hy - 8)
      ctx.lineTo(hx - 10, hy - 20)
      ctx.lineTo(hx - 4, hy - 14)
      ctx.lineTo(hx, hy - 22)
      ctx.lineTo(hx + 4, hy - 14)
      ctx.lineTo(hx + 10, hy - 20)
      ctx.lineTo(hx + 9, hy - 8)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#e24b4b'
      ctx.beginPath()
      ctx.arc(hx, hy - 11, 2, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'wizard':
      ctx.fillStyle = '#5b3fb0'
      ctx.beginPath()
      ctx.moveTo(hx - 15, hy - 6)
      ctx.lineTo(hx + 15, hy - 6)
      ctx.lineTo(hx + 3, hy - 6)
      ctx.lineTo(hx + 4, hy - 34)
      ctx.lineTo(hx - 8, hy - 6)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#ffd31a'
      ctx.beginPath()
      ctx.arc(hx + 1, hy - 18, 2.4, 0, Math.PI * 2)
      ctx.fill()
      break
    default:
  }
}

function drawEyes(ctx, hx, hy) {
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(hx + 4.5, hy - 1.5, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#111'
  ctx.beginPath()
  ctx.arc(hx + 5.5, hy - 1.5, 1.4, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * Draws one fighter (a match fighter or a menu preview: anything with x, y, face, state, anim, vx, vy, atk, spec).
 */
export function drawFighter(ctx, f, time, opts = {}) {
  const pose = computePose(f)
  const sk = skeleton(f, pose)
  const body = colorHex(f.color)
  const effect = byId(EFFECTS, f.effect) || EFFECTS[0]
  const pal = paletteFor(f.weapon, f.design)
  const w = WEAPONS[f.weapon]
  const dead = f.state === 'dead'
  const fall = dead ? clamp(f.deadT / 0.35, 0, 1) : 0

  ctx.save()
  ctx.translate(f.x, f.y)
  // ground shadow
  if (!opts.noShadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.beginPath()
    ctx.ellipse(0, 1, 22 * (dead ? 1.5 : 1), 4, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  if (f.invuln > 0 && !opts.noBlink) ctx.globalAlpha = 0.45 + 0.35 * Math.sin(time * 34)
  if (dead) {
    ctx.globalAlpha = Math.max(0.0, 1 - Math.max(0, f.deadT - 1.2) / 0.8)
    ctx.rotate(-fall * 1.45 * f.face)
    ctx.translate(0, fall * 8)
  }
  ctx.scale(f.face, 1)

  // aura
  if (effect.aura && !dead) {
    ctx.save()
    ctx.globalAlpha = 0.17 + 0.07 * Math.sin(time * 6)
    ctx.fillStyle = effect.aura === 'rainbow' ? rainbow(time, 0) : effect.aura
    ctx.beginPath()
    ctx.arc(0, -48, 50, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // back arm, legs, torso, head, front arm
  const backFirst = pose.back
  if (backFirst.weapon) {
    ctx.save()
    ctx.translate(sk.back.hx, sk.back.hy)
    ctx.rotate(backFirst.wang)
    drawWeapon(ctx, f.weapon, pal, 0, 0.92)
    ctx.restore()
  }
  limb(ctx, body, 6, sk.shoulder.x, sk.shoulder.y, sk.back.ex, sk.back.ey, sk.back.hx, sk.back.hy)
  for (const l of sk.legs) limb(ctx, body, 6.5, l.hx, l.hy + sk.dy, l.kx, l.ky + sk.dy, l.fx, l.fy + sk.dy)
  limb(ctx, body, 7, sk.hip.x, sk.hip.y, sk.neck.x, sk.neck.y)
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(sk.head.x, sk.head.y, 11, 0, Math.PI * 2)
  ctx.fill()
  drawEyes(ctx, sk.head.x, sk.head.y)
  drawSkin(ctx, f.skin, sk.head.x, sk.head.y, time)

  limb(ctx, body, 6, sk.shoulder.x, sk.shoulder.y, sk.front.ex, sk.front.ey, sk.front.hx, sk.front.hy)
  ctx.save()
  ctx.translate(sk.front.hx, sk.front.hy)
  if (f.weapon === 'bow') {
    drawWeapon(ctx, 'bow', pal, pose.front.bow || (pose.back.draw ?? 0), 1)
  } else {
    ctx.rotate(pose.front.wang)
    drawWeapon(ctx, f.weapon, pal, 0, f.weapon === 'dual' ? 0.92 : 1)
  }
  ctx.restore()
  // hand
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(sk.front.hx, sk.front.hy, 3.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sk.back.hx, sk.back.hy, 3.6, 0, Math.PI * 2)
  ctx.fill()
  void w
  ctx.restore()

  // shield bubble and block guard
  if (f.shield > 0) {
    ctx.save()
    ctx.translate(f.x, f.y - 46)
    const a = Math.min(1, f.shield / 0.5)
    ctx.globalAlpha = 0.35 * a + 0.1 * Math.sin(time * 14)
    const g = ctx.createRadialGradient(0, 0, 20, 0, 0, 62)
    g.addColorStop(0, 'rgba(120,220,255,0.15)')
    g.addColorStop(1, 'rgba(120,220,255,0.9)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, 60, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 0.9 * a
    ctx.strokeStyle = '#d9f6ff'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.restore()
  } else if (f.blocking) {
    ctx.save()
    ctx.translate(f.x + f.face * 24, f.y - 48)
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = '#bfe9ff'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(0, 0, 38, f.face > 0 ? -1.1 : Math.PI - 1.1, f.face > 0 ? 1.1 : Math.PI + 1.1)
    ctx.stroke()
    ctx.restore()
  }
}

// ───────────── arena ─────────────
const make = (w, h) => {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  return c
}

function mountains(ctx, base, color, peaks, amp, seed = 0) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, H)
  ctx.lineTo(0, base)
  for (let i = 0; i <= peaks; i++) {
    const x = (i / peaks) * W
    ctx.lineTo(x - W / peaks / 2, base - amp * (0.4 + 0.6 * Math.abs(Math.sin(i * 2.3 + seed))))
    ctx.lineTo(x, base)
  }
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()
}

function cloud(ctx, x, y, s, a = 0.9) {
  ctx.fillStyle = `rgba(255,255,255,${a})`
  ctx.beginPath()
  ctx.arc(x, y, 26 * s, 0, Math.PI * 2)
  ctx.arc(x + 30 * s, y - 12 * s, 32 * s, 0, Math.PI * 2)
  ctx.arc(x + 64 * s, y, 26 * s, 0, Math.PI * 2)
  ctx.rect(x, y, 64 * s, 26 * s)
  ctx.fill()
}

function deadTree(ctx, x, base, h, color) {
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineWidth = 12
  ctx.beginPath()
  ctx.moveTo(x, base)
  ctx.lineTo(x, base - h)
  ctx.stroke()
  const branch = (bx, by, len, ang, w, depth) => {
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.moveTo(bx, by)
    const ex = bx + Math.cos(ang) * len
    const ey = by + Math.sin(ang) * len
    ctx.lineTo(ex, ey)
    ctx.stroke()
    if (depth > 0) {
      branch(ex, ey, len * 0.7, ang - 0.5, w * 0.65, depth - 1)
      branch(ex, ey, len * 0.7, ang + 0.55, w * 0.65, depth - 1)
    }
  }
  branch(x, base - h * 0.7, h * 0.4, -2.2, 7, 2)
  branch(x, base - h * 0.85, h * 0.4, -0.9, 7, 2)
  branch(x, base - h, h * 0.3, -1.6, 6, 2)
}

/** Paints the static backdrop for an arena into an offscreen canvas of `s` device pixels per logical pixel. */
export function createBackground(arena, s) {
  const c = make(W * s, H * s)
  const ctx = c.getContext('2d')
  if (!ctx) return c
  ctx.scale(s, s)
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, arena.sky[0])
  g.addColorStop(1, arena.sky[1])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  switch (arena.decor) {
    case 'clouds':
    case 'sky': {
      const sun = ctx.createRadialGradient(1020, 130, 10, 1020, 130, 240)
      sun.addColorStop(0, 'rgba(255,255,220,0.95)')
      sun.addColorStop(1, 'rgba(255,255,220,0)')
      ctx.fillStyle = sun
      ctx.fillRect(0, 0, W, H)
      cloud(ctx, 100, 150, 1.1, 0.8)
      cloud(ctx, 560, 90, 0.8, 0.7)
      cloud(ctx, 860, 590, 1.4, 0.9)
      cloud(ctx, 160, 600, 1.2, 0.9)
      if (arena.decor === 'sky') mountains(ctx, H + 10, 'rgba(255,255,255,0.35)', 5, 120, 1)
      break
    }
    case 'forest': {
      mountains(ctx, 640, '#5fb85a', 4, 220, 0.5)
      mountains(ctx, 700, '#3e9a45', 6, 150, 2)
      for (let i = 0; i < 9; i++) {
        const x = 60 + i * 150 + (i % 2) * 40
        ctx.fillStyle = '#5b3d22'
        ctx.fillRect(x - 8, 360 + (i % 3) * 30, 16, 350)
        ctx.fillStyle = i % 2 ? '#2f8a3a' : '#38a246'
        ctx.beginPath()
        ctx.arc(x, 350 + (i % 3) * 30, 62, 0, Math.PI * 2)
        ctx.arc(x - 34, 380 + (i % 3) * 30, 44, 0, Math.PI * 2)
        ctx.arc(x + 36, 382 + (i % 3) * 30, 46, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(0, 420, W, 120)
      break
    }
    case 'volcano': {
      const glow = ctx.createRadialGradient(640, 640, 20, 640, 640, 560)
      glow.addColorStop(0, 'rgba(255,170,40,0.55)')
      glow.addColorStop(1, 'rgba(255,100,20,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, W, H)
      mountains(ctx, 700, '#2a0f10', 3, 330, 0.3)
      mountains(ctx, 720, '#1b0a0b', 5, 200, 2.2)
      ctx.fillStyle = 'rgba(255,120,30,0.8)'
      ctx.beginPath()
      ctx.moveTo(250, 520)
      ctx.lineTo(270, 600)
      ctx.lineTo(290, 520)
      ctx.fill()
      break
    }
    case 'snow': {
      mountains(ctx, 700, '#c4e3fa', 4, 330, 0.9)
      mountains(ctx, 720, '#9cc9ee', 6, 220, 3)
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      for (let i = 0; i < 4; i++) {
        const x = (i + 0.5) * (W / 4)
        ctx.beginPath()
        ctx.moveTo(x - 50, 700 - 330 * (0.4 + 0.6 * Math.abs(Math.sin(i * 2.3 + 0.9))) + 90)
        ctx.lineTo(x, 700 - 330 * (0.4 + 0.6 * Math.abs(Math.sin(i * 2.3 + 0.9))))
        ctx.lineTo(x + 50, 700 - 330 * (0.4 + 0.6 * Math.abs(Math.sin(i * 2.3 + 0.9))) + 90)
        ctx.fill()
      }
      break
    }
    case 'night': {
      const moon = ctx.createRadialGradient(1010, 150, 20, 1010, 150, 200)
      moon.addColorStop(0, 'rgba(255,245,200,0.5)')
      moon.addColorStop(1, 'rgba(255,245,200,0)')
      ctx.fillStyle = moon
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#fff6cf'
      ctx.beginPath()
      ctx.arc(1010, 150, 52, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(160,120,200,0.5)'
      for (const [x, y] of [[960, 140], [1030, 170], [1000, 112]]) {
        ctx.beginPath()
        ctx.arc(x, y, 9, 0, Math.PI * 2)
        ctx.fill()
      }
      mountains(ctx, 690, '#2b1858', 5, 190, 1.3)
      deadTree(ctx, 90, 720, 330, '#1a0f33')
      deadTree(ctx, 1190, 720, 290, '#1a0f33')
      deadTree(ctx, 640, 720, 200, '#22143f')
      ctx.fillStyle = '#fff'
      for (let i = 0; i < 40; i++) {
        ctx.globalAlpha = 0.3 + ((i * 37) % 7) / 10
        ctx.fillRect((i * 331) % W, (i * 127) % 330, 2, 2)
      }
      ctx.globalAlpha = 1
      break
    }
    default:
  }
  return c
}

function drawPlatform(ctx, p, arena, time) {
  const { body, top, edge } = arena.plat
  const r = 8
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.beginPath()
  ctx.roundRect(p.x + 4, p.y + 8, p.w, p.h, r)
  ctx.fill()
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.roundRect(p.x, p.y, p.w, p.h, r)
  ctx.fill()
  // darker lower half
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.beginPath()
  ctx.roundRect(p.x, p.y + p.h * 0.5, p.w, p.h * 0.5, [0, 0, r, r])
  ctx.fill()
  ctx.fillStyle = top
  ctx.beginPath()
  ctx.roundRect(p.x - 1, p.y - 2, p.w + 2, 12, [r, r, 3, 3])
  ctx.fill()
  ctx.strokeStyle = edge
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.roundRect(p.x, p.y, p.w, p.h, r)
  ctx.stroke()
  if (arena.decor === 'forest') {
    ctx.fillStyle = '#3a9a2c'
    for (let x = p.x + 6; x < p.x + p.w - 6; x += 18) {
      ctx.beginPath()
      ctx.moveTo(x, p.y + 6)
      ctx.lineTo(x + 5, p.y - 8)
      ctx.lineTo(x + 10, p.y + 6)
      ctx.fill()
    }
  } else if (arena.decor === 'volcano') {
    ctx.fillStyle = `rgba(255,${120 + 60 * Math.sin(time * 3)},30,0.9)`
    for (let x = p.x + 14; x < p.x + p.w - 14; x += 46) ctx.fillRect(x, p.y + 20, 20, 3)
  } else if (arena.decor === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fillRect(p.x + 6, p.y + 14, p.w - 12, 3)
  } else if (arena.decor === 'night') {
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    for (let x = p.x + 20; x < p.x + p.w - 20; x += 60) ctx.fillRect(x, p.y + 18, 28, 4)
  }
  if (p.move) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.beginPath()
    ctx.moveTo(p.x + p.w / 2 - 22, p.y + 28)
    ctx.lineTo(p.x + p.w / 2 - 12, p.y + 22)
    ctx.lineTo(p.x + p.w / 2 - 12, p.y + 34)
    ctx.moveTo(p.x + p.w / 2 + 22, p.y + 28)
    ctx.lineTo(p.x + p.w / 2 + 12, p.y + 22)
    ctx.lineTo(p.x + p.w / 2 + 12, p.y + 34)
    ctx.fill()
  }
}

function drawSpike(ctx, s, arena, t) {
  const timed = Boolean(s.period)
  const active = spikeActive(s, t)
  const warn = spikeWarning(s, t)
  if (arena.decor === 'volcano') {
    // fire jet
    const k = active ? 1 : warn * 0.25
    if (warn > 0 || active) {
      ctx.save()
      ctx.translate(s.x + s.w / 2, s.y + s.h)
      for (let i = 0; i < 3; i++) {
        const h = s.h * k * (0.7 + 0.3 * Math.sin(t * 20 + i * 2)) * (i === 1 ? 1.15 : 0.8)
        ctx.fillStyle = i === 0 ? '#ff4a1a' : i === 1 ? '#ff9a1a' : '#ffe14a'
        ctx.beginPath()
        ctx.moveTo(-s.w / 2 + i * 6, 0)
        ctx.quadraticCurveTo(-s.w / 4, -h * 0.6, (i - 1) * 8, -h)
        ctx.quadraticCurveTo(s.w / 4, -h * 0.6, s.w / 2 - i * 6, 0)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
    }
    ctx.fillStyle = warn > 0 ? `rgba(255,${80 + warn * 120},30,1)` : '#3a2018'
    ctx.fillRect(s.x, s.y + s.h - 4, s.w, 6)
    return
  }
  const color = arena.decor === 'snow' ? '#bfeaff' : arena.decor === 'forest' ? '#6b8e23' : '#aab4c4'
  const n = Math.max(2, Math.round(s.w / 14))
  const w = s.w / n
  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 1.5
  for (let i = 0; i < n; i++) {
    ctx.beginPath()
    ctx.moveTo(s.x + i * w, s.y + s.h)
    ctx.lineTo(s.x + i * w + w / 2, s.y + (timed && !active ? s.h * 0.6 : 0))
    ctx.lineTo(s.x + (i + 1) * w, s.y + s.h)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}

function drawPit(ctx, m, time) {
  if (m.pit.kind === 'lava') {
    const y = m.pit.y
    const g = ctx.createLinearGradient(0, y - 20, 0, H)
    g.addColorStop(0, '#ffcc33')
    g.addColorStop(0.25, '#ff6a1a')
    g.addColorStop(1, '#8c1406')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(0, H)
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.03 + time * 2.4) * 6 + Math.sin(x * 0.011 - time * 1.3) * 5)
    ctx.lineTo(W, H)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,230,120,0.7)'
    for (let i = 0; i < 9; i++) {
      const x = (i * 163 + time * 24) % W
      ctx.beginPath()
      ctx.arc(x, y + 22 + Math.sin(time * 2 + i) * 8, 4 + (i % 3), 0, Math.PI * 2)
      ctx.fill()
    }
    const glow = ctx.createLinearGradient(0, y - 120, 0, y)
    glow.addColorStop(0, 'rgba(255,120,30,0)')
    glow.addColorStop(1, 'rgba(255,120,30,0.28)')
    ctx.fillStyle = glow
    ctx.fillRect(0, y - 120, W, 120)
  } else {
    const g = ctx.createLinearGradient(0, H - 130, 0, H)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(1, 'rgba(20,20,60,0.5)')
    ctx.fillStyle = g
    ctx.fillRect(0, H - 130, W, 130)
  }
}

function drawAmbient(ctx, m, time) {
  const d = m.arena.decor
  if (d === 'clouds' || d === 'sky') {
    for (let i = 0; i < 3; i++) cloud(ctx, ((time * (12 + i * 5) + i * 480) % (W + 300)) - 150, 80 + i * 110, 0.8 + i * 0.15, 0.55)
  } else if (d === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    for (let i = 0; i < 70; i++) {
      const x = (i * 97 + Math.sin(time + i) * 24) % W
      const y = (i * 53 + time * (40 + (i % 5) * 12)) % H
      ctx.beginPath()
      ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (d === 'volcano') {
    for (let i = 0; i < 40; i++) {
      const x = (i * 131 + Math.sin(time * 0.6 + i) * 30) % W
      const y = H - ((i * 71 + time * (30 + (i % 4) * 14)) % H)
      ctx.fillStyle = `rgba(255,${130 + (i % 4) * 28},40,${0.35 + (i % 3) * 0.2})`
      ctx.fillRect(x, y, 3, 3)
    }
  } else if (d === 'night') {
    ctx.fillStyle = '#12082a'
    for (let i = 0; i < 5; i++) {
      const x = ((time * (60 + i * 14) + i * 300) % (W + 200)) - 100
      const y = 120 + i * 55 + Math.sin(time * 3 + i * 2) * 20
      const flap = Math.sin(time * 14 + i) * 7
      ctx.beginPath()
      ctx.moveTo(x - 16, y - flap)
      ctx.quadraticCurveTo(x - 6, y - 8, x, y)
      ctx.quadraticCurveTo(x + 6, y - 8, x + 16, y - flap)
      ctx.quadraticCurveTo(x + 6, y + 2, x, y + 7)
      ctx.quadraticCurveTo(x - 6, y + 2, x - 16, y - flap)
      ctx.fill()
    }
  } else if (d === 'forest') {
    ctx.fillStyle = 'rgba(255,255,160,0.8)'
    for (let i = 0; i < 16; i++) {
      const x = (i * 211 + Math.sin(time * 0.8 + i) * 40) % W
      const y = 160 + ((i * 89) % 380) + Math.sin(time * 1.2 + i * 3) * 20
      ctx.globalAlpha = 0.4 + 0.4 * Math.sin(time * 2 + i)
      ctx.beginPath()
      ctx.arc(x, y, 2.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}

// ───────────── projectiles and bolts ─────────────
function drawProjectile(ctx, p, time) {
  ctx.save()
  ctx.translate(p.x, p.y)
  const ang = Math.atan2(p.vy, p.vx)
  ctx.rotate(ang)
  if (p.kind === 'wave') {
    const g = ctx.createLinearGradient(-30, 0, 40, 0)
    g.addColorStop(0, 'rgba(120,230,255,0)')
    g.addColorStop(1, 'rgba(180,250,255,0.95)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(-26, -46)
    ctx.quadraticCurveTo(46, -30, 52, 0)
    ctx.quadraticCurveTo(46, 30, -26, 46)
    ctx.quadraticCurveTo(14, 0, -26, -46)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.globalAlpha = 0.8
    ctx.beginPath()
    ctx.moveTo(10, -26)
    ctx.quadraticCurveTo(44, -14, 46, 0)
    ctx.quadraticCurveTo(44, 14, 10, 26)
    ctx.quadraticCurveTo(26, 0, 10, -26)
    ctx.fill()
  } else {
    ctx.strokeStyle = '#7a4a22'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(-22, 0)
    ctx.lineTo(14, 0)
    ctx.stroke()
    poly(ctx, [14, -4, 24, 0, 14, 4], '#e8eef4')
    ctx.strokeStyle = '#e24b4b'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(-22, 0)
    ctx.lineTo(-27, -4)
    ctx.moveTo(-22, 0)
    ctx.lineTo(-27, 4)
    ctx.stroke()
  }
  ctx.restore()
  void time
}

function drawBolt(ctx, b, time) {
  const k = b.t / b.warn
  const ground = b.y ?? 400
  if (!b.struck) {
    // telegraph: a pulsing target on the ground and a flickering column
    ctx.save()
    ctx.globalAlpha = 0.25 + 0.5 * k
    ctx.strokeStyle = '#fff25c'
    ctx.lineWidth = 3
    ctx.setLineDash([10, 8])
    ctx.beginPath()
    ctx.moveTo(b.x, 0)
    ctx.lineTo(b.x, ground)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.ellipse(b.x, ground, b.radius * (1.2 - 0.4 * k), 10, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    return
  }
  const age = b.t - b.warn
  ctx.save()
  ctx.globalAlpha = Math.max(0, 1 - age / 0.3)
  const jag = ctx.createLinearGradient(0, 0, 0, ground)
  jag.addColorStop(0, '#ffffff')
  jag.addColorStop(1, '#fff25c')
  ctx.fillStyle = 'rgba(255,255,160,0.35)'
  ctx.fillRect(b.x - b.radius, 0, b.radius * 2, ground)
  for (const [w, c] of [[16, 'rgba(255,240,90,0.6)'], [6, '#ffffff']]) {
    ctx.strokeStyle = c
    ctx.lineWidth = w
    ctx.lineJoin = 'round'
    ctx.beginPath()
    let x = b.x
    ctx.moveTo(x, -10)
    for (let y = 30; y < ground; y += 38) {
      x = b.x + Math.sin(y * 0.9 + Math.floor(time * 30) * 1.7) * 22
      ctx.lineTo(x, y)
    }
    ctx.lineTo(b.x, ground)
    ctx.stroke()
  }
  void jag
  ctx.restore()
}

// ───────────── scene ─────────────
/**
 * Draws a whole frame. `view` = { s: device px per logical px, bg: backdrop canvas, time, fx }.
 */
export function drawScene(ctx, m, fx, view) {
  const { s, bg, time } = view
  const sx = fx.shake > 0 ? (Math.random() - 0.5) * fx.shake * 26 : 0
  const sy = fx.shake > 0 ? (Math.random() - 0.5) * fx.shake * 26 : 0
  ctx.setTransform(s, 0, 0, s, sx * s, sy * s)
  ctx.clearRect(-40, -40, W + 80, H + 80)
  if (bg) ctx.drawImage(bg, 0, 0, W, H)
  drawAmbient(ctx, m, time)
  drawPit(ctx, m, time)
  for (const p of m.plats) drawPlatform(ctx, p, m.arena, time)
  for (const sp of m.spikes) drawSpike(ctx, sp, m.arena, m.t)
  for (const b of m.bolts) drawBolt(ctx, b, time)
  // loser first so the winner is drawn on top
  const order = [...m.fighters].sort((a, b) => (a.state === 'dead' ? -1 : 0) - (b.state === 'dead' ? -1 : 0))
  for (const f of order) drawFighter(ctx, f, time)
  for (const p of m.projectiles) drawProjectile(ctx, p, time)
  drawFx(ctx, fx, time)
  if (fx.flash > 0) {
    ctx.globalAlpha = fx.flash * 0.55
    ctx.fillStyle = fx.flashColor
    ctx.fillRect(-40, -40, W + 80, H + 80)
    ctx.globalAlpha = 1
  }
  ctx.setTransform(s, 0, 0, s, 0, 0)
}

/** Big centred banner text ("3", "FIGHT!"), drawn on the canvas. */
export function drawBanner(ctx, s, str, k, color = '#fff') {
  ctx.setTransform(s, 0, 0, s, 0, 0)
  const pop = 1 + Math.max(0, 0.35 - k) * 1.6
  ctx.save()
  ctx.translate(W / 2, H / 2 - 40)
  ctx.scale(pop, pop)
  ctx.globalAlpha = Math.min(1, (1 - k) * 2.2)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '900 130px system-ui, "Segoe UI", sans-serif'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 16
  ctx.strokeStyle = '#0b2a52'
  ctx.strokeText(str, 0, 0)
  ctx.fillStyle = color
  ctx.fillText(str, 0, 0)
  ctx.restore()
}

/** Draws a standing fighter on a small canvas (menus, shop). */
export function drawPreview(ctx, spec, w, h, time, pose = {}) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  const sc = Math.min(w / 190, h / 150)
  ctx.setTransform(sc, 0, 0, sc, w / 2, h - 10 * sc)
  const f = {
    x: 0, y: 0, face: 1, vx: 0, vy: 0, anim: time, state: 'idle', atk: null, spec: null, shield: 0, blocking: false, invuln: 0, deadT: 0,
    weapon: spec.weapon, color: spec.color, skin: spec.skin, effect: spec.effect, design: spec.design, ...pose,
  }
  // a gentle practice swing every few seconds so the weapon is easy to see
  const cycle = time % 3.2
  const wd = WEAPONS[f.weapon]
  if (cycle < wd.dur && !pose.state) {
    f.state = 'attack'
    f.atk = { t: cycle, dur: wd.dur, hand: 0 }
  }
  drawFighter(ctx, f, time, { noBlink: true })
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

