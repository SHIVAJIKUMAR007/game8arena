// Bubble Surge sound effects, synthesised with Web Audio via the shared helpers (platform/synth.js).
import { createSfx, tone } from '../../platform/synth'

export { unlockAudio } from '../../platform/synth'

export const sfx = createSfx({
  // whoosh as a bubble leaves the shooter
  shoot: (c, v) => tone(c, v, 260, 0.16, { type: 'triangle', slideTo: 880, gain: 0.16 }),
  // soft thud when it sticks
  stick: (c, v) => tone(c, v, 150, 0.1, { type: 'sine', slideTo: 70, gain: 0.3 }),
  // pop: pitch rises with every bubble in the chain
  pop: (c, v, step = 0) => tone(c, v, 440 * Math.pow(1.0595, Math.min(step, 16) * 1.5), 0.11, { type: 'sine', slideTo: 900, gain: 0.22 }),
  // a hanging bubble falling away
  drop: (c, v) => tone(c, v, 520, 0.2, { type: 'triangle', slideTo: 180, gain: 0.14 }),
  bomb: (c, v) => {
    tone(c, v, 180, 0.45, { type: 'sawtooth', slideTo: 38, gain: 0.3 })
    tone(c, v, 90, 0.5, { type: 'square', slideTo: 30, gain: 0.2 })
  },
  tick: (c, v) => tone(c, v, 640, 0.05, { type: 'sine', gain: 0.14 }),
  ready: (c, v) => [660, 880, 1320].forEach((f, i) => tone(c, v, f, 0.12, { type: 'triangle', delay: i * 0.07, gain: 0.2 })),
  // the field creeping in
  creep: (c, v) => tone(c, v, 110, 0.35, { type: 'sawtooth', slideTo: 70, gain: 0.2 }),
  levelComplete: (c, v) => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(c, v, f, 0.24, { type: 'triangle', delay: i * 0.1, gain: 0.26 })),
  gameOver: (c, v) => [392, 349, 311, 262].forEach((f, i) => tone(c, v, f, 0.34, { type: 'triangle', delay: i * 0.2, gain: 0.26 })),
})
