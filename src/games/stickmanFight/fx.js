// Visual effects: particles, rings, floating numbers, weapon trails and screen shake. Pure data plus a few draw
// helpers; nothing here touches the rules, so the fight plays the same with effects off (reduced motion).

const rnd = (a, b) => a + Math.random() * (b - a)

export function createFx() {
  return { parts: [], rings: [], texts: [], trails: [[], []], shake: 0, flash: 0, flashColor: '#fff', slow: 0 }
}

export function burst(fx, x, y, n, o = {}) {
  const { color = '#fff', speed = 300, life = 0.5, size = 4, g = 900, dir = 0, spread = Math.PI * 2, shape = 'dot', drag = 0.4 } = o
  for (let i = 0; i < n; i++) {
    const a = (dir ? (dir > 0 ? 0 : Math.PI) : -Math.PI / 2) + rnd(-spread / 2, spread / 2)
    const v = rnd(speed * 0.3, speed)
    fx.parts.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g, life: rnd(life * 0.6, life), age: 0,
      size: rnd(size * 0.6, size), color: Array.isArray(color) ? color[(Math.random() * color.length) | 0] : color, shape, drag,
    })
  }
  if (fx.parts.length > 700) fx.parts.splice(0, fx.parts.length - 700)
}

export const ring = (fx, x, y, r, color = '#fff', life = 0.35, width = 6) => fx.rings.push({ x, y, r, color, life, age: 0, width })
export const text = (fx, x, y, str, color = '#fff', size = 28) => fx.texts.push({ x, y, str, color, size, age: 0, life: 0.9, vx: rnd(-30, 30) })
export const shake = (fx, amount) => {
  fx.shake = Math.max(fx.shake, amount)
}

export function updateFx(fx, dt) {
  for (const p of fx.parts) {
    p.age += dt
    p.vy += p.g * dt
    const d = Math.max(0, 1 - p.drag * dt)
    p.vx *= d
    p.x += p.vx * dt
    p.y += p.vy * dt
  }
  fx.parts = fx.parts.filter(p => p.age < p.life)
  for (const r of fx.rings) r.age += dt
  fx.rings = fx.rings.filter(r => r.age < r.life)
  for (const t of fx.texts) {
    t.age += dt
    t.y -= 46 * dt
    t.x += t.vx * dt
  }
  fx.texts = fx.texts.filter(t => t.age < t.life)
  fx.shake = Math.max(0, fx.shake - dt * 2.4)
  fx.flash = Math.max(0, fx.flash - dt * 3)
  for (const tr of fx.trails) for (const pt of tr) pt.age += dt
  for (let i = 0; i < fx.trails.length; i++) fx.trails[i] = fx.trails[i].filter(pt => pt.age < 0.22)
}

export const rainbow = (t, o = 0) => `hsl(${Math.floor((t * 240 + o) % 360)} 95% 60%)`

export function drawFx(ctx, fx, time) {
  // trails
  for (const [i, tr] of fx.trails.entries()) {
    if (tr.length < 2) continue
    const color = fx.trailColor?.[i] || '#fff'
    for (let k = 1; k < tr.length; k++) {
      const a = tr[k - 1]
      const b = tr[k]
      const life = 1 - b.age / 0.22
      ctx.strokeStyle = color === 'rainbow' ? rainbow(time, k * 12) : color
      ctx.globalAlpha = Math.max(0, life) * 0.8
      ctx.lineWidth = 3 + life * 9
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
  for (const r of fx.rings) {
    const k = r.age / r.life
    ctx.globalAlpha = 1 - k
    ctx.strokeStyle = r.color
    ctx.lineWidth = r.width * (1 - k * 0.7)
    ctx.beginPath()
    ctx.arc(r.x, r.y, r.r * (0.2 + k * 0.8), 0, Math.PI * 2)
    ctx.stroke()
  }
  for (const p of fx.parts) {
    const k = p.age / p.life
    ctx.globalAlpha = Math.max(0, 1 - k)
    ctx.fillStyle = p.color
    if (p.shape === 'spark') {
      ctx.strokeStyle = p.color
      ctx.lineWidth = Math.max(1.5, p.size * 0.5)
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * (p.shape === 'smoke' ? 1 + k : 1 - k * 0.4), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
  ctx.textAlign = 'center'
  ctx.lineJoin = 'round'
  for (const t of fx.texts) {
    const k = t.age / t.life
    ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3
    const pop = k < 0.15 ? 1 + (0.15 - k) * 4 : 1
    ctx.font = `900 ${Math.round(t.size * pop)}px system-ui, sans-serif`
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'
    ctx.strokeText(t.str, t.x, t.y)
    ctx.fillStyle = t.color
    ctx.fillText(t.str, t.x, t.y)
  }
  ctx.globalAlpha = 1
}
