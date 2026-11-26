// Visual effects for the fight: hit sparks, floating damage numbers, screen shake and flashes. This is presentation
// only (it may use Math.random); nothing here feeds back into the simulation. The game loop calls tick() once per
// simulation step so effects slow down with the KO slow-motion, and draw() once per frame.

/** Screen y of the mat line the fighters stand on. Shared with the renderer. */
export const GROUND_Y = 600

export function createFx() {
  let parts = []
  let nums = []
  let shake = 0
  let flash = 0
  let flashColor = '#fff'
  const rnd = (a, b) => a + Math.random() * (b - a)

  const spark = (x, y, n, color, speed) => {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2)
      const v = rnd(speed * 0.4, speed)
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: rnd(14, 26), max: 26, r: rnd(2, 5), color })
    }
  }

  return {
    /** Reacts to one simulation event. */
    onEvent(e) {
      const y = GROUND_Y - e.y
      switch (e.k) {
        case 'hit':
          spark(e.x, y, e.block ? 6 : e.big ? 22 : 12, e.block ? '#8fd0ff' : '#ffd84a', e.big ? 9 : 6)
          parts.push({ x: e.x, y, vx: 0, vy: 0, life: 8, max: 8, r: e.big ? 46 : 30, color: '#fff', ring: true })
          nums.push({ x: e.x + rnd(-14, 14), y: y - 40, life: 46, text: e.block ? String(e.dmg) : `-${e.dmg}`, color: e.block ? '#9fd8ff' : e.combo > 2 ? '#ff9a2e' : '#fff', size: e.big ? 40 : 30 })
          shake = Math.max(shake, e.block ? 2 : e.big ? 9 : 4)
          break
        case 'counter':
          spark(e.x, y, 26, '#7ff3ff', 10)
          nums.push({ x: e.x, y: y - 60, life: 60, text: 'COUNTER!', color: '#7ff3ff', size: 38 })
          shake = Math.max(shake, 10)
          flash = 6
          flashColor = '#bff'
          break
        case 'parry':
          spark(e.x, y, 18, '#ffe9a8', 8)
          nums.push({ x: e.x, y: y - 60, life: 60, text: 'PARRY!', color: '#ffe9a8', size: 38 })
          shake = Math.max(shake, 5)
          break
        case 'special':
          spark(e.x, y, 18, '#fff3a0', 8)
          flash = 5
          flashColor = '#fff6c8'
          break
        case 'shake':
          shake = Math.max(shake, e.power)
          break
        case 'bolt':
          flash = 4
          flashColor = '#dff4ff'
          shake = Math.max(shake, 8)
          spark(e.x, GROUND_Y, 14, '#bfe8ff', 8)
          break
        case 'bleed':
          nums.push({ x: e.x, y: y - 20, life: 34, text: '-3', color: '#ff4a4a', size: 22 })
          break
        case 'ko':
        case 'timeup':
          shake = 16
          flash = 8
          flashColor = '#fff'
          break
        default:
      }
    },
    tick() {
      for (const p of parts) {
        p.x += p.vx
        p.y += p.vy
        p.vy += p.ring ? 0 : 0.35
        p.life--
      }
      parts = parts.filter(p => p.life > 0)
      for (const n of nums) {
        n.y -= 1.1
        n.life--
      }
      nums = nums.filter(n => n.life > 0)
      shake *= 0.86
      if (shake < 0.2) shake = 0
      if (flash > 0) flash--
    },
    shakeOffset() {
      return shake ? { x: rnd(-shake, shake), y: rnd(-shake, shake) * 0.6 } : { x: 0, y: 0 }
    },
    draw(ctx) {
      for (const p of parts) {
        const k = p.life / p.max
        ctx.globalAlpha = Math.min(1, k * 1.4)
        if (p.ring) {
          ctx.strokeStyle = p.color
          ctx.lineWidth = 4 * k
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r * (1.3 - k), 0, Math.PI * 2)
          ctx.stroke()
        } else {
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.moveTo(p.x, p.y - p.r)
          ctx.lineTo(p.x + p.r * 0.6, p.y)
          ctx.lineTo(p.x, p.y + p.r)
          ctx.lineTo(p.x - p.r * 0.6, p.y)
          ctx.closePath()
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
      ctx.textAlign = 'center'
      ctx.lineJoin = 'round'
      for (const n of nums) {
        ctx.globalAlpha = Math.min(1, n.life / 18)
        ctx.font = `900 ${n.size}px "Bricolage Grotesque Variable", Impact, sans-serif`
        ctx.lineWidth = 6
        ctx.strokeStyle = 'rgba(10,10,30,0.85)'
        ctx.strokeText(n.text, n.x, n.y)
        ctx.fillStyle = n.color
        ctx.fillText(n.text, n.x, n.y)
      }
      ctx.globalAlpha = 1
    },
    drawFlash(ctx, w, h) {
      if (flash <= 0) return
      ctx.globalAlpha = Math.min(0.5, flash / 12)
      ctx.fillStyle = flashColor
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = 1
    },
    reset() {
      parts = []
      nums = []
      shake = 0
      flash = 0
    },
  }
}
