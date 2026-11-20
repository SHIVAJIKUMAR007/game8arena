// Canvas drawing for Bubble Surge. Everything expensive (gradients, shadows) is drawn once into offscreen canvases:
// one sprite per bubble type, one background, one layer holding the whole field. A frame is then a handful of
// drawImage calls plus the few moving things, which keeps ~550 bubbles at 60fps.
import { CELL_X, CELL_Y, COLS, CX, CY, D, H, N, R, RING_R, ROWS, W, cellX } from './hex'
import { BOMB, EMPTY, PALETTE, RAINBOW } from './logic'

const PAD = 3 // sprite margin (device px) for the soft shadow

const make = (w, h) => {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  return c
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const mix = v => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))))
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`
}

function bubbleBase(ctx, cx, cy, r, fill) {
  ctx.save()
  ctx.shadowColor = 'rgba(60, 10, 0, 0.45)'
  ctx.shadowBlur = r * 0.18
  ctx.shadowOffsetY = r * 0.1
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.restore()
}

function gloss(ctx, cx, cy, r) {
  // soft highlight top-left plus a tiny sparkle
  ctx.save()
  ctx.translate(cx - r * 0.36, cy - r * 0.4)
  ctx.rotate(-Math.PI / 4)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.46)
  g.addColorStop(0, 'rgba(255,255,255,0.95)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 0.4, r * 0.24, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.beginPath()
  ctx.arc(cx + r * 0.3, cy + r * 0.42, r * 0.09, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fill()
}

function colorSprite(color, px) {
  const size = px + PAD * 2
  const c = make(size, size)
  const ctx = c.getContext('2d')
  const cx = size / 2
  const r = px / 2 - 0.5
  const grad = ctx.createRadialGradient(cx - r * 0.3, cx - r * 0.35, r * 0.1, cx, cx, r)
  grad.addColorStop(0, shade(color, 0.5))
  grad.addColorStop(0.5, color)
  grad.addColorStop(1, shade(color, -0.5))
  bubbleBase(ctx, cx, cx, r, grad)
  ctx.lineWidth = Math.max(1, r * 0.07)
  ctx.strokeStyle = shade(color, -0.6)
  ctx.beginPath()
  ctx.arc(cx, cx, r - ctx.lineWidth / 2, 0, Math.PI * 2)
  ctx.stroke()
  gloss(ctx, cx, cx, r)
  return c
}

function rainbowSprite(px) {
  const size = px + PAD * 2
  const c = make(size, size)
  const ctx = c.getContext('2d')
  const cx = size / 2
  const r = px / 2 - 0.5
  let fill
  if (ctx.createConicGradient) {
    fill = ctx.createConicGradient(-Math.PI / 2, cx, cx)
    ;['#ff3b30', '#ffd31a', '#3ddc2a', '#19d9f5', '#1e6bff', '#a53df0', '#ff3b30'].forEach((col, i) => fill.addColorStop(i / 6, col))
  } else {
    fill = ctx.createLinearGradient(0, 0, size, size)
    ;['#ff3b30', '#ffd31a', '#3ddc2a', '#1e6bff', '#a53df0'].forEach((col, i) => fill.addColorStop(i / 4, col))
  }
  bubbleBase(ctx, cx, cx, r, fill)
  const shadeG = ctx.createRadialGradient(cx - r * 0.3, cx - r * 0.35, r * 0.1, cx, cx, r)
  shadeG.addColorStop(0, 'rgba(255,255,255,0.45)')
  shadeG.addColorStop(0.55, 'rgba(255,255,255,0)')
  shadeG.addColorStop(1, 'rgba(0,0,0,0.4)')
  ctx.beginPath()
  ctx.arc(cx, cx, r, 0, Math.PI * 2)
  ctx.fillStyle = shadeG
  ctx.fill()
  ctx.lineWidth = Math.max(1.5, r * 0.1)
  ctx.strokeStyle = '#fff'
  ctx.beginPath()
  ctx.arc(cx, cx, r - ctx.lineWidth / 2, 0, Math.PI * 2)
  ctx.stroke()
  gloss(ctx, cx, cx, r)
  return c
}

function bombSprite(px) {
  const size = px + PAD * 2
  const c = make(size, size)
  const ctx = c.getContext('2d')
  const cx = size / 2
  const r = px / 2 - 0.5
  const grad = ctx.createRadialGradient(cx - r * 0.3, cx - r * 0.35, r * 0.1, cx, cx, r)
  grad.addColorStop(0, '#6a6a7a')
  grad.addColorStop(0.5, '#23232e')
  grad.addColorStop(1, '#07070b')
  bubbleBase(ctx, cx, cx, r, grad)
  ctx.lineWidth = Math.max(1.5, r * 0.1)
  ctx.strokeStyle = '#ff9a00'
  ctx.beginPath()
  ctx.arc(cx, cx, r - ctx.lineWidth / 2, 0, Math.PI * 2)
  ctx.stroke()
  // fuse and spark
  ctx.strokeStyle = '#d9c9a0'
  ctx.lineWidth = Math.max(1.5, r * 0.12)
  ctx.beginPath()
  ctx.moveTo(cx + r * 0.2, cx - r * 0.85)
  ctx.quadraticCurveTo(cx + r * 0.55, cx - r * 1.1, cx + r * 0.75, cx - r * 0.85)
  ctx.stroke()
  ctx.fillStyle = '#ffd31a'
  const sx = cx + r * 0.78
  const sy = cx - r * 0.88
  ctx.beginPath()
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4
    const rr = k % 2 ? r * 0.12 : r * 0.28
    ctx.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fill()
  gloss(ctx, cx, cx, r)
  return c
}

/** Sprites for every bubble type at a bubble diameter of `px` device pixels. Index by cell value. */
export function createSprites(px) {
  const sprites = []
  PALETTE.forEach((col, k) => (sprites[k + 1] = colorSprite(col, px)))
  sprites[RAINBOW] = rainbowSprite(px)
  sprites[BOMB] = bombSprite(px)
  return { sprites, px, pad: PAD }
}

/** Draws one bubble sprite centred at logical (x, y). `scale` and `alpha` are optional. */
export function drawBubble(ctx, set, value, x, y, s, scale = 1, alpha = 1) {
  const sprite = set.sprites[value]
  if (!sprite) return
  const w = sprite.width * scale
  ctx.globalAlpha = alpha
  ctx.drawImage(sprite, x * s - w / 2, y * s - w / 2, w, w)
  if (alpha !== 1) ctx.globalAlpha = 1
}

// ───────────── layers ─────────────
/** Warm coral background with big soft circles of lighter orange. */
export function createBackground(s) {
  const c = make(W * s, H * s)
  const ctx = c.getContext('2d')
  ctx.scale(s, s)
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#ff7a55')
  g.addColorStop(1, '#ee4a38')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const blob = (x, y, r, a) => {
    const rg = ctx.createRadialGradient(x, y, r * 0.2, x, y, r)
    rg.addColorStop(0, `rgba(255, 190, 110, ${a})`)
    rg.addColorStop(1, 'rgba(255, 190, 110, 0)')
    ctx.fillStyle = rg
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  blob(CX - 190, CY - 30, 330, 0.7)
  blob(CX + 130, CY + 40, 260, 0.55)
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(255, 220, 160, 0.4)'
  ctx.beginPath()
  ctx.arc(CX + 130, CY + 40, 235, 0, Math.PI * 2)
  ctx.stroke()
  return c
}

function frame(ctx) {
  // bubbly light-blue frame
  const t = 14
  ctx.lineWidth = t
  ctx.strokeStyle = '#a8ecf7'
  ctx.strokeRect(t / 2, t / 2, W - t, H - t)
  ctx.lineWidth = 3
  ctx.strokeStyle = '#ffffff'
  ctx.strokeRect(t, t, W - t * 2, H - t * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  for (let x = 12; x < W; x += 30) {
    ctx.beginPath()
    ctx.arc(x, 7, 6, 0, Math.PI * 2)
    ctx.arc(x + 14, H - 7, 6, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let y = 12; y < H; y += 30) {
    ctx.beginPath()
    ctx.arc(7, y, 6, 0, Math.PI * 2)
    ctx.arc(W - 7, y + 14, 6, 0, Math.PI * 2)
    ctx.fill()
  }
  // red markers along the top edge
  for (let c = 1; c < COLS; c += 3) {
    const x = cellX(0, c)
    ctx.beginPath()
    ctx.moveTo(x - 9, 14)
    ctx.lineTo(x + 9, 14)
    ctx.lineTo(x, 32)
    ctx.closePath()
    ctx.fillStyle = '#e8201c'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#fff'
    ctx.stroke()
  }
  // cyan arrow tabs on the left and right edges
  for (let r = 1; r < ROWS; r += 3) {
    const y = r * 0.866 * D + R
    for (const side of [0, 1]) {
      const x = side ? W - 16 : 16
      const dir = side ? -1 : 1
      ctx.fillStyle = '#4fd8f0'
      ctx.beginPath()
      ctx.roundRect(x - 13, y - 22, 26, 44, 9)
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#d9fbff'
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(x + dir * 7, y)
      ctx.lineTo(x - dir * 5, y - 9)
      ctx.lineTo(x - dir * 5, y + 9)
      ctx.closePath()
      ctx.fill()
    }
  }
}

/** The whole field plus the frame, redrawn only when the field changes. */
export function createFieldLayer(cells, set, s) {
  const c = make(W * s, H * s)
  const ctx = c.getContext('2d')
  for (let i = 0; i < N; i++) {
    if (cells[i] !== EMPTY) drawBubble(ctx, set, cells[i], CELL_X[i], CELL_Y[i], s)
  }
  ctx.scale(s, s)
  frame(ctx)
  return c
}

// ───────────── per-frame pieces ─────────────
/** Purple ring, warning arc, aim arrow. `creep` is 0..1, how close the field is to creeping in. */
export function drawShooter(ctx, s, aim, creepFill) {
  ctx.save()
  ctx.scale(s, s)
  // soft inner glow
  const glow = ctx.createRadialGradient(CX, CY, 4, CX, CY, RING_R)
  glow.addColorStop(0, 'rgba(255, 220, 170, 0.5)')
  glow.addColorStop(1, 'rgba(255, 160, 100, 0.15)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(CX, CY, RING_R, 0, Math.PI * 2)
  ctx.fill()
  // ring
  ctx.lineWidth = 10
  ctx.strokeStyle = '#5b3a9a'
  ctx.beginPath()
  ctx.arc(CX, CY, RING_R, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 3
  ctx.strokeStyle = '#8f6bd4'
  ctx.beginPath()
  ctx.arc(CX, CY, RING_R + 3, 0, Math.PI * 2)
  ctx.stroke()
  // warning arc: fills as shots without a pop pile up
  if (creepFill > 0) {
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.strokeStyle = creepFill > 0.7 ? '#ff2e2e' : '#ffe27a'
    ctx.beginPath()
    ctx.arc(CX, CY, RING_R + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * creepFill)
    ctx.stroke()
  }
  // aim arrow circling the ring
  ctx.translate(CX, CY)
  ctx.rotate(aim)
  ctx.translate(RING_R + 22, 0)
  ctx.beginPath()
  ctx.moveTo(13, 0)
  ctx.lineTo(-9, -10)
  ctx.lineTo(-9, 10)
  ctx.closePath()
  ctx.fillStyle = '#3ddc2a'
  ctx.fill()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = '#0f6b0a'
  ctx.stroke()
  ctx.restore()
}

/** Dotted aiming guide. */
export function drawAim(ctx, s, dots) {
  ctx.save()
  ctx.scale(s, s)
  dots.forEach((d, k) => {
    ctx.globalAlpha = Math.max(0.25, 1 - k * 0.012)
    ctx.beginPath()
    ctx.arc(d.x, d.y, 4.2, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = 'rgba(80, 20, 0, 0.5)'
    ctx.stroke()
  })
  ctx.restore()
}

/** A four-point sparkle, used for the idle twinkle on the field. */
export function drawSparkle(ctx, s, x, y, size, alpha) {
  ctx.save()
  ctx.scale(s, s)
  ctx.translate(x, y)
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 - Math.PI / 2
    const rr = k % 2 ? size * 0.22 : size
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
