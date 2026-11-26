// Game loop for one fight. It owns the requestAnimationFrame loop, the 60Hz fixed-timestep accumulator, input,
// audio, effects and the canvas renderer, and it is the only thing the React fight screen talks to.
//
//   mode 'local'  the simulation and an AI opponent run here.
//   mode 'host'   the simulation runs here; the guest's input arrives over `net`, snapshots go back at 30Hz.
//   mode 'guest'  no simulation: send input every tick, interpolate host snapshots about 100ms behind, predict our
//                 own movement and reconcile it against the host's acknowledged state.
//
// React never sees per-frame state. HUD values are pushed through onHud at about 15Hz. `net` is the session from
// netcode.js; this module never imports PeerJS. start()/dispose() are safe under React StrictMode double-mounting.
import { createAI } from './ai'
import { createAudio } from './audio'
import { createFx } from './fx'
import { createInput } from './input'
import { createRenderer } from './render'
import { fighterById } from '../roster'
import { bannerOf, createMatch, locomote, snapshot, step, STEP_MS, viewFromSnapshot } from './sim'

const LOCO = new Set(['idle', 'walk', 'jump', 'block'])
const INTERP_MS = 100
const RECONNECT_MS = 10000
const HUD_MS = 66
const HOST_WAIT_MS = 5000
const END_FRAMES = 150

const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = t => (t < 0 ? 0 : t > 1 ? 1 : t)

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas
 * @param {'local'|'host'|'guest'} [o.mode]
 * @param {[string,string]} o.chars fighter ids, index 0 is the host (or the player in local mode)
 * @param {[object,object]} o.stats results of roster.statsFor for each fighter
 * @param {number} [o.seed]
 * @param {number} [o.level] player level, which sets AI reaction time
 * @param {0|1} [o.me] which fighter this screen controls
 * @param {object|null} [o.net] netcode session
 * @param {(hud: object) => void} [o.onHud]
 * @param {(result: object) => void} [o.onEnd]
 */
