import { useEffect, useRef } from 'react'
import { unlockAudio } from './audio'

const COLORS = ['#4dabf7', '#51cf66', '#ffd43b', '#ff922b', '#cc5de8', '#22b8cf', '#f783ac', '#94d82d']
const VIEW = 620 // world units shown across the shorter side of the screen
const RADIUS = 14
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/**
 * The playing field: draws the latest snapshot from the server on a canvas and sends the player's input back.
 * Keyboard: WASD or arrows move, mouse aims, click or Space fires. Touch: the stick moves, tapping aims and fires.
 */
export default function Arena({ game, snapRef, shotsRef, send }) {
  const canvasRef = useRef(null)
  const stickRef = useRef(null)
  const knobRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d') // null in test environments: input still works, nothing is drawn
    const fog = document.createElement('canvas')
    const fctx = fog.getContext('2d')
    const color = {}
    game.players.forEach((p, i) => { color[p.id] = COLORS[i % COLORS.length] })
    const names = Object.fromEntries(game.players.map(p => [p.id, p.name]))
    const { world, walls } = game
    const shown = new Map()
    const keys = new Set()
    const stick = { x: 0, y: 0 }
    let pointer = null
    let fireSeq = 0
    let aim = 0
    let meScreen = { x: 0, y: 0 }
    let sent = ''
    let sentAt = 0
    let w = 0
    let h = 0
    let dpr = 1
    let raf = 0
    let last = performance.now()

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = Math.max(1, Math.floor(r.width))
      h = Math.max(1, Math.floor(r.height))
      canvas.width = fog.width = Math.floor(w * dpr)
      canvas.height = fog.height = Math.floor(h * dpr)
    }
    resize()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    ro?.observe(canvas)

    const ease = (id, x, y, dt) => {
      let p = shown.get(id)
      if (!p || Math.hypot(p.x - x, p.y - y) > 150) {
        p = { x, y }
        shown.set(id, p)
      }
      const k = 1 - Math.exp(-dt * 20)
      p.x += (x - p.x) * k
      p.y += (y - p.y) * k
      return p
    }

    const person = (x, y, id, { alive = true, me = false, aimAt = 0 } = {}) => {
      const mafia = id === game.mafiaId
      ctx.save()
      ctx.translate(x, y)
      ctx.fillStyle = 'rgba(0,0,0,.28)'
      ctx.beginPath()
      ctx.ellipse(3, 6, RADIUS, RADIUS * 0.7, 0, 0, Math.PI * 2)
      ctx.fill()
      if (!alive) {
        ctx.fillStyle = '#8a8f98'
        ctx.beginPath()
        ctx.arc(0, 0, RADIUS, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#2b2e33'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(-6, -6); ctx.lineTo(6, 6); ctx.moveTo(6, -6); ctx.lineTo(-6, 6)
        ctx.stroke()
      } else {
        if (mafia) {
          ctx.save()
          ctx.rotate(aimAt)
          ctx.fillStyle = '#222'
          ctx.fillRect(RADIUS - 4, -3, 20, 6)
          ctx.restore()
        }
        ctx.fillStyle = mafia ? '#d63031' : color[id] || '#fff'
        ctx.strokeStyle = me ? '#fff' : mafia ? '#5c0a0a' : 'rgba(0,0,0,.45)'
        ctx.lineWidth = me ? 3.5 : 2.5
        ctx.beginPath()
        ctx.arc(0, 0, RADIUS, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(-4, -3, 2.6, 0, Math.PI * 2)
        ctx.arc(4, -3, 2.6, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#111'
        ctx.beginPath()
        ctx.arc(-3.4, -3, 1.2, 0, Math.PI * 2)
        ctx.arc(4.6, -3, 1.2, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.font = '700 12px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(0,0,0,.65)'
      ctx.strokeText(names[id] || '', 0, -RADIUS - 6)
      ctx.fillStyle = mafia ? '#ff8a8a' : '#fff'
      ctx.fillText(names[id] || '', 0, -RADIUS - 6)
      ctx.restore()
    }

    const draw = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const snap = snapRef.current
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = '#16301c'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      if (!snap) return
      const me = ease('__me', snap.me.x, snap.me.y, dt)
      const scale = Math.min(w, h) / VIEW
      const vw = w / scale
      const vh = h / scale
      const camX = vw >= world.w ? world.w / 2 : clamp(me.x, vw / 2, world.w - vw / 2)
      const camY = vh >= world.h ? world.h / 2 : clamp(me.y, vh / 2, world.h - vh / 2)
      meScreen = { x: w / 2 + (me.x - camX) * scale, y: h / 2 + (me.y - camY) * scale }
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (w / 2 - camX * scale), dpr * (h / 2 - camY * scale))

      // floor
      ctx.fillStyle = '#3f8f3a'
      ctx.fillRect(0, 0, world.w, world.h)
      ctx.strokeStyle = 'rgba(255,255,255,.07)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 0; x <= world.w; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, world.h) }
      for (let y = 0; y <= world.h; y += 60) { ctx.moveTo(0, y); ctx.lineTo(world.w, y) }
      ctx.stroke()
      ctx.strokeStyle = '#5b3a1a'
      ctx.lineWidth = 8
      ctx.strokeRect(0, 0, world.w, world.h)

      // people (under the walls' tops so they can duck behind them), then walls
      for (const o of snap.others) {
        const p = ease(o.id, o.x, o.y, dt)
        person(p.x, p.y, o.id, { alive: o.alive, aimAt: o.aim || 0 })
      }
      if (snap.me.alive) person(me.x, me.y, game.you, { me: true, aimAt: aim })
      else person(me.x, me.y, game.you, { alive: false, me: true })
      for (const wall of walls) {
        ctx.fillStyle = 'rgba(0,0,0,.35)'
        ctx.fillRect(wall.x + 6, wall.y + 8, wall.w, wall.h)
        ctx.fillStyle = '#7a4b22'
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h)
        ctx.fillStyle = '#b07a40'
        ctx.fillRect(wall.x + 4, wall.y + 4, wall.w - 8, Math.max(4, wall.h - 14))
        ctx.strokeStyle = '#3d2410'
        ctx.lineWidth = 2
        ctx.strokeRect(wall.x, wall.y, wall.w, wall.h)
      }

      // shots
      shotsRef.current = shotsRef.current.filter(s => now - s.t < 260)
      for (const s of shotsRef.current) {
        ctx.strokeStyle = `rgba(255,236,140,${1 - (now - s.t) / 260})`
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(s.x1, s.y1)
        ctx.lineTo(s.x2, s.y2)
        ctx.stroke()
      }
      if (snap.me.role === 'mafia' && snap.me.cooldown > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,.85)'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(me.x, me.y, RADIUS + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - snap.me.cooldown / 0.8))
        ctx.stroke()
      }

      // fog of war: everything outside the circle you can see is dark
      if (snap.me.alive && fctx) {
        const r = (snap.me.blind ? 46 : snap.me.vision) * scale * dpr
        const cx = meScreen.x * dpr
        const cy = meScreen.y * dpr
        fctx.globalCompositeOperation = 'source-over'
        fctx.clearRect(0, 0, fog.width, fog.height)
        fctx.fillStyle = 'rgba(3,9,14,.88)'
        fctx.fillRect(0, 0, fog.width, fog.height)
        fctx.globalCompositeOperation = 'destination-out'
        const g = fctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r)
        g.addColorStop(0, 'rgba(0,0,0,1)')
        g.addColorStop(1, 'rgba(0,0,0,0)')
        fctx.fillStyle = g
        fctx.fillRect(0, 0, fog.width, fog.height)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.drawImage(fog, 0, 0)
      }

      // minimap: the whole arena in the corner, so a big map is easy to find your way around
      const mw = Math.min(150, w * 0.32)
      const k = mw / world.w
      const mx = w - mw - 8
      const my = 8
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = 'rgba(4,10,8,.62)'
      ctx.fillRect(mx - 2, my - 2, mw + 4, world.h * k + 4)
      ctx.fillStyle = 'rgba(176,122,64,.9)'
      for (const wall of walls) ctx.fillRect(mx + wall.x * k, my + wall.y * k, Math.max(1.5, wall.w * k), Math.max(1.5, wall.h * k))
      ctx.strokeStyle = 'rgba(255,255,255,.55)'
      ctx.lineWidth = 1
      ctx.strokeRect(mx + (camX - Math.min(vw, world.w) / 2) * k, my + (camY - Math.min(vh, world.h) / 2) * k, Math.min(vw, world.w) * k, Math.min(vh, world.h) * k)
      for (const o of snap.others) {
        ctx.fillStyle = o.id === game.mafiaId ? '#ff4d4d' : color[o.id] || '#fff'
        ctx.fillRect(mx + o.x * k - 2, my + o.y * k - 2, 4, 4)
      }
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(mx + me.x * k, my + me.y * k, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    const frame = (now) => {
      if (ctx) draw(now)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const vector = () => {
      let dx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0)
      let dy = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0)
      if (!dx && !dy) {
        dx = stick.x
        dy = stick.y
      }
      return { dx, dy }
    }
    const push = (force) => {
      const { dx, dy } = vector()
      if (pointer) aim = Math.atan2(pointer.y - meScreen.y, pointer.x - meScreen.x)
      else if (dx || dy) aim = Math.atan2(dy, dx)
      const msg = { t: 'input', dx: +dx.toFixed(2), dy: +dy.toFixed(2), aim: +aim.toFixed(2), fire: fireSeq }
      const key = `${msg.dx}|${msg.dy}|${msg.aim}|${msg.fire}`
      const now = performance.now()
      if (force || key !== sent || now - sentAt > 250) {
        send(msg)
        sent = key
        sentAt = now
      }
    }
    const timer = setInterval(() => push(false), 50)

    const typing = e => /^(input|textarea|select)$/i.test(e.target?.tagName || '')
    const onKeyDown = e => {
      if (typing(e)) return
      const k = e.key.toLowerCase()
      if (k === ' ') {
        e.preventDefault()
        if (!e.repeat) {
          fireSeq++
          unlockAudio()
          push(true)
        }
      } else if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        e.preventDefault()
        keys.add(k)
      }
    }
    const onKeyUp = e => keys.delete(e.key.toLowerCase())
    const onBlur = () => keys.clear()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    const at = e => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const onMove = e => { pointer = at(e) }
    const onDown = e => {
      pointer = at(e)
      fireSeq++
      unlockAudio()
      push(true)
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onDown)

    // On-screen stick for touch screens.
    const pad = stickRef.current
    const knob = knobRef.current
    let stickId = null
    const moveStick = e => {
      const r = pad.getBoundingClientRect()
      const radius = r.width / 2
      let dx = (e.clientX - (r.left + radius)) / radius
      let dy = (e.clientY - (r.top + radius)) / radius
      const len = Math.hypot(dx, dy)
      if (len > 1) { dx /= len; dy /= len }
      stick.x = Math.abs(dx) < 0.12 ? 0 : dx
      stick.y = Math.abs(dy) < 0.12 ? 0 : dy
      knob.style.transform = `translate(${dx * radius * 0.5}px, ${dy * radius * 0.5}px)`
    }
    const endStick = () => {
      stickId = null
      stick.x = stick.y = 0
      knob.style.transform = ''
    }
    const padDown = e => {
      e.stopPropagation()
      stickId = e.pointerId
      pad.setPointerCapture?.(e.pointerId)
      moveStick(e)
    }
    const padMove = e => stickId === e.pointerId && moveStick(e)
    const padUp = e => stickId === e.pointerId && endStick()
    pad.addEventListener('pointerdown', padDown)
    pad.addEventListener('pointermove', padMove)
    pad.addEventListener('pointerup', padUp)
    pad.addEventListener('pointercancel', padUp)

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(timer)
      ro?.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onDown)
      pad.removeEventListener('pointerdown', padDown)
      pad.removeEventListener('pointermove', padMove)
      pad.removeEventListener('pointerup', padUp)
      pad.removeEventListener('pointercancel', padUp)
      send({ t: 'input', dx: 0, dy: 0, aim, fire: fireSeq })
    }
  }, [game, send, snapRef, shotsRef])

  return (
    <div className="hs-arena">
      <canvas ref={canvasRef} className="hs-canvas" role="application" aria-label="Mafia Hunt arena. Move with WASD or the arrow keys, aim with the mouse, click or press Space to shoot." />
      <div className="hs-stick" ref={stickRef} aria-hidden="true">
        <div className="hs-knob" ref={knobRef} />
      </div>
    </div>
  )
}
