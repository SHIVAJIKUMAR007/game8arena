// Canvas renderer. Pure drawing: it reads a "view" (fighters, projectiles, zones, phase) and paints one frame at
// 1280x720. The arena is a fake-3D scene: a perspective mat, bobbing crowd tiers, wall banners and spotlights with
// star flares. Fighters are jointed skeletons (head, torso, upper and lower arms, thighs and shins) posed by state.
// The same fighter code draws the menu preview and the portraits, so what you pick is what you fight with.
import { fighterById } from '../roster'
import { GROUND_Y } from './fx'
import { H, MOVES, W } from './sim'

const TAU = Math.PI * 2
/** Drawn size relative to the simulation's 180px fighter, so fighters have presence on a 1280x720 stage. */
const RENDER_K = 1.25
const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = t => (t < 0 ? 0 : t > 1 ? 1 : t)
const ease = t => t * t * (3 - 2 * t)

// Limb lengths in local units (before the fighter's own scale).
const TORSO = 64
const UARM = 34
const FARM = 32
const THIGH = 44
const SHIN = 44

/** Costume details that are not in the roster data: what each body part is dyed. */
const LOOK = {
  cap: { torso: '#27408b', sleeve: '#27408b', fore: '#c8202f', pants: '#27408b', boot: '#c8202f', tw: 1, lw: 1, belt: '#c8202f' },
  ironman: { torso: '#b8202a', sleeve: '#b8202a', fore: '#e8b52e', pants: '#b8202a', boot: '#e8b52e', tw: 1.05, lw: 1, belt: '#e8b52e' },
  thor: { torso: '#2a3a55', sleeve: '#f0c19a', fore: '#aab4c2', pants: '#26282f', boot: '#3a2a1e', tw: 1.1, lw: 1.1, belt: '#8a6a3a' },
  panther: { torso: '#17171d', sleeve: '#17171d', fore: '#17171d', pants: '#17171d', boot: '#2c2c36', tw: 0.95, lw: 0.95, belt: '#b9b9d6' },
  hulk: { torso: '#4fa83d', sleeve: '#4fa83d', fore: '#4fa83d', pants: '#6b3f8c', boot: '#4fa83d', tw: 1.35, lw: 1.35, belt: '#6b3f8c' },
  spidey: { torso: '#c8202f', sleeve: '#c8202f', fore: '#c8202f', pants: '#27408b', boot: '#c8202f', tw: 0.9, lw: 0.9, belt: '#27408b' },
  paul: { torso: '#3c4a52', sleeve: '#3c4a52', fore: '#2c363c', pants: '#3c4a52', boot: '#2c363c', tw: 0.95, lw: 0.95, belt: '#7a8a8f' },
  chani: { torso: '#8a6a45', sleeve: '#8a6a45', fore: '#6b5234', pants: '#8a6a45', boot: '#4a3a28', tw: 0.88, lw: 0.9, belt: '#4a3a28' },
  stilgar: { torso: '#4a3a2e', sleeve: '#4a3a2e', fore: '#2e2620', pants: '#4a3a2e', boot: '#2e2620', tw: 1.05, lw: 1, belt: '#2e2620' },
  duncan: { torso: '#2f3a44', sleeve: '#2f3a44', fore: '#b9332a', pants: '#2f3a44', boot: '#1d242b', tw: 1.02, lw: 1, belt: '#b9332a' },
  feyd: { torso: '#16161a', sleeve: '#16161a', fore: '#16161a', pants: '#16161a', boot: '#2a2a32', tw: 0.95, lw: 0.95, belt: '#5a5a66' },
  baron: { torso: '#1d1d22', sleeve: '#1d1d22', fore: '#2a2a32', pants: '#1d1d22', boot: '#2a2a32', tw: 1.5, lw: 1.2, belt: '#ff6a4a' },
}
const lookOf = id => LOOK[id] || LOOK.cap

// ───────────── poses ─────────────
function basePose(T) {
  const bob = Math.sin(T * 0.12)
  return {
    lean: 0.06, head: 0, lift: 0, lying: 0, twist: 1, bob,
    aF: [0.6 + bob * 0.04, 2.4], aB: [0.25, 2.55],
    lF: [0.45 + bob * 0.04, 0.1], lB: [-0.5 + bob * 0.04, -0.15],
  }
}

