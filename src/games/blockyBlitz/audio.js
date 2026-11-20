// Blocky Blitz sound effects, built on the shared synth helpers (platform/synth.js).
import { createSfx, tone } from '../../platform/synth'

export { unlockAudio } from '../../platform/synth'

export const sfx = createSfx({
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
})
