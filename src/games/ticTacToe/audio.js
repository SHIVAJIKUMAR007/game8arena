// Tic Tac Toe sounds, synthesised with the shared Web Audio helpers.
import { createSfx, tone } from '../../platform/synth'

export { unlockAudio } from '../../platform/synth'

export const sfx = createSfx({
  place: (c, v) => tone(c, v, 520, 0.08, { type: 'triangle', gain: 0.2 }),
  turn: (c, v) => [660, 880].forEach((f, i) => tone(c, v, f, 0.1, { type: 'triangle', delay: i * 0.09, gain: 0.2 })),
  win: (c, v) => [523, 659, 784, 1047].forEach((f, i) => tone(c, v, f, 0.22, { type: 'triangle', delay: i * 0.1, gain: 0.24 })),
  lose: (c, v) => [392, 330, 262].forEach((f, i) => tone(c, v, f, 0.28, { type: 'triangle', delay: i * 0.15, gain: 0.2 })),
  draw: (c, v) => [440, 440].forEach((f, i) => tone(c, v, f, 0.18, { type: 'sine', delay: i * 0.16, gain: 0.18 })),
})
