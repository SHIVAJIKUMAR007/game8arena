// Mafia Hunt sounds, synthesised with the shared Web Audio helpers.
import { createSfx, tone } from '../../platform/synth'

export { unlockAudio } from '../../platform/synth'

export const sfx = createSfx({
  shot: (c, v) => {
    tone(c, v, 220, 0.18, { type: 'sawtooth', slideTo: 50, gain: 0.3 })
    tone(c, v, 1400, 0.05, { type: 'square', slideTo: 300, gain: 0.12 })
  },
  start: (c, v) => [392, 523].forEach((f, i) => tone(c, v, f, 0.16, { type: 'triangle', delay: i * 0.12, gain: 0.22 })),
  hunt: (c, v) => [196, 185, 175].forEach((f, i) => tone(c, v, f, 0.3, { type: 'sawtooth', delay: i * 0.18, gain: 0.18 })),
  win: (c, v) => [523, 659, 784, 1047].forEach((f, i) => tone(c, v, f, 0.24, { type: 'triangle', delay: i * 0.1, gain: 0.24 })),
  lose: (c, v) => [392, 330, 262].forEach((f, i) => tone(c, v, f, 0.3, { type: 'triangle', delay: i * 0.16, gain: 0.22 })),
})
