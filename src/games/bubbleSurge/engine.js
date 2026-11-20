// The running game: loop, input, effects and saving. It owns the canvas and talks to React only through
// onUi(snapshot), so the React layer is just the HUD and overlays. All rules live in logic.js / physics.js.
import { track } from '../../platform/analytics'
import { vibrate } from '../../platform/haptics'
import { updateProgress } from '../../platform/progress'
import { createRng } from '../../platform/rng'
import { prefersReducedMotion } from '../../platform/settings'
import { sfx, unlockAudio } from './audio'
import { CELL_X, CELL_Y, CX, CY, D, H, N, R, RING_R, W } from './hex'
import { EMPTY, PALETTE, clearedCount, newLevel, resolveShot, swapHand } from './logic'
import { makeShot, snapCell, stepShot, traceAim } from './physics'
import { createBackground, createFieldLayer, createSprites, drawAim, drawBubble, drawShooter, drawSparkle } from './render'
import { resetSurge, saveSurge } from './store'

export const GAME_ID = 'bubbles'
const STEP = 1 / 120
const AIM_KEY_STEP = (3 * Math.PI) / 180
const rnd = (a, b) => a + Math.random() * (b - a)

/**
 * @param {{ canvas: HTMLCanvasElement, onUi: (s: object) => void, initial: { level: number, score: number } }} opts
 */