function poseOf(f, T) {
  const P = basePose(T)
  const st = f.st
  switch (f.state) {
    case 'walk': {
      const ph = T * 0.3
      const s = Math.sin(ph)
      P.lF = [s * 0.7, s * 0.7 - 0.6 * (0.5 + 0.5 * Math.cos(ph))]
      P.lB = [-s * 0.7, -s * 0.7 - 0.6 * (0.5 - 0.5 * Math.cos(ph))]
      P.aF = [0.6 - s * 0.15, 2.4]
      P.aB = [0.25 + s * 0.15, 2.55]
      break
    }
    case 'jump':
      P.lF = [1.1, -0.3]
      P.lB = [-0.2, -1.1]
      P.aF = [1.3, 2.4]
      P.aB = [0.5, 2.3]
      P.lean = 0.1
      break
    case 'block':
      P.lean = 0.16
      P.lF = [1.05, 0.05]
      P.lB = [-0.55, -0.2]
      P.aF = [0.5, 2.9]
      P.aB = [0.7, 2.95]
      break
    case 'hit':
      P.lean = -0.4
      P.head = -0.35
      P.aF = [-0.3 + Math.sin(st * 0.8) * 0.1, 0.5]
      P.aB = [-0.6, 0.2]
      P.lF = [0.3, -0.2]
      P.lB = [-0.3, -0.5]
      break
    case 'knock': {
      const total = f.knockT || 54
      const k = st < 12 ? st / 12 : total - st < 16 ? Math.max(0, (total - st) / 16) : 1
      P.lying = ease(clamp01(k))
      P.aF = [0.9, 0.9]
      P.aB = [-0.4, -0.2]
      P.lF = [0.12, 0.12]
      P.lB = [0.0, 0.05]
      P.lean = 0
      break
    }
    case 'victory': {
      const s = Math.sin(T * 0.3)
      P.aF = [2.8 + s * 0.25, 3.0]
      P.aB = [2.9 - s * 0.25, 3.1]
      P.lF = [0.5, 0.2]
      P.lB = [-0.5, -0.2]
      P.lean = -0.05
      P.lift = Math.abs(Math.sin(T * 0.15)) * 12
      break
    }
    case 'attack': {
      const mv = MOVES[f.move]
      if (!mv) break
      const wind = mv.start
      const act = mv.start + mv.active
      const e = st < wind ? ease(st / wind) : st < act ? 1 : 1 - ease(clamp01((st - act) / mv.rec))
      if (f.move === 'punch') {
        P.aF = [lerp(0.6, 1.5, e), lerp(2.4, 1.5, e)]
        P.lean = lerp(0.06, 0.32, e)
        P.lF = [0.45 + 0.15 * e, 0.1]
      } else if (f.move === 'heavy') {
        const cock = st < wind ? ease(st / wind) : 0
        const sw = st < act && st >= wind ? 1 : st >= act ? e : 0
        P.aF = [lerp(lerp(0.6, -1.3, cock), 1.55, sw), lerp(lerp(2.4, -0.4, cock), 1.55, sw)]
        P.aB = [lerp(0.25, -0.6, cock), 2.2]
        P.lean = lerp(lerp(0.06, -0.2, cock), 0.45, sw)
        P.lF = [0.7 * Math.max(sw, 0.4), 0.2]
        P.lB = [-0.7, -0.3]
      } else if (f.move === 'kick') {
        P.lF = [lerp(0.45, 1.55, e), lerp(0.1, 1.55, e)]
        P.lean = -0.18 * e
        P.aB = [lerp(0.25, -0.7, e), 2.4]
      } else if (f.move === 'fkick') {
        P.lean = -0.6
        P.lF = [1.5, 1.55]
        P.lB = [0.7, -0.4]
        P.aF = [-0.8, -0.5]
        P.aB = [-1.0, -0.6]
      }
      break
    }
    case 'special':
      specialPose(P, f, st)
      break
    default:
  }
  return P
}

function specialPose(P, f, st) {
  const move = f.move
  const guardArms = k => {
    P.aF = [lerp(0.6, 1.5, k), lerp(2.4, 1.5, k)]
    P.aB = [lerp(0.25, 1.4, k), lerp(2.55, 1.5, k)]
  }
  switch (move) {
    case 'shield':
      P.aF = st < 10 ? [lerp(0.6, -1.2, st / 10), lerp(2.4, -0.5, st / 10)] : [lerp(1.55, 0.6, clamp01((st - 10) / 24)), lerp(1.55, 2.4, clamp01((st - 10) / 24))]
      P.lean = st < 10 ? -0.15 : 0.3
      break
    case 'beam': {
      const k = ease(clamp01(st / 8)) * (st < 56 ? 1 : 1 - ease(clamp01((st - 56) / 8)))
      guardArms(k)
      P.lean = 0.1
      P.lF = [0.7, 0.2]
      P.lB = [-0.7, -0.3]
      break
    }
    case 'storm': {
      const k = ease(clamp01(st / 14)) * (st < 50 ? 1 : 1 - ease(clamp01((st - 50) / 8)))
      P.aF = [lerp(0.6, 2.8, k), lerp(2.4, 3.0, k)]
      P.aB = [lerp(0.25, 2.9, k), lerp(2.55, 3.1, k)]
      P.lift = k * 22
      P.lean = -0.08 * k
      break
    }
    case 'chain':
    case 'lunge':
      P.lean = 0.55
      P.lF = [1.0, 0.2]
      P.lB = [-1.0, -1.1]
      if (move === 'lunge' || Math.floor(st / 3) % 2 === 0) {
        P.aF = [1.5, 1.5]
        P.aB = [-0.6, -0.4]
      } else {
        P.aB = [1.5, 1.5]
        P.aF = [-0.6, -0.4]
      }
      break
    case 'smash':
      if (st < 24) {
        const k = ease(st / 24)
        P.aF = [lerp(0.6, 2.9, k), lerp(2.4, 3.0, k)]
        P.aB = [lerp(0.25, 2.9, k), lerp(2.55, 3.0, k)]
        P.lean = -0.2 * k
      } else {
        const k = ease(clamp01((st - 24) / 8))
        P.aF = [lerp(2.9, 0.9, k), lerp(3.0, 0.7, k)]
        P.aB = [lerp(2.9, 0.7, k), lerp(3.0, 0.6, k)]
        P.lean = 0.5 * k
        P.lF = [1.1, 0.1]
        P.lB = [-0.7, -0.2]
      }
      break
    case 'web':
      P.aF = st < 8 ? [lerp(0.6, -0.6, st / 8), lerp(2.4, 0.2, st / 8)] : [1.55, 1.55]
      P.aB = [0.2, 2.2]
      P.lean = st < 8 ? -0.1 : 0.2
      break
    case 'counter':
      P.lean = -0.1
      P.lF = [1.0, 0.1]
      P.lB = [-0.6, -0.2]
      P.aF = [0.5, 2.95]
      P.aB = [0.65, 3.0]
      break
    case 'combo': {
      const cycle = st < 16 ? 0 : ((st - 16) % 12) / 12
      P.aF = [lerp(-1.0, 1.9, ease(cycle)), lerp(-0.6, 1.7, ease(cycle))]
      P.lean = 0.2
      P.lF = [0.8, 0.2]
      P.lB = [-0.6, -0.2]
      break
    }
    case 'spin':
      P.aF = [1.55, 1.55]
      P.aB = [-1.55, -1.55]
      P.lF = [0.5, 0.1]
      P.lB = [-0.5, -0.1]
      P.twist = Math.max(0.2, Math.abs(Math.cos(st * 0.55)))
      break
    case 'grav':
      P.aF = [2.2, 2.4]
      P.aB = [1.9, 2.1]
      P.lean = -0.1
      break
    default:
  }
}

