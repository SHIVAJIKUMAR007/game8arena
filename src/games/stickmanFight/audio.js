// Stickman Fight sound: synthesised effects (no audio files to ship) and a looping background track. Both honour
// the shared sound toggle and volume in platform/settings.js; the music also has its own on/off in the game save.
import { settingsStore } from '../../platform/settings'
import { createSfx, tone, unlockAudio } from '../../platform/synth'

export { unlockAudio }

let noiseBuf = null
/** A burst of filtered noise: the body of swishes, thuds and crashes. */
function noise(c, vol, dur, { freq = 1200, q = 1, type = 'bandpass', gain = 0.3, delay = 0, slideTo } = {}) {
  if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const t0 = c.currentTime + delay
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const f = c.createBiquadFilter()
  f.type = type
  f.Q.value = q
  f.frequency.setValueAtTime(freq, t0)
  if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * vol), t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(f).connect(g).connect(c.destination)
  src.start(t0)
  src.stop(t0 + dur + 0.03)
}

export const sfx = createSfx({
  click: (c, v) => tone(c, v, 620, 0.06, { type: 'triangle', gain: 0.18 }),
  back: (c, v) => tone(c, v, 420, 0.08, { type: 'triangle', slideTo: 300, gain: 0.18 }),
  buy: (c, v) => [660, 880, 1320].forEach((f, i) => tone(c, v, f, 0.12, { type: 'triangle', delay: i * 0.07, gain: 0.2 })),
  deny: (c, v) => tone(c, v, 160, 0.18, { type: 'sawtooth', slideTo: 100, gain: 0.18 }),
  coin: (c, v) => {
    tone(c, v, 988, 0.08, { type: 'square', gain: 0.12 })
    tone(c, v, 1319, 0.18, { type: 'square', gain: 0.12, delay: 0.07 })
  },
  // weapons
  swing: (c, v, heavy) => noise(c, v, heavy ? 0.26 : 0.16, { freq: heavy ? 500 : 900, slideTo: heavy ? 1600 : 3200, q: 0.8, gain: heavy ? 0.34 : 0.26 }),
  shoot: (c, v) => {
    tone(c, v, 220, 0.12, { type: 'triangle', slideTo: 90, gain: 0.2 })
    noise(c, v, 0.12, { freq: 2400, slideTo: 800, q: 1.2, gain: 0.16 })
  },
  hit: (c, v, heavy) => {
    tone(c, v, heavy ? 110 : 160, 0.14, { type: 'sine', slideTo: 50, gain: heavy ? 0.5 : 0.38 })
    noise(c, v, heavy ? 0.16 : 0.09, { freq: heavy ? 900 : 1700, q: 0.7, gain: heavy ? 0.4 : 0.28 })
  },
  block: (c, v) => {
    tone(c, v, 1500, 0.12, { type: 'square', slideTo: 900, gain: 0.12 })
    noise(c, v, 0.08, { freq: 3500, q: 2, gain: 0.2 })
  },
  guardbreak: (c, v) => {
    noise(c, v, 0.3, { freq: 2200, slideTo: 300, gain: 0.35 })
    tone(c, v, 300, 0.3, { type: 'sawtooth', slideTo: 80, gain: 0.25 })
  },
  wall: (c, v) => noise(c, v, 0.06, { freq: 1200, q: 1, gain: 0.14 }),
  // movement
  jump: (c, v) => tone(c, v, 300, 0.14, { type: 'triangle', slideTo: 620, gain: 0.16 }),
  djump: (c, v) => tone(c, v, 420, 0.14, { type: 'triangle', slideTo: 820, gain: 0.16 }),
  land: (c, v, power = 0.4) => noise(c, v, 0.08 + power * 0.08, { freq: 300, type: 'lowpass', gain: 0.2 + power * 0.25 }),
  // specials
  wave: (c, v) => {
    tone(c, v, 260, 0.35, { type: 'sawtooth', slideTo: 900, gain: 0.2 })
    noise(c, v, 0.3, { freq: 600, slideTo: 3000, gain: 0.2 })
  },
  volley: (c, v) => [0, 0.04, 0.08].forEach(d => noise(c, v, 0.12, { freq: 2600, slideTo: 800, delay: d, gain: 0.15 })),
  shield: (c, v) => [440, 660, 880].forEach((f, i) => tone(c, v, f, 0.4, { type: 'sine', delay: i * 0.05, gain: 0.16 })),
  lightning: (c, v) => tone(c, v, 900, 0.3, { type: 'sine', slideTo: 300, gain: 0.12 }),
  bolt: (c, v) => {
    noise(c, v, 0.5, { freq: 3000, slideTo: 200, q: 0.5, gain: 0.55 })
    tone(c, v, 90, 0.5, { type: 'sawtooth', slideTo: 30, gain: 0.35 })
  },
  smash: (c, v) => {
    tone(c, v, 130, 0.2, { type: 'triangle', slideTo: 400, gain: 0.2 })
  },
  shock: (c, v) => {
    noise(c, v, 0.5, { freq: 400, type: 'lowpass', slideTo: 80, gain: 0.7 })
    tone(c, v, 70, 0.5, { type: 'sine', slideTo: 28, gain: 0.5 })
  },
  spin: (c, v) => noise(c, v, 0.14, { freq: 1400, q: 1.5, gain: 0.18 }),
  dash: (c, v) => {
    noise(c, v, 0.3, { freq: 600, slideTo: 4200, q: 0.6, gain: 0.36 })
    tone(c, v, 200, 0.26, { type: 'sawtooth', slideTo: 700, gain: 0.14 })
  },
  // outcomes
  hurt: (c, v) => tone(c, v, 330, 0.18, { type: 'sawtooth', slideTo: 140, gain: 0.16 }),
  out: (c, v, lava) => {
    tone(c, v, 700, 0.6, { type: 'sine', slideTo: 90, gain: 0.25 })
    if (lava) noise(c, v, 0.6, { freq: 1500, slideTo: 200, gain: 0.3, delay: 0.3 })
  },
  respawn: (c, v) => [392, 523, 659].forEach((f, i) => tone(c, v, f, 0.18, { type: 'triangle', delay: i * 0.06, gain: 0.16 })),
  ko: (c, v) => {
    noise(c, v, 0.6, { freq: 700, slideTo: 100, gain: 0.5 })
    tone(c, v, 200, 0.7, { type: 'sawtooth', slideTo: 40, gain: 0.3 })
  },
  count: (c, v) => tone(c, v, 520, 0.12, { type: 'square', gain: 0.14 }),
  fight: (c, v) => [392, 523, 784].forEach((f, i) => tone(c, v, f, 0.22, { type: 'square', delay: i * 0.08, gain: 0.16 })),
  win: (c, v) => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, v, f, 0.26, { type: 'triangle', delay: i * 0.11, gain: 0.26 })),
  lose: (c, v) => [392, 349, 311, 233].forEach((f, i) => tone(c, v, f, 0.36, { type: 'triangle', delay: i * 0.2, gain: 0.26 })),
})

