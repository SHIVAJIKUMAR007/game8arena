// Sound for the fight: effects synthesised with Web Audio, so there are no files to ship. Each game owns one
// AudioContext. It is created on the first user gesture (resume() is called from the first key or pointer event),
// honours the shared sound toggle and volume from platform/settings, and is closed by dispose().
import { settingsStore } from '../../../platform/settings'
import { tone } from '../../../platform/synth'

function noise(c, vol, dur, { freq = 1200, slideTo, gain = 0.3, delay = 0, q = 0.8 } = {}) {
  const t0 = c.currentTime + delay
  const len = Math.max(1, Math.floor(c.sampleRate * dur))
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = q
  f.frequency.setValueAtTime(freq, t0)
  if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(Math.max(0.0002, gain * vol), t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(f).connect(g).connect(c.destination)
  src.start(t0)
}

const SOUNDS = {
  swing: (c, v) => noise(c, v, 0.12, { freq: 900, slideTo: 2600, gain: 0.12 }),
  hit: (c, v) => { tone(c, v, 140, 0.12, { type: 'square', slideTo: 60, gain: 0.3 }); noise(c, v, 0.1, { freq: 1800, gain: 0.25 }) },
  heavy: (c, v) => { tone(c, v, 90, 0.22, { type: 'sawtooth', slideTo: 40, gain: 0.4 }); noise(c, v, 0.18, { freq: 900, gain: 0.35 }) },
  block: (c, v) => { tone(c, v, 520, 0.08, { type: 'triangle', slideTo: 300, gain: 0.2 }); noise(c, v, 0.05, { freq: 4000, gain: 0.12 }) },
  special: (c, v) => { tone(c, v, 300, 0.4, { type: 'sawtooth', slideTo: 1200, gain: 0.2 }); tone(c, v, 600, 0.4, { gain: 0.1, slideTo: 1800 }) },
  bolt: (c, v) => { noise(c, v, 0.4, { freq: 2400, slideTo: 200, gain: 0.5, q: 0.4 }); tone(c, v, 70, 0.4, { type: 'sawtooth', gain: 0.3 }) },
  counter: (c, v) => { tone(c, v, 880, 0.18, { type: 'triangle', gain: 0.25 }); tone(c, v, 1320, 0.22, { type: 'triangle', gain: 0.2, delay: 0.06 }) },
  ko: (c, v) => { tone(c, v, 220, 0.9, { type: 'sawtooth', slideTo: 40, gain: 0.35 }); noise(c, v, 0.5, { freq: 600, slideTo: 100, gain: 0.4 }) },
  round: (c, v) => [440, 440].forEach((f, i) => tone(c, v, f, 0.18, { type: 'square', gain: 0.12, delay: i * 0.2 })),
  fight: (c, v) => tone(c, v, 880, 0.35, { type: 'square', gain: 0.14 }),
  win: (c, v) => [523, 659, 784, 1047].forEach((f, i) => tone(c, v, f, 0.2, { type: 'triangle', delay: i * 0.11 })),
  lose: (c, v) => [392, 330, 262].forEach((f, i) => tone(c, v, f, 0.28, { type: 'triangle', delay: i * 0.16 })),
  click: (c, v) => tone(c, v, 620, 0.06, { type: 'triangle', gain: 0.16 }),
  coin: (c, v) => { tone(c, v, 988, 0.08, { type: 'square', gain: 0.1 }); tone(c, v, 1319, 0.16, { type: 'square', gain: 0.1, delay: 0.07 }) },
}

export function createAudio() {
  let ctx = null
  let closed = false
  const ensure = () => {
    if (closed) return null
    try {
      if (!ctx) {
        const C = window.AudioContext || window.webkitAudioContext
        if (!C) return null
        ctx = new C()
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
      return ctx
    } catch {
      return null
    }
  }
  return {
    /** Call from a key or pointer handler so the browser allows sound. Safe to call repeatedly. */
    resume: ensure,
    play(name) {
      const s = settingsStore.get()
      if (!s.sound || !SOUNDS[name]) return
      const c = ensure()
      if (!c) return
      try { SOUNDS[name](c, s.volume) } catch { /* audio is best-effort */ }
    },
    dispose() {
      closed = true
      const c = ctx
      ctx = null
      c?.close?.().catch(() => {})
    },
  }
}