// ───────────── drawing helpers ─────────────
const OUTLINE = 'rgba(10,12,24,0.7)'

function limb(ctx, ax, ay, bx, by, w, color) {
  ctx.lineCap = 'round'
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = w + 4
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(bx, by)
  ctx.stroke()
  ctx.strokeStyle = color
  ctx.lineWidth = w
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(bx, by)
  ctx.stroke()
}

const dot = (ctx, x, y, r, color) => {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
}

const polar = (x, y, len, a) => [x + len * Math.sin(a), y + len * Math.cos(a)]

/** Head and face for a fighter, centred on (0, 0), looking right. */
function drawHead(ctx, id, col, r = 16) {
  const k = r / 16
  ctx.save()
  ctx.scale(k, k)
  const c = fighterById(id).colors
  const skin = col ? '#fff' : c.skin
  const circle = fill => dot(ctx, 0, 0, 16, fill)
  switch (id) {
    case 'cap':
      circle(skin)
      dot(ctx, -2, -4, 16.5, col || '#27408b')
      ctx.fillStyle = skin
      ctx.beginPath()
      ctx.arc(5, 3, 11, 0, TAU)
      ctx.fill()
      ctx.fillStyle = col || '#f4f4f4'
      ctx.fillRect(-14, -8, 6, 6)
      break
    case 'ironman':
      circle(col || '#b8202a')
      ctx.fillStyle = col || '#e8b52e'
      ctx.beginPath()
      ctx.roundRect(1, -9, 14, 18, 5)
      ctx.fill()
      ctx.fillStyle = col || '#7ff3ff'
      ctx.fillRect(6, -4, 8, 3)
      break
    case 'thor':
      dot(ctx, -9, 4, 14, col || '#e5c35a')
      circle(skin)
      ctx.fillStyle = col || '#e5c35a'
      ctx.beginPath()
      ctx.arc(-3, -6, 14, Math.PI, TAU)
      ctx.fill()
      ctx.fillRect(2, 8, 10, 6)
      break
    case 'panther':
      ctx.fillStyle = col || '#17171d'
      ctx.beginPath()
      ctx.moveTo(-10, -12)
      ctx.lineTo(-7, -26)
      ctx.lineTo(-1, -14)
      ctx.moveTo(2, -14)
      ctx.lineTo(9, -26)
      ctx.lineTo(12, -10)
      ctx.fill()
      circle(col || '#17171d')
      ctx.fillStyle = col || '#e8e8f4'
      ctx.fillRect(4, -5, 9, 3)
      break
    case 'hulk':
      circle(skin)
      dot(ctx, -3, -7, 15, col || '#1c2e18')
      ctx.fillStyle = col || '#173012'
      ctx.fillRect(2, -4, 13, 3)
      break
    case 'spidey':
      circle(col || '#c8202f')
      ctx.fillStyle = col || '#f4f4f4'
      ctx.beginPath()
      ctx.ellipse(8, -2, 6, 4, -0.3, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(-14, 0)
      ctx.lineTo(14, 0)
      ctx.moveTo(0, -15)
      ctx.lineTo(0, 15)
      ctx.stroke()
      break
    case 'paul':
      circle(skin)
      dot(ctx, -4, -3, 17, col || '#3c4a52')
      ctx.fillStyle = skin
      ctx.beginPath()
      ctx.arc(6, -1, 8, 0, TAU)
      ctx.fill()
      ctx.fillStyle = col || '#2c363c'
      ctx.fillRect(2, 4, 14, 7)
      break
    case 'chani':
      circle(skin)
      dot(ctx, -3, -6, 15, col || '#8a6a45')
      ctx.fillStyle = col || '#4a3a28'
      ctx.fillRect(3, 3, 13, 9)
      break
    case 'stilgar':
      circle(skin)
      dot(ctx, -2, -7, 17, col || '#2e2620')
      ctx.fillStyle = col || '#2e2620'
      ctx.fillRect(3, 2, 13, 9)
      ctx.fillStyle = col || '#8a8a8a'
      ctx.fillRect(2, 10, 9, 8)
      break
    case 'duncan':
      circle(skin)
      ctx.fillStyle = col || '#3a2a1c'
      ctx.beginPath()
      ctx.arc(-2, -4, 15, Math.PI * 0.95, TAU * 0.98)
      ctx.fill()
      break
    case 'feyd':
      circle(skin)
      ctx.fillStyle = col || '#16161a'
      ctx.fillRect(4, -7, 11, 2)
      break
    case 'baron':
      circle(skin)
      ctx.fillStyle = col || '#2a2a32'
      ctx.fillRect(4, -5, 10, 3)
      break
    default:
      circle(skin)
  }
  if (!col) {
    dot(ctx, 8, -3, 2, '#111')
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(0, 0, 16, 0, TAU)
    ctx.stroke()
  }
  ctx.restore()
}

function drawProp(ctx, f, c, hand, forearmAngle, hidden, T) {
  const [hx, hy] = hand
  switch (c.prop) {
    case 'shield':
      if (hidden) break
      ctx.save()
      ctx.translate(hx + 8, hy)
      dot(ctx, 0, 0, 27, '#c8202f')
      dot(ctx, 0, 0, 21, '#f4f4f4')
      dot(ctx, 0, 0, 15, '#c8202f')
      dot(ctx, 0, 0, 10, '#27408b')
      starPath(ctx, 0, 0, 8, 3.5)
      ctx.fillStyle = '#f4f4f4'
      ctx.fill()
      ctx.restore()
      break
    case 'cape':
      ctx.save()
      ctx.translate(hx, hy)
      ctx.rotate(Math.PI / 2 - forearmAngle)
      ctx.fillStyle = '#9a9a9a'
      ctx.fillRect(0, -3, 30, 6)
      ctx.fillStyle = '#c7ccd4'
      ctx.beginPath()
      ctx.roundRect(24, -13, 24, 26, 4)
      ctx.fill()
      ctx.restore()
      break
    case 'sword':
    case 'blades': {
      const len = c.prop === 'sword' ? 78 : 40
      ctx.save()
      ctx.translate(hx, hy)
      ctx.rotate(Math.PI / 2 - forearmAngle)
      ctx.fillStyle = '#6b4a2a'
      ctx.fillRect(-8, -3, 14, 6)
      ctx.fillStyle = '#d8dde2'
      ctx.fillRect(6, -2.5, len, 5)
      ctx.fillStyle = '#9aa4b0'
      ctx.fillRect(6, 0, len, 2)
      ctx.restore()
      break
    }
    case 'wrap':
      ctx.save()
      ctx.translate(hx, hy)
      ctx.rotate(Math.PI / 2 - forearmAngle)
      ctx.fillStyle = '#e8e2d0'
      ctx.beginPath()
      ctx.moveTo(4, -3)
      ctx.lineTo(30, 0)
      ctx.lineTo(4, 3)
      ctx.fill()
      ctx.restore()
      break
    default:
  }
  void T
}

function starPath(ctx, x, y, R, r) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r : R
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath()
}