// ───────────── background music ─────────────
// A driving 8-bar loop in A minor: kick, hat, a bass line and a square-wave arpeggio. Notes are scheduled a little
// ahead of time from a timer, the standard way to keep Web Audio rhythm steady.
const BPM = 132
const STEP = 60 / BPM / 2 // eighth notes
const ROOTS = [110, 110, 87.31, 98] // A, A, F, G (bass)
const ARP = [
  [0, 3, 7, 12, 7, 3, 12, 7],
  [0, 3, 7, 12, 7, 3, 12, 7],
  [0, 4, 7, 12, 7, 4, 12, 7],
  [0, 4, 7, 11, 7, 4, 11, 7],
]
let timer = null
let ctx = null
let step = 0
let nextT = 0
let enabled = true

function schedule() {
  const c = ctx
  const s = settingsStore.get()
  if (!c || !s.sound || !enabled) {
    if (c) nextT = Math.max(nextT, c.currentTime + 0.05)
    return
  }
  const vol = s.volume * 0.45
  while (nextT < c.currentTime + 0.3) {
    const delay = Math.max(0, nextT - c.currentTime)
    const bar = Math.floor(step / 8) % 4
    const i = step % 8
    if (i % 4 === 0) tone(c, vol, 70, 0.16, { type: 'sine', slideTo: 38, gain: 0.7, delay })
    if (i % 2 === 1) noise(c, vol, 0.04, { freq: 7000, type: 'highpass', gain: 0.1, delay })
    const root = ROOTS[bar]
    if (i === 0 || i === 3 || i === 4 || i === 6) tone(c, vol, root, STEP * 1.6, { type: 'triangle', gain: 0.5, delay })
    tone(c, vol, root * 4 * Math.pow(2, ARP[bar][i] / 12), STEP * 0.9, { type: 'square', gain: 0.08, delay })
    step++
    nextT += STEP
  }
}

export const music = {
  start() {
    if (timer) return
    ctx = unlockAudio()
    if (!ctx) return
    nextT = ctx.currentTime + 0.08
    timer = setInterval(schedule, 90)
    schedule()
  },
  stop() {
    if (timer) clearInterval(timer)
    timer = null
  },
  setEnabled(on) {
    enabled = Boolean(on)
  },
  get playing() {
    return timer !== null
  },
}
