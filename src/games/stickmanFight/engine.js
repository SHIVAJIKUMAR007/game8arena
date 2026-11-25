// The running fight: fixed-step loop, keyboard and touch input, the AI, sound and effects. It owns the canvas and
// talks to React only through onUi(snapshot) and onEnd(result), so the React layer is just menus, HUD and overlays.
// All rules live in sim.js; this file only feeds it inputs and turns its events into sound and particles.
import { vibrate } from '../../platform/haptics'
import { createRng } from '../../platform/rng'
import { prefersReducedMotion } from '../../platform/settings'
import { createAI } from './ai'
import { EFFECTS, H, W, WEAPONS, byId } from './data'
import { sfx, unlockAudio } from './audio'
import { burst, createFx, ring, shake, text, updateFx } from './fx'
import { createBackground, drawBanner, drawScene, weaponTip } from './render'
import { DT, MATCH_TIME, createMatch, step } from './sim'

export const KEYS = {
  p1: { left: ['KeyA'], right: ['KeyD'], jump: ['KeyW'], block: ['KeyS'], attack: ['KeyF'], special: ['KeyG'] },
  p2: { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'], block: ['ArrowDown'], attack: ['KeyK'], special: ['KeyL'] },
  // in single player one person has both hands free, so either layout works for player 1
  solo: {
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], jump: ['KeyW', 'ArrowUp', 'Space'], block: ['KeyS', 'ArrowDown', 'ShiftLeft'],
    attack: ['KeyF', 'KeyJ', 'KeyK', 'KeyZ'], special: ['KeyG', 'KeyL', 'KeyE', 'KeyX'],
  },
}
const ALL_KEYS = new Set(Object.values(KEYS).flatMap(l => Object.values(l).flat()))
const ACTIONS = ['left', 'right', 'jump', 'block', 'attack', 'special']

const COUNT_STEPS = ['3', '2', '1', 'FIGHT!']
const COUNT_LEN = 0.62
const INTRO = COUNT_LEN * 3 // the fight starts when "FIGHT!" appears
const OVER_DELAY = 1.7
const rnd = (a, b) => a + Math.random() * (b - a)
const SPECIAL_SFX = { wave: 'wave', volley: 'volley', shield: 'shield', lightning: 'lightning', smash: 'smash', spin: 'spin', dash: 'dash' }

/**
 * @param {{
 *   canvas: HTMLCanvasElement,
 *   config: { mode: 'single'|'versus', arenaId: string, variant: number, fighters: object[], skill?: number, seed?: string },
 *   onUi: (s: object) => void,
 *   onEnd: (r: object) => void,
 * }} opts
 */
