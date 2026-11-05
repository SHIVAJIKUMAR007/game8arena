// Synthesised sound effects (Web Audio) — no audio files to ship or license.
import { settingsStore } from './settings'

let ctx = null
function audio() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext
    if (!C) return null
    ctx = new C()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(c, vol, freq, dur, { type = 'sine', gain = 0.3, delay = 0, slideTo } = {}) {
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(gain * vol, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

const SOUNDS = {
  tap: (c, v) => tone(c, v, 520, 0.05),
  launch: (c, v) => tone(c, v, 320, 0.22, { type: 'triangle', slideTo: 1100 }),
  blocked: (c, v) => { tone(c, v, 180, 0.22, { type: 'sawtooth', gain: 0.22, slideTo: 90 }) },
  hint: (c, v) => { tone(c, v, 660, 0.12); tone(c, v, 880, 0.14, { delay: 0.1 }) },
  undo: (c, v) => tone(c, v, 600, 0.15, { type: 'triangle', slideTo: 300 }),
  combo: (c, v, n = 1) => tone(c, v, 440 * Math.pow(1.06, Math.min(n, 14)), 0.09, { type: 'triangle', gain: 0.18, delay: 0.12 }),
  note: (c, v, freq = 440) => { tone(c, v, freq, 0.32, { type: 'triangle', gain: 0.32 }); tone(c, v, freq * 2, 0.18, { gain: 0.05 }) },
  win: (c, v) => [523, 659, 784, 1047].forEach((f, i) => tone(c, v, f, 0.2, { delay: i * 0.11 })),
  lose: (c, v) => [392, 330, 262].forEach((f, i) => tone(c, v, f, 0.28, { type: 'triangle', delay: i * 0.16 })),
}

export function playSound(name, arg) {
  const s = settingsStore.get()
  if (!s.sound || !SOUNDS[name]) return
  try {
    const c = audio()
    if (c) SOUNDS[name](c, s.volume, arg)
  } catch { /* audio is best-effort */ }
}