export function createGame({ canvas, mode = 'local', chars, stats, seed = 1, level = 1, me = 0, net = null, onHud, onEnd }) {
  const audio = createAudio()
  const fx = createFx()
  const renderer = createRenderer(canvas)
  const input = createInput({ onPause: () => api.togglePause(), onGesture: () => audio.resume() })
  const online = mode !== 'local'

  let running = false
  let disposed = false
  let ended = false
  let paused = false
  let raf = 0
  let last = 0
  let acc = 0
  let T = 0
  let lastHud = 0
  let unsubs = []
  let connLostAt = 0
  let prevStates = ['idle', 'idle']
  let lastPhaseKey = ''

  // Local and host state
  let m = null
  let ai = null
  let prev = [{ x: 0, y: 0 }, { x: 0, y: 0 }]
  let remoteMask = 0
  let remoteSeq = -1
  let remoteAt = 0
  let hostWaitUntil = 0
  let evBuf = []

  // Guest state
  const base = { chars, scales: chars.map(c => fighterById(c).scale), hpMax: stats.map(s => s.hpMax) }
  const buf = []
  const evq = []
  let off = null
  let latest = null
  let lastFr = -1
  let seq = 0
  const pending = []
  let pred = null

  if (mode !== 'guest') {
    m = createMatch({ seed, chars, stats })
    prev = m.fighters.map(f => ({ x: f.x, y: f.y }))
    if (mode === 'local') ai = createAI({ level, seed })
  }

  // ── events and cues ──
  const onSimEvent = e => {
    fx.onEvent(e)
    if (e.k === 'hit') audio.play(e.block ? 'block' : e.big ? 'heavy' : 'hit')
    else if (e.k === 'counter') audio.play('counter')
    else if (e.k === 'parry') audio.play('block')
    else if (e.k === 'special') audio.play('special')
    else if (e.k === 'bolt') audio.play('bolt')
    else if (e.k === 'ko' || e.k === 'timeup') audio.play('ko')
  }

  function observe(view) {
    view.fighters.forEach((f, i) => {
      if (f.state === 'attack' && prevStates[i] !== 'attack') audio.play('swing')
      prevStates[i] = f.state
    })
    const key = `${view.round}:${view.phase}`
    if (key !== lastPhaseKey) {
      lastPhaseKey = key
      if (view.phase === 'intro') audio.play('round')
      else if (view.phase === 'fight') audio.play('fight')
      else if (view.phase === 'matchEnd') audio.play(view.winner === me ? 'win' : 'lose')
    }
  }

  function finish(result) {
    if (ended || disposed) return
    ended = true
    onEnd?.(result)
  }

  // ── view construction ──
  function localView(alpha) {
    return {
      phase: m.phase, phaseT: m.phaseT, round: m.round, wins: m.wins, timer: m.timer, winner: m.winner,
      roundWinner: m.roundWinner, timeUp: m.timeUp, frame: m.frame,
      fighters: m.fighters.map((f, i) => ({ ...f, x: lerp(prev[i].x, f.x, alpha), y: lerp(prev[i].y, f.y, alpha) })),
      proj: m.proj, zones: m.zones,
    }
  }

  function guestView(now) {
    if (!buf.length) return null
    const rt = now - INTERP_MS
    let i = buf.length - 1
    let A = buf[i]
    let B = buf[i]
    if (rt < buf[i].t) {
      while (i > 0 && buf[i - 1].t > rt) i--
      if (i === 0) {
        A = buf[0]
        B = buf[0]
      } else {
        A = buf[i - 1]
        B = buf[i]
      }
    }
    const a = A === B ? 1 : clamp01((rt - A.t) / (B.t - A.t))
    const view = viewFromSnapshot(B.s, base)
    view.fighters.forEach((f, k) => {
      f.x = lerp(A.s.f[k].x, B.s.f[k].x, a)
      f.y = lerp(A.s.f[k].y, B.s.f[k].y, a)
    })
    if (pred && latest && latest.ph === 'fight' && LOCO.has(latest.f[me].s)) {
      const f = view.fighters[me]
      f.x = pred.x
      f.y = pred.y
      f.state = pred.state
      f.face = latest.f[me].fc
    }
    return view
  }

  function hudOf(view, now) {
    const f = view.fighters
    return {
      phase: view.phase,
      round: view.round,
      timer: Math.max(0, Math.ceil(view.timer / 60)),
      hp: [Math.round(f[0].hp), Math.round(f[1].hp)],
      hpMax: [f[0].hpMax, f[1].hpMax],
      en: [Math.round(f[0].en), Math.round(f[1].en)],
      wins: [...view.wins],
      combo: f[me].combo >= 2 ? f[me].combo : 0,
      banner: bannerOf(view, me),
      paused,
      ping: net ? net.getPing() : null,
      lost: connLostAt ? Math.max(0, Math.ceil((RECONNECT_MS - (now - connLostAt)) / 1000)) : 0,
      waiting: mode === 'host' && hostWaitUntil > 0 && remoteSeq < 0,
      me,
    }
  }

  // ── simulation ──
  function tickLocal() {
    prev = m.fighters.map(f => ({ x: f.x, y: f.y }))
    const now = performance.now()
    if (mode === 'host') {
      if (remoteSeq < 0 && now < hostWaitUntil) return
      if (connLostAt) return
      if (remoteSeq >= 0 && now - remoteAt > 400) remoteMask = 0
    }
    const in0 = input.mask()
    const in1 = mode === 'local' ? ai.think(m, 1) : remoteMask
    step(m, in0, in1)
    for (const e of m.events) onSimEvent(e)
    if (mode === 'host') evBuf.push(...m.events)
    m.events = []
    fx.tick()
    T++
    if (mode === 'host' && m.frame % 2 === 0) {
      const s = snapshot(m, remoteSeq)
      s.ev = evBuf
      evBuf = []
      net.sendSnapshot(s)
    }
    if (m.phase === 'matchEnd' && m.phaseT >= END_FRAMES) {
      const r = { winner: m.winner, wins: [...m.wins], me, reason: 'match', hp: m.fighters.map(f => f.hp) }
      if (mode === 'host') net.sendControl({ t: 'end', winner: m.winner, wins: r.wins })
      finish(r)
    }
  }

  function tickGuest() {
    seq++
    const mask = input.mask()
    net.sendInput(seq, mask)
    pending.push({ seq, mask })
    if (pending.length > 180) pending.shift()
    if (pred && latest && latest.ph === 'fight' && LOCO.has(pred.state)) locomote(pred, mask)
    fx.tick()
    T++
  }

  // ── guest: receiving ──
  function onSnapshotMsg(s) {
    if (!s || typeof s.fr !== 'number' || s.fr <= lastFr || !Array.isArray(s.f) || s.f.length < 2) return
    lastFr = s.fr
    const now = performance.now()
    const est = now - s.fr * STEP_MS
    off = off === null || est - off > 1000 ? est : est < off ? est : off + (est - off) * 0.02
    const t = off + s.fr * STEP_MS
    buf.push({ s, t })
    if (buf.length > 16) buf.shift()
    for (const e of s.ev || []) evq.push({ due: t + INTERP_MS, e })
    latest = s
    while (pending.length && pending[0].seq <= s.ack) pending.shift()
    const a = s.f[me]
    pred = { x: a.x, y: a.y, vx: a.vx || 0, vy: a.vy || 0, state: a.s, char: chars[me], walk: stats[me].walk, jump: stats[me].jump, hover: a.hv || 0 }
    if (s.ph === 'fight' && LOCO.has(a.s)) for (const p of pending) locomote(pred, p.mask)
    if (s.ph === 'matchEnd' && s.pt >= END_FRAMES) {
      finish({ winner: s.win, wins: [...s.w], me, reason: 'match', hp: s.f.map(f => f.hp) })
    }
  }

  // ── network wiring ──
  function wireNet() {
    if (!net) return
    unsubs.push(net.onStatus(s => {
      if (s.type === 'lost') connLostAt ||= performance.now()
      else if (s.type === 'back') connLostAt = 0
      else if (s.type === 'left') finish({ winner: me, wins: latest ? [...latest.w] : m ? [...m.wins] : [0, 0], me, reason: 'left', hp: [0, 0] })
    }))
    unsubs.push(net.onControl(msg => {
      if (msg?.t === 'end' && mode === 'guest') finish({ winner: msg.winner, wins: msg.wins || [0, 0], me, reason: 'match', hp: [0, 0] })
    }))
    if (mode === 'host') {
      unsubs.push(net.onInput(p => {
        if (typeof p?.seq !== 'number' || p.seq <= remoteSeq) return
        remoteSeq = p.seq
        remoteMask = p.mask | 0
        remoteAt = performance.now()
      }))
    } else if (mode === 'guest') {
      unsubs.push(net.onSnapshot(onSnapshotMsg))
    }
  }

  // ── frame ──
  function frame(now) {
    if (!running) return
    raf = requestAnimationFrame(frame)
    const dt = Math.min(100, now - last)
    last = now
    if (connLostAt && now - connLostAt > RECONNECT_MS) {
      finish({ winner: me, wins: latest ? [...latest.w] : m ? [...m.wins] : [0, 0], me, reason: 'disconnect', hp: [0, 0] })
    }
    if (!paused && !ended) {
      const slow = mode === 'local' && m.phase === 'ko' && m.phaseT < 90 ? 0.3 : 1
      acc += dt * slow
      let n = 0
      while (acc >= STEP_MS && n++ < 8) {
        if (mode === 'guest') tickGuest()
        else tickLocal()
        acc -= STEP_MS
      }
      if (n >= 8) acc = 0
    }
    let view
    if (mode === 'guest') {
      while (evq.length && evq[0].due <= now) onSimEvent(evq.shift().e)
      view = guestView(now)
    } else {
      view = localView(acc / STEP_MS)
    }
    if (!view) return
    observe(view)
    let zoom = 1
    if (view.phase === 'ko' && view.phaseT < 130) zoom = 1 + 0.06 * clamp01(view.phaseT / 15) * clamp01((130 - view.phaseT) / 25)
    renderer.draw(view, T, fx, zoom)
    if (onHud && now - lastHud >= HUD_MS) {
      lastHud = now
      onHud(hudOf(mode === 'guest' && latest ? { ...view, wins: latest.w, timer: latest.tm, phase: latest.ph, phaseT: latest.pt } : view, now))
    }
  }

  const api = {
    start() {
      if (running || disposed) return
      running = true
      last = performance.now()
      acc = 0
      if (mode === 'host') hostWaitUntil = last + HOST_WAIT_MS
      wireNet()
      audio.resume()
      raf = requestAnimationFrame(frame)
    },
    stop() {
      running = false
      cancelAnimationFrame(raf)
    },
    dispose() {
      if (disposed) return
      api.stop()
      disposed = true
      unsubs.forEach(u => u())
      unsubs = []
      input.dispose()
      audio.dispose()
      renderer.dispose()
    },
    pause() {
      if (online || ended) return
      paused = true
      input.clear()
      onHud?.(hudOf(localView(0), performance.now()))
    },
    resume() {
      if (!paused) return
      paused = false
      last = performance.now()
      acc = 0
    },
    togglePause() {
      if (paused) api.resume()
      else api.pause()
    },
    isPaused: () => paused,
    setTouch: (bit, on) => input.setTouch(bit, on),
    /** Test hook: how many ticks have run. */
    get tick() {
      return T
    },
  }
  return api
}