export function createEngine({ canvas, onUi, initial }) {
  const ctx = canvas.getContext('2d') // null in test environments: the rules still run, nothing is drawn
  const timers = new Set()
  let s = 1 // device pixels per logical pixel
  let layers = null
  let fieldDirty = true
  let G = null
  let raf = 0
  let last = 0
  let acc = 0
  let paused = false
  let alive = true

  const later = (fn, ms) => {
    const t = setTimeout(() => {
      timers.delete(t)
      if (alive) fn()
    }, ms)
    timers.add(t)
  }

  // ───────────── state ─────────────
  function load(level, score, salt = Math.random().toString(36).slice(2, 8)) {
    timers.forEach(clearTimeout)
    timers.clear()
    const rng = createRng(`bubbles:${level}:${salt}`)
    G = {
      state: newLevel(level, rng, score),
      rng,
      salt,
      levelStartScore: score,
      shot: null,
      aim: G ? G.aim : -Math.PI / 2,
      fx: { pops: [], parts: [], falls: [], popups: [], blasts: [], shake: 0, pulse: 0 },
      dots: [],
      dotsDirty: true,
      reloadAt: 0,
      time: 0,
      twinkles: [],
      nextTwinkle: 0,
      overlay: null, // 'won' | 'over' once the animation has played
    }
    fieldDirty = true
    paused = false
    emit()
  }

  function snapshot() {
    const st = G.state
    return {
      level: st.level,
      score: st.score,
      meter: st.meter,
      cur: st.hand.cur,
      next: st.hand.next,
      status: st.status,
      overlay: G.overlay,
      paused,
      stars: st.stars,
      shots: st.shots,
      par: st.par,
      progress: Math.min(1, clearedCount(st) / st.goal),
      cleared: Math.max(0, clearedCount(st)),
      goal: st.goal,
      misses: st.misses,
      creepEvery: st.params.creepEvery,
    }
  }
  const emit = () => onUi(snapshot())

  // ───────────── layers ─────────────
  function resize(cssW, cssH, dpr = 1) {
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
    canvas.width = Math.max(1, Math.round(cssW * dpr))
    canvas.height = Math.max(1, Math.round(cssH * dpr))
    s = canvas.width / W
    if (ctx) {
      layers = { sprites: createSprites(Math.round(D * s)), bg: createBackground(s), field: null }
      fieldDirty = true
    }
  }

  // ───────────── actions ─────────────
  const playing = () => G.state.status === 'playing' && !paused && !G.overlay

  function fire() {
    if (!playing() || G.shot) return
    unlockAudio()
    G.shot = { ...makeShot(G.aim), bubble: G.state.hand.cur }
    sfx('shoot')
    vibrate(6)
  }

  function swap() {
    if (!playing() || G.shot) return
    unlockAudio()
    G.state = swapHand(G.state)
    sfx('tick')
    G.dotsDirty = true
    emit()
  }

  function setPause(on) {
    if (G.state.status !== 'playing' || G.overlay) return
    paused = on
    emit()
  }

  function popText(x, y, text, size = 34, color = '#fff') {
    G.fx.popups.push({ x, y, text, size, color, age: 0 })
  }

  // ───────────── a bubble lands ─────────────
  function land(shot) {
    const st = G.state
    const cell = snapCell(st.cells, shot.x, shot.y)
    G.shot = null
    if (cell < 0 || st.cells[cell] !== EMPTY) return
    const calm = prefersReducedMotion()
    const { state, events } = resolveShot(st, cell, shot.bubble, G.rng)
    G.state = state
    G.dotsDirty = true
    G.reloadAt = G.time
    fieldDirty = true
    sfx('stick')

    const lx = CELL_X[cell]
    const ly = CELL_Y[cell]
    const waveSpeed = 1700 // logical px per second: how fast the pop spreads from the impact
    const popped = events.popped
      .map(p => ({ ...p, delay: Math.hypot(CELL_X[p.i] - lx, CELL_Y[p.i] - ly) / waveSpeed }))
      .sort((a, b) => a.delay - b.delay)
    popped.forEach((p, k) => {
      G.fx.pops.push({ x: CELL_X[p.i], y: CELL_Y[p.i], v: p.v, t: calm ? 0.1 - 0.001 : -p.delay })
      if (k < 14) later(() => sfx('pop', k), p.delay * 1000)
    })
    events.dropped.forEach(d => {
      G.fx.falls.push({ x: CELL_X[d.i], y: CELL_Y[d.i], v: d.v, vx: rnd(-90, 90), vy: rnd(-260, -40), rot: 0, vr: rnd(-7, 7), age: 0, fade: 0, bounced: false })
    })
    if (events.dropped.length) later(() => sfx('drop'), 200)

    if (events.bombFired) {
      G.fx.blasts.push({ x: lx, y: ly, t: 0 })
      sfx('bomb')
      vibrate([30, 20, 50])
    } else if (popped.length) vibrate(12)

    const gain = events.points.total
    if (gain > 0) {
      let sx = 0
      let sy = 0
      const all = [...events.popped, ...events.dropped]
      all.forEach(p => {
        sx += CELL_X[p.i]
        sy += CELL_Y[p.i]
      })
      popText(sx / all.length, sy / all.length, `+${gain}`, 38, '#fff')
    }
    if (events.streak >= 2) popText(CX, CY - 120, `COMBO x${events.streak}`, 44, '#ffe14d')
    if (events.bombLoaded) {
      popText(CX, CY + 120, 'Bomb ready!', 34, '#ffd0a0')
      later(() => sfx('ready'), 250)
    }
    if (!calm && (events.popped.length + events.dropped.length >= 14 || events.streak >= 4 || events.bombFired)) G.fx.shake = 0.35
    if (events.creepAdded.length) {
      G.fx.pulse = 1
      if (!calm) G.fx.shake = Math.max(G.fx.shake, 0.25)
      sfx('creep')
      vibrate([20, 30, 20])
      popText(CX, CY - 120, 'The field creeps in!', 30, '#ffb3b3')
    }

    updateProgress(GAME_ID, p => (state.score > p.highScore ? { ...p, highScore: state.score } : p))

    if (state.status === 'won') {
      saveSurge(state.level + 1, state.score)
      updateProgress(GAME_ID, p => ({
        ...p,
        best: Math.max(p.best, state.level),
        level: Math.max(p.level, state.level + 1),
        highScore: Math.max(p.highScore, state.score),
        stars: { ...p.stars, [state.level]: Math.max(p.stars[state.level] || 0, state.stars) },
      }))
      track('bubbles_level_clear', { level: state.level, shots: state.shots, stars: state.stars })
      later(() => {
        G.overlay = 'won'
        sfx('levelComplete')
        vibrate([40, 30, 40, 30, 80])
        emit()
      }, 1000)
    } else if (state.status === 'over') {
      saveSurge(state.level, G.levelStartScore)
      track('bubbles_game_over', { level: state.level, score: state.score, shots: state.shots })
      later(() => {
        G.overlay = 'over'
        sfx('gameOver')
        vibrate([60, 40, 90])
        emit()
      }, 900)
    }
    emit()
  }

  // ───────────── simulation ─────────────
  function tick(dt) {
    G.time += dt
    if (G.shot) {
      const { shot, hit } = stepShot(G.state.cells, G.shot, dt)
      const flying = { ...shot, bubble: G.shot.bubble }
      if (hit >= 0 || shot.t > 4) land(flying)
      else G.shot = flying
    }
    const fx = G.fx
    for (let k = fx.pops.length - 1; k >= 0; k--) {
      const p = fx.pops[k]
      p.t += dt
      if (!p.burst && p.t >= 0.1) {
        p.burst = true
        if (!prefersReducedMotion() && fx.parts.length < 420) {
          const col = PALETTE[p.v - 1] || '#ffffff'
          for (let n = 0; n < 5; n++) {
            const a = rnd(0, Math.PI * 2)
            const sp = rnd(120, 360)
            fx.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, age: 0, life: rnd(0.35, 0.6), color: col, size: rnd(3, 6.5) })
          }
        }
      }
      if (p.t > 0.42) fx.pops.splice(k, 1)
    }
    for (let k = fx.parts.length - 1; k >= 0; k--) {
      const p = fx.parts[k]
      p.age += dt
      p.vy += 900 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.age > p.life) fx.parts.splice(k, 1)
    }
    for (let k = fx.falls.length - 1; k >= 0; k--) {
      const f = fx.falls[k]
      f.age += dt
      f.vy += 2600 * dt
      f.x += f.vx * dt
      f.y += f.vy * dt
      f.rot += f.vr * dt
      if (f.y > H - R - 10 && f.vy > 0) {
        f.y = H - R - 10
        f.vy = -f.vy * 0.35
        f.bounced = true
      }
      if (f.bounced) f.fade += dt
      if (f.fade > 0.45 || f.age > 3) fx.falls.splice(k, 1)
    }
    for (let k = fx.popups.length - 1; k >= 0; k--) {
      fx.popups[k].age += dt
      if (fx.popups[k].age > 1.1) fx.popups.splice(k, 1)
    }
    for (let k = fx.blasts.length - 1; k >= 0; k--) {
      fx.blasts[k].t += dt
      if (fx.blasts[k].t > 0.5) fx.blasts.splice(k, 1)
    }
    if (fx.shake > 0) fx.shake = Math.max(0, fx.shake - dt)
    if (fx.pulse > 0) fx.pulse = Math.max(0, fx.pulse - dt * 1.6)
  }

  // ───────────── drawing ─────────────
  function refreshTwinkles() {
    const cells = G.state.cells
    G.twinkles = []
    for (let n = 0; n < 9; n++) {
      for (let tries = 0; tries < 12; tries++) {
        const i = Math.floor(Math.random() * N)
        if (cells[i] !== EMPTY) {
          G.twinkles.push({ x: CELL_X[i] - R * 0.34, y: CELL_Y[i] - R * 0.4, start: G.time + Math.random() * 0.8 })
          break
        }
      }
    }
    G.nextTwinkle = G.time + 1.6
  }

  function draw() {
    if (!ctx || !layers) return
    const sprites = layers.sprites
    if (fieldDirty) {
      layers.field = createFieldLayer(G.state.cells, sprites, s)
      fieldDirty = false
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (G.fx.shake > 0) {
      const m = G.fx.shake * 26 * s
      ctx.translate(rnd(-m, m), rnd(-m, m))
    }
    ctx.drawImage(layers.bg, 0, 0)
    ctx.drawImage(layers.field, 0, 0)

    if (G.time > G.nextTwinkle && !paused) refreshTwinkles()
    for (const t of G.twinkles) {
      const k = (G.time - t.start) / 0.9
      if (k > 0 && k < 1) drawSparkle(ctx, s, t.x, t.y, R * 0.42 * Math.sin(k * Math.PI), 0.9)
    }

    const fx = G.fx
    for (const f of fx.falls) {
      ctx.save()
      ctx.translate(f.x * s, f.y * s)
      ctx.rotate(f.rot)
      drawBubble(ctx, sprites, f.v, 0, 0, s, 1, f.bounced ? Math.max(0, 1 - f.fade / 0.45) : 1)
      ctx.restore()
    }
    for (const p of fx.pops) {
      if (p.t < 0.1) drawBubble(ctx, sprites, p.v, p.x, p.y, s, p.t > 0 ? 1 + (p.t / 0.1) * 0.22 : 1)
      else {
        const k = (p.t - 0.1) / 0.32
        ctx.beginPath()
        ctx.arc(p.x * s, p.y * s, R * s * (0.9 + k * 1.1), 0, Math.PI * 2)
        ctx.lineWidth = Math.max(1, 5 * (1 - k) * s)
        ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`
        ctx.stroke()
      }
    }
    for (const b of fx.blasts) {
      const k = b.t / 0.5
      ctx.beginPath()
      ctx.arc(b.x * s, b.y * s, 3 * D * s * k, 0, Math.PI * 2)
      ctx.lineWidth = Math.max(1, 14 * (1 - k) * s)
      ctx.strokeStyle = `rgba(255,210,120,${1 - k})`
      ctx.stroke()
    }
    for (const p of fx.parts) {
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life)
      ctx.beginPath()
      ctx.arc(p.x * s, p.y * s, p.size * s, 0, Math.PI * 2)
      ctx.fillStyle = p.color
      ctx.fill()
    }
    ctx.globalAlpha = 1

    const st = G.state
    if (st.status === 'playing' && !G.shot && !paused && !G.overlay) {
      if (G.dotsDirty) {
        G.dots = traceAim(st.cells, G.aim, 2)
        G.dotsDirty = false
      }
      drawAim(ctx, s, G.dots)
    }

    // ring, warning arc and aim arrow
    const fill = st.params.creepEvery ? st.misses / st.params.creepEvery : 0
    drawShooter(ctx, s, G.aim, fill)
    if (fx.pulse > 0) {
      ctx.beginPath()
      ctx.arc(CX * s, CY * s, (RING_R + (1 - fx.pulse) * 260) * s, 0, Math.PI * 2)
      ctx.lineWidth = 8 * s * fx.pulse
      ctx.strokeStyle = `rgba(255,255,255,${fx.pulse})`
      ctx.stroke()
    }
    // the bubble waiting in the shooter slides up into place after a shot
    if (!G.shot && st.status !== 'over') {
      const k = Math.min(1, (G.time - G.reloadAt) / 0.14)
      drawBubble(ctx, sprites, st.hand.cur, CX, CY, s, 0.7 + 0.3 * k)
    }
    if (G.shot) drawBubble(ctx, sprites, G.shot.bubble, G.shot.x, G.shot.y, s)

    for (const p of fx.popups) {
      const k = p.age / 1.1
      ctx.save()
      ctx.scale(s, s)
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3
      ctx.font = `italic 900 ${p.size}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = 6
      ctx.strokeStyle = 'rgba(70, 10, 0, 0.7)'
      ctx.lineJoin = 'round'
      const y = p.y - k * 60
      ctx.strokeText(p.text, p.x, y)
      ctx.fillStyle = p.color
      ctx.fillText(p.text, p.x, y)
      ctx.restore()
    }
  }

  // ───────────── loop ─────────────
  function frame(now) {
    if (!alive) return
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (!paused) {
      acc += dt
      while (acc >= STEP) {
        tick(STEP)
        acc -= STEP
      }
    }
    draw()
    raf = requestAnimationFrame(frame)
  }

  // ───────────── input ─────────────
  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect()
    if (!rect.width) return { x: CX, y: CY }
    return { x: ((clientX - rect.left) * W) / rect.width, y: ((clientY - rect.top) * H) / rect.height }
  }

  function aimAt(clientX, clientY) {
    const { x, y } = toLogical(clientX, clientY)
    const dx = x - CX
    const dy = y - CY
    if (Math.hypot(dx, dy) > 16) {
      G.aim = Math.atan2(dy, dx)
      G.dotsDirty = true
    }
    return Math.hypot(dx, dy)
  }

  function onDown(clientX, clientY) {
    unlockAudio()
    if (playing()) aimAt(clientX, clientY)
  }
  function onMove(clientX, clientY) {
    if (playing()) aimAt(clientX, clientY)
  }
  function onUp(clientX, clientY) {
    if (!playing()) return
    const d = aimAt(clientX, clientY)
    if (d < RING_R + 4) swap()
    else fire()
  }

  /** @returns {boolean} true when the key was used */
  function onKey(key) {
    switch (key) {
      case 'ArrowLeft':
        G.aim -= AIM_KEY_STEP
        G.dotsDirty = true
        return true
      case 'ArrowRight':
        G.aim += AIM_KEY_STEP
        G.dotsDirty = true
        return true
      case 'ArrowUp':
      case 'Enter':
        fire()
        return true
      case ' ':
      case 'Spacebar':
        swap()
        return true
      case 'p':
      case 'P':
      case 'Escape':
        setPause(!paused)
        return true
      default:
        return false
    }
  }

  const onVisibility = () => {
    if (document.hidden) setPause(true)
  }

  // ───────────── public ─────────────
  load(initial.level, initial.score)
  document.addEventListener('visibilitychange', onVisibility)

  return {
    start() {
      last = performance.now()
      raf = requestAnimationFrame(frame)
    },
    destroy() {
      alive = false
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
      document.removeEventListener('visibilitychange', onVisibility)
    },
    resize,
    onDown,
    onMove,
    onUp,
    onKey,
    fire,
    swap,
    pause: setPause,
    nextLevel() {
      load(G.state.level + 1, G.state.score)
    },
    retry() {
      load(G.state.level, G.levelStartScore, G.salt)
    },
    newGame() {
      resetSurge()
      load(1, 0)
    },
    /** For tests and tools: the live state. */
    peek: () => G,
    snapshot: () => snapshot(),
  }
}