/**
 * Draws one fighter with feet on `groundY`. f needs { char, scale, x, y, face, state, st, move, flash, en, counterOn,
 * parryOn, knockT }. `T` is a free-running tick used for idle bob. `hideShield` hides Captain America's shield while
 * it is in the air.
 */
export function drawFighter(ctx, f, T, groundY = GROUND_Y, hideShield = false) {
  const c = fighterById(f.char)
  const L = lookOf(f.char)
  const s = f.scale * RENDER_K
  const P = poseOf(f, T)
  const flashing = f.flash > 4
  const W_ = flashing ? '#fff' : null
  const tint = col => W_ || col
  const lw = 17 * L.lw
  // Legs first, to find how far the pelvis hangs above the feet.
  const hipF = [3, 0]
  const hipB = [-3, 0]
  const kF = polar(hipF[0], hipF[1], THIGH, P.lF[0])
  const fF = polar(kF[0], kF[1], SHIN, P.lF[1])
  const kB = polar(hipB[0], hipB[1], THIGH, P.lB[0])
  const fB = polar(kB[0], kB[1], SHIN, P.lB[1])
  const footLow = Math.max(fF[1], fB[1])

  const px = f.x + (f.flash > 0 ? (f.flash % 2 ? 3 : -3) : 0)
  const rest = groundY - f.y - footLow * s - P.lift
  const py = lerp(rest, groundY - f.y - 18 * s, P.lying)

  // Shadow
  ctx.save()
  ctx.globalAlpha = 0.3 * (1 - Math.min(0.7, f.y / 300))
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(f.x, groundY + 6, (46 + (P.lying ? 24 : 0)) * s * (1 - Math.min(0.5, f.y / 400)), 10 * s, 0, 0, TAU)
  ctx.fill()
  ctx.restore()

  // Special-ready aura and counter/parry glow
  if (f.en >= 100 || f.counterOn || f.parryOn) {
    ctx.save()
    const pulse = 0.5 + 0.5 * Math.sin(T * 0.25)
    const g = ctx.createRadialGradient(f.x, py - 40 * s, 10, f.x, py - 40 * s, 120 * s)
    const hue = f.counterOn ? '127,243,255' : f.parryOn ? '255,233,168' : '255,214,74'
    g.addColorStop(0, `rgba(${hue},${0.28 + 0.2 * pulse})`)
    g.addColorStop(1, `rgba(${hue},0)`)
    ctx.fillStyle = g
    ctx.fillRect(f.x - 140 * s, py - 190 * s, 280 * s, 260 * s)
    ctx.restore()
  }

  ctx.save()
  ctx.translate(px, py)
  ctx.scale(f.face * s * P.twist, s)
  if (P.lying) ctx.rotate(-Math.PI * 0.5 * P.lying)

  const lean = P.lean
  const neck = [Math.sin(lean) * TORSO, -Math.cos(lean) * TORSO]
  const sh = [neck[0], neck[1] + 4]
  const headC = [neck[0] + Math.sin(lean + P.head) * 21, neck[1] - Math.cos(lean + P.head) * 21]
  const arm = pair => {
    const e = polar(sh[0], sh[1], UARM, pair[0])
    const h = polar(e[0], e[1], FARM, pair[1])
    return [e, h]
  }
  const [eB, hB] = arm(P.aB)
  const [eF, hF] = arm(P.aF)

  // Cape sits behind everything.
  if (c.prop === 'cape') {
    ctx.fillStyle = tint('#b52222')
    ctx.beginPath()
    ctx.moveTo(sh[0] - 4, sh[1])
    ctx.quadraticCurveTo(sh[0] - 34 - Math.sin(T * 0.1) * 5, sh[1] + 40, sh[0] - 26 - Math.sin(T * 0.1 + 1) * 6, sh[1] + 92)
    ctx.lineTo(sh[0] + 8, sh[1] + 6)
    ctx.fill()
  }
  // Back arm, back leg, front leg
  limb(ctx, sh[0], sh[1], eB[0], eB[1], 14 * L.lw, tint(L.sleeve))
  limb(ctx, eB[0], eB[1], hB[0], hB[1], 13 * L.lw, tint(L.fore))
  dot(ctx, hB[0], hB[1], 8 * L.lw, tint(L.fore === L.sleeve ? c.colors.skin : L.fore))
  limb(ctx, hipB[0], hipB[1], kB[0], kB[1], lw, tint(L.pants))
  limb(ctx, kB[0], kB[1], fB[0], fB[1], lw - 2, tint(L.pants))
  dot(ctx, fB[0] + 3, fB[1], 8, tint(L.boot))
  limb(ctx, hipF[0], hipF[1], kF[0], kF[1], lw, tint(L.pants))
  limb(ctx, kF[0], kF[1], fF[0], fF[1], lw - 2, tint(L.pants))
  dot(ctx, fF[0] + 4, fF[1], 8.5, tint(L.boot))
  // Torso
  const wB = 11 * L.tw
  const wT = 15 * L.tw
  const cl = Math.cos(lean)
  const sl = Math.sin(lean)
  ctx.beginPath()
  ctx.moveTo(-wB * cl, -wB * sl)
  ctx.lineTo(wB * cl, wB * sl)
  ctx.lineTo(neck[0] + wT * cl, neck[1] + wT * sl)
  ctx.lineTo(neck[0] - wT * cl, neck[1] - wT * sl)
  ctx.closePath()
  ctx.fillStyle = tint(L.torso)
  ctx.fill()
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 3
  ctx.stroke()
  limb(ctx, -wB * cl, -wB * sl, wB * cl, wB * sl, 6, tint(L.belt))
  if (!flashing) {
    if (f.char === 'cap') {
      ctx.fillStyle = '#f4f4f4'
      starPath(ctx, neck[0] * 0.55 + 2, neck[1] * 0.55, 7, 3)
      ctx.fill()
    } else if (c.prop === 'reactor') {
      dot(ctx, neck[0] * 0.6 + 4, neck[1] * 0.6, 6, '#7ff3ff')
      dot(ctx, neck[0] * 0.6 + 4, neck[1] * 0.6, 3, '#fff')
    } else if (c.prop === 'suspensor') {
      for (let i = 0; i < 3; i++) dot(ctx, -wB * 0.9 + i * 10, -4 - i, 3, '#ff6a4a')
    } else if (c.prop === 'web') {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(neck[0] * 0.3, neck[1] * 0.3)
      ctx.lineTo(neck[0] * 0.6 + 8, neck[1] * 0.6)
      ctx.moveTo(neck[0] * 0.3, neck[1] * 0.3)
      ctx.lineTo(neck[0] * 0.6 - 8, neck[1] * 0.6)
      ctx.stroke()
    }
  }
  // Head
  ctx.save()
  ctx.translate(headC[0], headC[1])
  ctx.rotate(P.head)
  drawHead(ctx, f.char, W_, 16)
  ctx.restore()
  // Front arm and its prop
  limb(ctx, sh[0], sh[1], eF[0], eF[1], 14 * L.lw, tint(L.sleeve))
  limb(ctx, eF[0], eF[1], hF[0], hF[1], 13 * L.lw, tint(L.fore))
  dot(ctx, hF[0], hF[1], 8.5 * L.lw, tint(L.fore === L.sleeve ? c.colors.skin : L.fore))
  if (!flashing) {
    drawProp(ctx, f, c, hF, P.aF[1], hideShield, T)
    if (c.prop === 'blades') drawProp(ctx, f, c, hB, P.aB[1], false, T)
    if (c.prop === 'reactor' && f.state === 'special' && f.move === 'beam') dot(ctx, hF[0] + 4, hF[1], 10, '#bffaff')
    if (f.char === 'ironman' && f.state === 'jump') {
      ctx.fillStyle = 'rgba(255,200,80,0.9)'
      ctx.beginPath()
      ctx.moveTo(fF[0] - 3, fF[1] + 6)
      ctx.lineTo(fF[0] + 3, fF[1] + 6)
      ctx.lineTo(fF[0], fF[1] + 24 + Math.sin(T) * 4)
      ctx.fill()
    }
  }
  ctx.restore()
}

