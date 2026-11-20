// Blocky Blitz sound effects, synthesised with the Web Audio API (no files to ship).
// Honours the shared sound setting and volume. The context is created on the first user gesture (unlockAudio).
import { settingsStore } from '../../platform/settings'

let ctx = null

/** Call from a pointer or key handler so the browser allows sound; safe to call repeatedly. */
export function unlockAudio() {
  try {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext
      if (!C) return null
      ctx = new C()
    }
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(c, vol, freq, dur, { type = 'sine', gain = 0.25, delay = 0, slideTo } = {}) {
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain * vol, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.03)
}

const SOUNDS = {
  // short soft pop when a piece lands
  place: (c, v) => tone(c, v, 420, 0.09, { type: 'triangle', slideTo: 220, gain: 0.3 }),
  // quick tick when a piece is picked up or stored
  pick: (c, v) => tone(c, v, 640, 0.05, { type: 'sine', gain: 0.15 }),
  // ascending arpeggio on a clear; each combo step raises the pitch
  clear: (c, v, combo = 1) => {
    const base = 392 * Math.pow(1.0595, Math.min(combo, 10) * 2)
    ;[1, 1.25, 1.5, 2].forEach((m, i) => tone(c, v, base * m, 0.16, { type: 'triangle', delay: i * 0.065, gain: 0.26 }))
  },
  // soft error blip for an invalid drop
  error: (c, v) => tone(c, v, 190, 0.14, { type: 'square', slideTo: 120, gain: 0.1 }),
  // fanfare on level up
  levelUp: (c, v) => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, v, f, 0.22, { type: 'triangle', delay: i * 0.09, gain: 0.26 })),
  // sad descending tone on game over
  gameOver: (c, v) => [392, 349, 311, 262].forEach((f, i) => tone(c, v, f, 0.34, { type: 'triangle', delay: i * 0.2, gain: 0.26 })),
}

export function sfx(name, arg) {
  const s = settingsStore.get()
  if (!s.sound || !SOUNDS[name]) return
  try {
    const c = unlockAudio()
    if (c) SOUNDS[name](c, s.volume, arg)
  } catch {
    /* audio is best-effort */
  }
}
