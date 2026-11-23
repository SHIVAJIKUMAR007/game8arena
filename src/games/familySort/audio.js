// Family Sort sound effects and a gentle looping tune, synthesised with Web Audio via the shared helpers
// (platform/synth.js), so there are no audio files and the global sound toggle and volume are honoured.
import { createSfx, tone, unlockAudio } from '../../platform/synth'
import { settingsStore } from '../../platform/settings'

export { unlockAudio }

export const sfx = createSfx({
  select: (c, v) => tone(c, v, 520, 0.08, { type: 'triangle', gain: 0.2 }),
  deselect: (c, v) => tone(c, v, 380, 0.08, { type: 'triangle', gain: 0.16 }),
  // liquid glugging: a few quick falling notes
  pour: (c, v) => [0, 1, 2, 3].forEach(i => tone(c, v, 700 - i * 60, 0.09, { type: 'sine', gain: 0.18, delay: i * 0.07, slideTo: 420 - i * 30 })),
  blocked: (c, v) => tone(c, v, 190, 0.2, { type: 'sawtooth', slideTo: 100, gain: 0.16 }),
  done: (c, v) => [784, 988, 1319].forEach((f, i) => tone(c, v, f, 0.18, { type: 'triangle', delay: i * 0.08, gain: 0.2 })),
  undo: (c, v) => tone(c, v, 600, 0.14, { type: 'triangle', slideTo: 300, gain: 0.18 }),
  hint: (c, v) => [660, 880].forEach((f, i) => tone(c, v, f, 0.12, { delay: i * 0.1, gain: 0.2 })),
  coin: (c, v) => [988, 1319].forEach((f, i) => tone(c, v, f, 0.1, { type: 'square', gain: 0.1, delay: i * 0.07 })),
  win: (c, v) => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(c, v, f, 0.26, { type: 'triangle', delay: i * 0.1, gain: 0.24 })),
})

const MELODY = [0, 4, 7, 12, 7, 4, 9, 12, 9, 7, 4, 2] // semitone steps above middle C
let timer = null
let step = 0

/** Starts the soft tune. Safe to call twice. Quiet by design: it sits under the effects. */
export function startMusic() {
  if (timer || typeof window === 'undefined') return
  timer = setInterval(() => {
    const s = settingsStore.get()
    if (!s.sound) return
    const c = unlockAudio()
    if (!c) return
    const freq = 261.63 * Math.pow(2, MELODY[step++ % MELODY.length] / 12)
    tone(c, s.volume, freq, 0.9, { type: 'sine', gain: 0.07 })
  }, 650)
}

export function stopMusic() {
  if (timer) clearInterval(timer)
  timer = null
}
