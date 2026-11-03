// Difficulty = how many arrows are on the board.
//   levels 1..28 : 6, 8, 10 … 60 arrows (+2 per level)
//   after that    : a random (but seeded, so identical for everyone) count between 30 and 100
//   daily         : a random count between 25 and 70, seeded by the date
import { createRng } from '../../platform/rng'

export const COUNT_CAP = 60

export function arrowCountFor(level, mode = 'campaign', seed = '') {
  if (mode === 'daily') return createRng(`${seed}:count`).int(25, 70)
  const linear = 4 + level * 2
  if (linear <= COUNT_CAP) return linear
  return createRng(`arrow:count:${level}`).int(30, 100)
}

// Average snake length also creeps up with level (3 → 6 cells).
export const avgLengthFor = level => 3 + Math.min(level, 30) * 0.1