export function createEngine({ canvas, config, onUi, onEnd }) {
  const ctx = canvas.getContext('2d') // null in test environments: the rules still run, nothing is drawn
  const solo = config.mode === 'single'
  let m
  let ai = null
  let fx
  let s = 1
  let bg = null
  let raf = 0
  let last = 0
  let acc = 0
  let time = 0
  let introT = 0
  let overT = 0
  let lastCount = -1
  let paused = false
  let alive = true
  let ended = false
  let started = false
  let uiAt = 0
  const held = new Set()
  const touch = [{}, {}]
  const calm = prefersReducedMotion()

  function load() {
    m = createMatch({ arenaId: config.arenaId, variant: config.variant, fighters: config.fighters })
    ai = solo ? createAI(config.skill ?? 0.3, createRng(`${config.seed || 'ai'}:${Math.random()}`)) : null
    fx = createFx()
    fx.trailColor = ['#fff', '#fff']
    acc = 0
    time = 0
    introT = 0
    overT = 0
    lastCount = -1
    ended = false
    started = false
    emit(true)
  }

  // ───────────── input ─────────────
  const down = codes => codes.some(c => held.has(c))
  function inputFor(player) {
    const layout = solo ? KEYS.solo : player === 0 ? KEYS.p1 : KEYS.p2
    const inp = {}
    for (const a of ACTIONS) inp[a] = down(layout[a]) || Boolean(touch[player][a])
    return inp
  }

  /** Returns true if the key was one the game uses (so the page should not scroll or click). */
  function key(code, isDown) {
    if (!ALL_KEYS.has(code) && code !== 'Escape' && code !== 'KeyP') return false
    if (isDown) {
      unlockAudio()
      if (code === 'Escape' || code === 'KeyP') {
        if (!ended) setPause(!paused)
        return true
      }
      held.add(code)
    } else held.delete(code)
    return true
  }
  const setTouch = (player, action, on) => {
    unlockAudio()
    touch[player][action] = on
  }
  const releaseAll = () => {
    held.clear()
    touch[0] = {}
    touch[1] = {}
  }

  // ───────────── events → sound and effects ─────────────
  const fighterEffect = id => byId(EFFECTS, m.fighters[id]?.effect) || EFFECTS[0]
  const sparkColors = ['#fff7b0', '#ffd34a', '#ffffff', '#ff9a2e']

  function handle(e) {
    switch (e.type) {
      case 'swing':
        sfx('swing', WEAPONS[e.weapon].damage >= 15)
        break
      case 'shoot':
        sfx('shoot')
        break
      case 'hit': {
        sfx('hit', e.heavy)
        sfx('hurt')
        burst(fx, e.x, e.y, e.heavy ? 22 : 12, { color: sparkColors, speed: e.heavy ? 560 : 380, life: 0.45, size: 4, dir: e.dir, spread: 2.2, shape: 'spark' })
        burst(fx, e.x, e.y, 5, { color: '#ffffff', speed: 120, life: 0.3, size: 5, g: 0 })
        ring(fx, e.x, e.y, e.heavy ? 70 : 44, '#fff', 0.28, 5)
        text(fx, e.x, e.y - 40, String(Math.round(e.dmg)), e.heavy ? '#ffcf3a' : '#ffffff', e.heavy ? 38 : 28)
        if (!calm) shake(fx, e.heavy ? 0.7 : 0.28)
        vibrate(e.heavy ? 28 : 12)
        break
      }
      case 'block':
        sfx('block')
        burst(fx, e.x, e.y, 10, { color: ['#bfe9ff', '#ffffff'], speed: 340, life: 0.3, size: 3, shape: 'spark', dir: -m.fighters[e.id].face, spread: 1.6 })
        ring(fx, e.x, e.y, 34, '#bfe9ff', 0.2, 4)
        text(fx, e.x, e.y - 34, 'BLOCK', '#bfe9ff', 20)
        break
      case 'guardbreak':
        sfx('guardbreak')
        burst(fx, e.x, e.y, 18, { color: ['#bfe9ff', '#ffffff', '#6fb8ff'], speed: 480, life: 0.5, size: 4, shape: 'spark' })
        text(fx, e.x, e.y - 50, 'GUARD BREAK!', '#ff9a9a', 26)
        if (!calm) shake(fx, 0.5)
        break
      case 'wall':
        sfx('wall')
        burst(fx, e.x, e.y, 4, { color: '#ddd', speed: 160, life: 0.25, size: 2, shape: 'spark' })
        break
      case 'jump':
      case 'djump':
        sfx(e.type)
        burst(fx, e.x, e.y, e.type === 'djump' ? 8 : 5, { color: 'rgba(255,255,255,0.7)', speed: 110, life: 0.35, size: 5, g: -20, spread: 2.8, shape: 'smoke' })
        if (e.type === 'djump') ring(fx, e.x, e.y + 4, 26, '#fff', 0.25, 3)
        break
      case 'land':
        sfx('land', e.power)
        burst(fx, e.x, e.y, 4 + Math.round(e.power * 6), { color: 'rgba(255,255,255,0.7)', speed: 160, life: 0.35, size: 5, g: -10, spread: 3, shape: 'smoke' })
        break
      case 'special': {
        sfx(SPECIAL_SFX[e.kind] || 'wave')
        const eff = fighterEffect(e.id)
        ring(fx, e.x, e.y, 80, eff.aura === 'rainbow' ? '#ff6bd6' : eff.trail, 0.4, 6)
        if (e.kind === 'shield') ring(fx, e.x, e.y, 90, '#bfe9ff', 0.5, 8)
        break
      }
      case 'spin':
        sfx('spin')
        break
      case 'shock':
        sfx('shock')
        ring(fx, e.x, e.y - 4, e.radius, '#ffe29a', 0.45, 10)
        ring(fx, e.x, e.y - 4, e.radius * 0.6, '#ffffff', 0.35, 6)
        burst(fx, e.x, e.y, 26, { color: ['#d9c7a8', '#ffffff', '#b59a6b'], speed: 520, life: 0.6, size: 7, g: 700, spread: Math.PI, shape: 'smoke' })
        if (!calm) shake(fx, 0.9)
        vibrate([20, 20, 30])
        break
      case 'bolt':
        sfx('bolt')
        fx.flash = calm ? 0 : 0.7
        fx.flashColor = '#fffbd0'
        burst(fx, e.x, 440, 24, { color: ['#fff25c', '#ffffff'], speed: 520, life: 0.5, size: 4, shape: 'spark', spread: Math.PI })
        if (!calm) shake(fx, 0.8)
        break
      case 'shield':
        sfx('block')
        ring(fx, e.x, e.y, 60, '#bfe9ff', 0.25, 4)
        text(fx, e.x, e.y - 40, 'IMMUNE', '#bfe9ff', 18)
        break
      case 'out': {
        const lava = e.kind === 'lava'
        sfx('out', lava)
        burst(fx, e.x, e.y, 26, { color: lava ? ['#ff9a1a', '#ffe14a', '#ff4a1a'] : ['#ffffff', '#cfe9ff'], speed: 620, life: 0.8, size: 6, spread: Math.PI * 0.9, g: 1400 })
        text(fx, e.x, Math.min(e.y, H - 140), `-${e.dmg}`, '#ff6b6b', 40)
        if (!calm) shake(fx, 0.7)
        vibrate([30, 30, 60])
        break
      }
      case 'respawn':
        sfx('respawn')
        ring(fx, e.x, e.y - 40, 70, '#ffffff', 0.5, 6)
        burst(fx, e.x, e.y - 40, 14, { color: ['#fff', '#bfe9ff'], speed: 260, life: 0.6, size: 4, g: -80, shape: 'spark' })
        break
      case 'ko':
        sfx('ko')
        burst(fx, e.x, e.y, 40, { color: sparkColors, speed: 760, life: 0.9, size: 6, shape: 'spark' })
        ring(fx, e.x, e.y, 130, '#fff', 0.55, 10)
        fx.flash = calm ? 0 : 0.8
        fx.flashColor = '#ffffff'
        if (!calm) shake(fx, 1)
        vibrate([40, 30, 80])
        break
      case 'timeup':
        text(fx, W / 2, 200, "TIME'S UP", '#fff', 60)
        break
      default:
    }
  }

  function ambient(dt) {
    for (const f of m.fighters) {
      const eff = byId(EFFECTS, f.effect)
      if (!eff || !eff.aura || f.state === 'dead' || calm) continue
      if (Math.random() > dt * 36) continue
      const x = f.x + rnd(-16, 16)
      const y = f.y - rnd(8, 84)
      if (f.effect === 'fire') burst(fx, x, y, 1, { color: ['#ff5a1f', '#ff9a2e', '#ffd34a'], speed: 60, life: 0.6, size: 5, g: -260, shape: 'dot' })
      else if (f.effect === 'ice') burst(fx, x, y, 1, { color: ['#ffffff', '#bfe9ff'], speed: 40, life: 0.9, size: 3.5, g: 60 })
      else if (f.effect === 'electric') burst(fx, x, y, 1, { color: '#fff25c', speed: 260, life: 0.18, size: 3, g: 0, shape: 'spark' })
      else if (f.effect === 'shadow') burst(fx, x, y, 1, { color: 'rgba(60,40,100,0.7)', speed: 40, life: 0.8, size: 7, g: -60, shape: 'smoke' })
      else burst(fx, x, y, 1, { color: `hsl(${Math.floor(time * 240 + Math.random() * 120) % 360} 95% 60%)`, speed: 70, life: 0.7, size: 4, g: -120 })
    }
  }

  function trails() {
    m.fighters.forEach((f, i) => {
      const eff = byId(EFFECTS, f.effect) || EFFECTS[0]
      fx.trailColor[i] = eff.trail
      const swinging = f.state === 'attack' || (f.state === 'spec' && ['wave', 'dash', 'spin'].includes(f.spec?.def.kind))
      if (!swinging || calm) return
      const tips = weaponTip(f)
      if (!tips) return
      const tip = tips.length > 1 && f.atk?.hand === 1 ? tips[1] : tips[0]
      fx.trails[i].push({ x: tip.x, y: tip.y, age: 0 })
      if (tips.length > 1 && f.spec) fx.trails[i].push({ x: tips[1].x, y: tips[1].y, age: 0 })
    })
  }

  // ───────────── UI snapshot ─────────────
  function snapshot() {
    return {
      phase: introT < INTRO ? 'intro' : m.status === 'over' ? 'over' : 'fight',
      paused,
      timeLeft: Math.max(0, Math.ceil(MATCH_TIME - m.t)),
      mode: config.mode,
      players: m.fighters.map(f => ({
        id: f.id,
        name: f.name,
        hp: Math.max(0, f.hp),
        hpMax: f.hpMax,
        cd: f.cdSpec,
        cdMax: WEAPONS[f.weapon].special.cd,
        special: WEAPONS[f.weapon].special.name,
        guard: f.guard,
        color: f.color,
        weapon: f.weapon,
        shield: f.shield > 0,
        isAI: f.isAI,
      })),
    }
  }
  function emit(force = false) {
    const now = performance.now()
    if (!force && now - uiAt < 90) return
    uiAt = now
    onUi(snapshot())
  }

  // ───────────── loop ─────────────
  function stepOnce() {
    const p0 = inputFor(0)
    const p1 = solo ? ai.think(m, 1, DT) : inputFor(1)
    step(m, [p0, p1], DT)
    for (const e of m.events) handle(e)
    m.events.length = 0
    trails()
  }

  function update(dtReal) {
    time += dtReal
    if (introT < INTRO) {
      introT += dtReal
      const idx = Math.min(3, Math.floor(introT / COUNT_LEN))
      if (idx !== lastCount) {
        lastCount = idx
        sfx('count')
      }
      if (introT >= INTRO && !started) {
        started = true
        sfx('fight')
      }
      updateFx(fx, dtReal)
      emit(true)
      return
    }
    if (introT < INTRO + 1) introT += dtReal // keeps counting so the "FIGHT!" banner can fade out
    const over = m.status === 'over'
    const scale = over && overT < 1.2 ? 0.35 : 1 // slow motion on the knockout
    acc += dtReal * scale
    let n = 0
    while (acc >= DT && n++ < 6) {
      stepOnce()
      acc -= DT
    }
    ambient(dtReal)
    updateFx(fx, dtReal * scale)
    if (over) {
      overT += dtReal
      if (overT >= OVER_DELAY && !ended) {
        ended = true
        const [a, b] = m.fighters
        onEnd({ winner: m.winner, reason: m.reason, hp: [a.hp, b.hp], hpMax: [a.hpMax, b.hpMax], time: m.t, stats: [a.stats, b.stats] })
        emit(true)
      }
    }
    emit()
  }

  function draw() {
    if (!ctx) return
    drawScene(ctx, m, fx, { s, bg, time })
    if (introT < INTRO + 0.55) {
      const t = introT / COUNT_LEN
      const idx = Math.min(3, Math.floor(t))
      const k = idx === 3 ? Math.min(1, (introT - INTRO) / 0.55) : t - idx
      drawBanner(ctx, s, COUNT_STEPS[idx], k, idx === 3 ? '#ffe14a' : '#ffffff')
    }
  }

  function frame(now) {
    if (!alive) return
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.1, (now - (last || now)) / 1000)
    last = now
    if (!paused) update(dt)
    draw()
  }

  // ───────────── controls ─────────────
  function setPause(on) {
    if (ended || (m.status === 'over' && overT > 0)) return
    paused = on
    if (on) releaseAll()
    emit(true)
  }

  function resize(cssW, cssH, dpr = 1) {
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
    canvas.width = Math.max(1, Math.round(cssW * dpr))
    canvas.height = Math.max(1, Math.round(cssH * dpr))
    s = canvas.width / W
    if (ctx) bg = createBackground(m.arena, s)
  }

  load()
  return {
    key,
    setTouch,
    releaseAll,
    resize,
    pause: setPause,
    restart() {
      paused = false
      load()
      if (ctx && s) bg = createBackground(m.arena, s)
    },
    start() {
      last = 0
      raf = requestAnimationFrame(frame)
    },
    destroy() {
      alive = false
      cancelAnimationFrame(raf)
    },
    /** Test hook: run the loop without a browser frame clock. */
    _tick(dt = DT) {
      if (!paused) update(dt)
    },
    get match() {
      return m
    },
    get isPaused() {
      return paused
    },
  }
}