// ───────────── arena ─────────────
function makeCrowd() {
  let seed = 12345
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const shirts = ['#c8202f', '#2f78d3', '#e8b52e', '#3fae4a', '#8a4fd0', '#f08a24', '#e8e8f0', '#1fa8a8']
  const skins = ['#f2c9a0', '#c99a76', '#8a5a3a', '#e8c39e', '#6b4a38']
  const rows = [
    { y: 228, s: 0.62, n: 52, dim: 0.62 },
    { y: 276, s: 0.78, n: 42, dim: 0.5 },
    { y: 330, s: 0.95, n: 34, dim: 0.4 },
  ]
  return rows.map(r => ({
    ...r,
    people: Array.from({ length: r.n }, (_, i) => ({
      x: (i + rnd() * 0.6) * (W / r.n) + 10,
      shirt: shirts[Math.floor(rnd() * shirts.length)],
      skin: skins[Math.floor(rnd() * skins.length)],
      ph: rnd() * TAU,
      jump: rnd() < 0.18,
    })),
  }))
}

const LIGHTS = [180, 470, 810, 1100]
const STAR_SPOTS = Array.from({ length: 26 }, (_, i) => ({ x: 60 + ((i * 197) % 1160), y: 150 + ((i * 89) % 200), ph: i * 1.7 }))

