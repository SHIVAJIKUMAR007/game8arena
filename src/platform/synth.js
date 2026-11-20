// Shared Web Audio helpers for games that synthesise their own effects (no audio files to ship).
// A game defines a table of sounds and calls createSfx(table); the shared sound toggle and volume are honoured.
import { settingsStore } from './settings'

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

/** One enveloped oscillator note. */
export function tone(c, vol, freq, dur, { type = 'sine', gain = 0.25, delay = 0, slideTo } = {}) {
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

/**
 * @param {Record<string, (c: AudioContext, volume: number, arg?: any) => void>} sounds
 * @returns {(name: string, arg?: any) => void}
 */
export function createSfx(sounds) {
  return (name, arg) => {
    const s = settingsStore.get()
    if (!s.sound || !sounds[name]) return
    try {
      const c = unlockAudio()
      if (c) sounds[name](c, s.volume, arg)
    } catch {
      /* audio is best-effort */
    }
  }
}
