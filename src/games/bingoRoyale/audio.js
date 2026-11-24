// Bingo Royale sounds, synthesised with the shared Web Audio helpers.
import { createSfx, tone } from '../../platform/synth'

export { unlockAudio } from '../../platform/synth'

export const sfx = createSfx({
  call: (c, v) => [440, 660].forEach((f, i) => tone(c, v, f, 0.14, { type: 'triangle', delay: i * 0.08, gain: 0.22 })),
  mark: (c, v) => tone(c, v, 880, 0.06, { type: 'sine', gain: 0.14 }),
  line: (c, v) => [523, 659, 784].forEach((f, i) => tone(c, v, f, 0.16, { type: 'triangle', delay: i * 0.08, gain: 0.24 })),
  turn: (c, v) => [660, 880].forEach((f, i) => tone(c, v, f, 0.1, { type: 'triangle', delay: i * 0.09, gain: 0.2 })),
  win: (c, v) => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, v, f, 0.22, { type: 'triangle', delay: i * 0.1, gain: 0.24 })),
  lose: (c, v) => [392, 330, 262].forEach((f, i) => tone(c, v, f, 0.28, { type: 'triangle', delay: i * 0.15, gain: 0.2 })),
})