function buildBackdrop() {
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')
  // Hall
  const wall = g.createLinearGradient(0, 0, 0, 470)
  wall.addColorStop(0, '#0d1226')
  wall.addColorStop(1, '#27203f')
  g.fillStyle = wall
  g.fillRect(0, 0, W, 470)
  // Coloured wall panels, like the arena screens behind the crowd
  const panel = (pts, color) => {
    g.fillStyle = color
    g.beginPath()
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
    g.closePath()
    g.fill()
  }
  panel([[0, 150], [330, 175], [330, 250], [0, 290]], '#1f8f6a')
  panel([[330, 175], [520, 190], [520, 245], [330, 250]], '#b8322a')
  panel([[760, 190], [1280, 150], [1280, 290], [760, 245]], '#c9722a')
  // Banner wall
  const band = g.createLinearGradient(0, 355, 0, 470)
  band.addColorStop(0, '#141826')
  band.addColorStop(1, '#0a0c16')
  g.fillStyle = band
  g.fillRect(0, 372, W, 98)
  g.fillStyle = '#2c3350'
  g.fillRect(0, 368, W, 5)
  const banner = (x, w, text) => {
    g.fillStyle = '#1d2236'
    g.fillRect(x, 392, w, 58)
    g.strokeStyle = '#3d4670'
    g.lineWidth = 2
    g.strokeRect(x, 392, w, 58)
    g.fillStyle = '#e9ecf8'
    g.font = '900 34px "Bricolage Grotesque Variable", Impact, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, x + w / 2, 422)
  }
  banner(-30, 330, 'CHAMPIONSHIP')
  banner(360, 250, 'MULTIVERSE')
  banner(660, 290, 'FIGHTER CUP')
  banner(990, 330, 'CHAMPIONSHIP')
  // Dark barrier in front of the mat
  g.fillStyle = '#05060d'
  g.fillRect(0, 452, W, 20)
  // Mat: blue trapezoid, red square, white lines
  g.fillStyle = '#16367a'
  g.fillRect(0, 472, W, H - 472)
  const quad = (pts, color) => {
    g.fillStyle = color
    g.beginPath()
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
    g.closePath()
    g.fill()
  }
  quad([[210, 472], [1070, 472], [1420, 720], [-140, 720]], '#2358b8')
  quad([[230, 472], [1050, 472], [1090, 482], [190, 482]], '#d63a3a')
  quad([[440, 520], [840, 520], [980, 700], [300, 700]], '#e0504a')
  g.strokeStyle = 'rgba(255,255,255,0.8)'
  g.lineWidth = 5
  g.beginPath()
  g.moveTo(440, 520)
  g.lineTo(840, 520)
  g.lineTo(980, 700)
  g.lineTo(300, 700)
  g.closePath()
  g.stroke()
  g.strokeStyle = 'rgba(255,255,255,0.35)'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(640, 520)
  g.lineTo(640, 700)
  g.stroke()
  // Vignette
  const v = g.createRadialGradient(W / 2, 400, 250, W / 2, 400, 820)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.5)')
  g.fillStyle = v
  g.fillRect(0, 0, W, H)
  return cv
}

