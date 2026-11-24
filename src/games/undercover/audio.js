// Undercover sounds, synthesised with the shared Web Audio helpers.
import { createSfx, tone } from '../../platform/synth'

export { unlockAudio } from '../../platform/synth'

export const sfx = createSfx({
  turn: (c, v) => [660, 880].forEach((f, i) => tone(c, v, f, 0.12, { type: 'triangle', delay: i * 0.1, gain: 0.22 })),
  vote: (c, v) => tone(c, v, 330, 0.25, { type: 'square', gain: 0.1 }),
  out: (c, v) => [440, 330, 247].forEach((f, i) => tone(c, v, f, 0.22, { type: 'sawtooth', delay: i * 0.14, gain: 0.14 })),
  win: (c, v) => [523, 659, 784, 1047].forEach((f, i) => tone(c, v, f, 0.24, { type: 'triangle', delay: i * 0.1, gain: 0.24 })),
  lose: (c, v) => [392, 330, 262].forEach((f, i) => tone(c, v, f, 0.3, { type: 'triangle', delay: i * 0.16, gain: 0.22 })),
})