function starFlare(ctx, x, y, size, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.globalCompositeOperation = 'lighter'
  const g = ctx.createRadialGradient(x, y, 0, x, y, size)
  g.addColorStop(0, 'rgba(255,255,255,0.95)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(x - size, y - size, size * 2, size * 2)
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(x, y - size)
  ctx.lineTo(x + size * 0.1, y - size * 0.1)
  ctx.lineTo(x + size, y)
  ctx.lineTo(x + size * 0.1, y + size * 0.1)
  ctx.lineTo(x, y + size)
  ctx.lineTo(x - size * 0.1, y + size * 0.1)
  ctx.lineTo(x - size, y)
  ctx.lineTo(x - size * 0.1, y - size * 0.1)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// ───────────── specials ─────────────
function drawZones(ctx, view, T) {
  for (const z of view.zones) {
    const tele = z.t < z.tele
    if (tele) {
      const k = z.t / z.tele
      ctx.fillStyle = `rgba(150,220,255,${0.15 + 0.25 * k})`
      ctx.beginPath()
      ctx.ellipse(z.x, GROUND_Y + 6, z.w * 0.5 * (0.6 + 0.4 * k), 14, 0, 0, TAU)
      ctx.fill()
    } else {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const bolt = ctx.createLinearGradient(z.x - z.w / 2, 0, z.x + z.w / 2, 0)
      bolt.addColorStop(0, 'rgba(120,200,255,0)')
      bolt.addColorStop(0.5, 'rgba(235,248,255,0.95)')
      bolt.addColorStop(1, 'rgba(120,200,255,0)')
      ctx.fillStyle = bolt
      ctx.fillRect(z.x - z.w / 2, 0, z.w, GROUND_Y + 6)
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(z.x, 0)
      for (let y = 40; y < GROUND_Y; y += 52) ctx.lineTo(z.x + Math.sin(y * 0.7 + T) * 22, y)
      ctx.lineTo(z.x, GROUND_Y)
      ctx.stroke()
      ctx.restore()
    }
  }
}

function drawProjectiles(ctx, view, T) {
  for (const p of view.proj) {
    const y = GROUND_Y - p.y
    if (p.type === 'shield') {
      ctx.save()
      ctx.translate(p.x, y)
      ctx.scale(Math.cos(T * 0.5) * 0.35 + 0.65, 1)
      dot(ctx, 0, 0, 30, '#c8202f')
      dot(ctx, 0, 0, 23, '#f4f4f4')
      dot(ctx, 0, 0, 16, '#c8202f')
      dot(ctx, 0, 0, 11, '#27408b')
      starPath(ctx, 0, 0, 9, 4)
      ctx.fillStyle = '#f4f4f4'
      ctx.fill()
      ctx.restore()
    } else if (p.type === 'web') {
      const o = view.fighters[p.owner]
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(o.x + o.face * 40, GROUND_Y - o.y - 145 * o.scale)
      ctx.lineTo(p.x, y)
      ctx.stroke()
      dot(ctx, p.x, y, 10, '#fff')
    } else if (p.type === 'wave') {
      ctx.save()
      ctx.globalAlpha = Math.max(0, 1 - p.t / 70)
      ctx.strokeStyle = '#ffe9b0'
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.ellipse(p.x, GROUND_Y + 4, 34, 22 + (p.t % 8), 0, 0, TAU)
      ctx.stroke()
      ctx.fillStyle = 'rgba(210,180,130,0.5)'
      ctx.beginPath()
      ctx.ellipse(p.x, GROUND_Y + 6, 52, 16, 0, 0, TAU)
      ctx.fill()
      ctx.restore()
    }
  }
}

/** Effects tied to a fighter's own special: beams, claw streaks, blade rings, grav lines. */
function drawSpecialFx(ctx, view, T) {
  for (const f of view.fighters) {
    if (f.state !== 'special') continue
    const o = view.fighters[1 - f.idx]
    const hy = GROUND_Y - f.y - 135 * f.scale
    const d = f.face
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    if (f.move === 'beam' && f.st >= 14 && f.st < 50) {
      const x0 = f.x + d * 50
      const len = 680
      const g = ctx.createLinearGradient(x0, 0, x0 + d * len, 0)
      g.addColorStop(0, 'rgba(255,255,255,0.95)')
      g.addColorStop(0.2, 'rgba(127,243,255,0.8)')
      g.addColorStop(1, 'rgba(127,243,255,0)')
      ctx.fillStyle = g
      const th = 20 + Math.sin(T * 1.2) * 5
      ctx.fillRect(d > 0 ? x0 : x0 - len, hy - th / 2, len, th)
    } else if (f.move === 'chain' || f.move === 'lunge') {
      ctx.strokeStyle = f.char === 'paul' ? 'rgba(127,230,255,0.8)' : 'rgba(220,220,255,0.7)'
      ctx.lineWidth = 3
      for (let i = 0; i < 5; i++) {
        const y = hy - 40 + i * 20
        ctx.beginPath()
        ctx.moveTo(f.x - d * (30 + i * 8), y)
        ctx.lineTo(f.x - d * (90 + i * 14 + ((T * 7) % 20)), y)
        ctx.stroke()
      }
    } else if (f.move === 'spin' && f.st >= 6 && f.st < 50) {
      ctx.strokeStyle = 'rgba(255,90,90,0.85)'
      ctx.lineWidth = 6
      const r = 110 + Math.sin(f.st) * 8
      ctx.beginPath()
      ctx.ellipse(f.x, hy + 10, r, 38, 0, f.st * 0.6, f.st * 0.6 + Math.PI * 1.3)
      ctx.stroke()
    } else if (f.move === 'grav' && f.st >= 14 && f.st < 48) {
      const k = clamp01((f.st - 14) / 8)
      ctx.strokeStyle = `rgba(255,106,74,${0.6 * k})`
      ctx.lineWidth = 4
      ctx.setLineDash([10, 8])
      ctx.beginPath()
      ctx.moveTo(f.x + d * 30, hy)
      ctx.lineTo(o.x, GROUND_Y - o.y - 120 * o.scale)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.ellipse(o.x, GROUND_Y + 6, 60, 14, 0, 0, TAU)
      ctx.stroke()
    } else if (f.move === 'storm') {
      ctx.fillStyle = 'rgba(150,200,255,0.18)'
      ctx.fillRect(0, 0, W, 90)
    } else if (f.move === 'combo' && f.st >= 16 && f.st < 48) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 5
      const a = ((f.st - 16) % 12) / 12
      ctx.beginPath()
      ctx.arc(f.x + d * 20, hy, 90, d > 0 ? -1.6 + a * 2.6 : Math.PI - 1 - a * 2.6, d > 0 ? -1.6 + a * 2.6 + 0.8 : Math.PI + 0.8 - a * 2.6)
      ctx.stroke()
    }
    ctx.restore()
  }
}

/**
 * @param {HTMLCanvasElement} canvas
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d')
  const backdrop = buildBackdrop()
  const crowd = makeCrowd()

  function drawCrowd(time) {
    for (const row of crowd) {
      for (const p of row.people) {
        const jump = p.jump && Math.sin(time * 2.2 + p.ph) > 0.7
        const bob = Math.sin(time * 3 + p.ph) * 2.5 * row.s - (jump ? 7 * row.s : 0)
        const s = row.s
        const y = row.y + bob
        ctx.fillStyle = p.shirt
        ctx.beginPath()
        ctx.roundRect(p.x - 9 * s, y - 2 * s, 18 * s, 26 * s, 5 * s)
        ctx.fill()
        if (jump) {
          ctx.strokeStyle = p.skin
          ctx.lineWidth = 3 * s
          ctx.beginPath()
          ctx.moveTo(p.x - 8 * s, y + 2 * s)
          ctx.lineTo(p.x - 13 * s, y - 14 * s)
          ctx.moveTo(p.x + 8 * s, y + 2 * s)
          ctx.lineTo(p.x + 13 * s, y - 14 * s)
          ctx.stroke()
        }
        dot(ctx, p.x, y - 9 * s, 7 * s, p.skin)
      }
      ctx.fillStyle = `rgba(6,8,22,${row.dim})`
      ctx.fillRect(0, row.y - 30, W, 70)
    }
  }

  function drawLights(time) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    LIGHTS.forEach((lx, i) => {
      const sway = Math.sin(time * 0.7 + i * 1.9) * 60
      const g = ctx.createLinearGradient(lx, 0, lx + sway, 430)
      g.addColorStop(0, 'rgba(210,235,255,0.30)')
      g.addColorStop(1, 'rgba(210,235,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(lx - 14, 0)
      ctx.lineTo(lx + 14, 0)
      ctx.lineTo(lx + sway + 120, 430)
      ctx.lineTo(lx + sway - 120, 430)
      ctx.closePath()
      ctx.fill()
    })
    ctx.restore()
    LIGHTS.forEach((lx, i) => starFlare(ctx, lx, 22, 34 + 8 * Math.sin(time * 3 + i), 0.9))
    for (const s of STAR_SPOTS) {
      const a = Math.sin(time * 4 + s.ph)
      if (a > 0.86) starFlare(ctx, s.x, s.y, 14 * a, (a - 0.86) * 5)
    }
  }

  return {
    /**
     * @param {object} view fighters, proj, zones, phase
     * @param {number} T free-running tick for animation
     * @param {ReturnType<import('./fx').createFx>} fx
     * @param {{x:number, y:number}} [camera] zoom origin for the KO moment
     */
    draw(view, T, fx, zoom = 1) {
      const time = T / 60
      const sh = fx.shakeOffset()
      ctx.save()
      ctx.clearRect(0, 0, W, H)
      if (zoom !== 1) {
        ctx.translate(W / 2, GROUND_Y - 100)
        ctx.scale(zoom, zoom)
        ctx.translate(-W / 2, -(GROUND_Y - 100))
      }
      ctx.translate(sh.x, sh.y)
      ctx.drawImage(backdrop, 0, 0)
      drawCrowd(time)
      drawLights(time)
      drawZones(ctx, view, T)
      const hidden = [false, false]
      for (const p of view.proj) if (p.type === 'shield') hidden[p.owner] = true
      const order = view.fighters[0].y > view.fighters[1].y ? [1, 0] : [0, 1]
      for (const i of order) {
        const f = view.fighters[i]
        drawFighter(ctx, f, T, GROUND_Y, hidden[i] || (f.state === 'special' && f.move === 'shield' && f.st >= 10))
      }
      drawSpecialFx(ctx, view, T)
      drawProjectiles(ctx, view, T)
      fx.draw(ctx)
      ctx.restore()
      fx.drawFlash(ctx, W, H)
    },
    dispose() {
      /* the canvas belongs to React; nothing else to release */
    },
  }
}

/** Static head-and-shoulders portrait for HUD, grid and lobby, drawn once onto a small canvas. */
export function drawPortrait(canvas, id) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  const c = fighterById(id)
  const L = lookOf(id)
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#1d5a66')
  bg.addColorStop(1, '#0d2c3a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  const k = w / 80
  ctx.save()
  ctx.scale(k, k)
  ctx.fillStyle = L.torso
  ctx.beginPath()
  ctx.roundRect(8, 56, 64, 40, 14)
  ctx.fill()
  ctx.fillStyle = L.belt
  ctx.fillRect(34, 56, 12, 40)
  ctx.translate(40, 38)
  ctx.scale(1.5, 1.5)
  drawHead(ctx, id, null, 16)
  ctx.restore()
  void c
}

/** One idle fighter on a transparent canvas, for the menu and VS screens. `T` animates the idle bob. */
export function drawFighterPreview(canvas, id, T, pose = 'idle') {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const c = fighterById(id)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const k = (canvas.height * 0.86) / 330
  ctx.save()
  ctx.translate(canvas.width / 2, canvas.height * 0.93)
  ctx.scale(k, k)
  ctx.globalAlpha = 1
  const f = {
    idx: 0, char: id, scale: c.scale, x: 0, y: 0, face: 1, state: pose, st: Math.floor(T), move: '', flash: 0, en: 0,
    counterOn: false, parryOn: false, knockT: 0,
  }
  drawFighter(ctx, f, T, 0)
  ctx.restore()
}
