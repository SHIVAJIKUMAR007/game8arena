// Memory Sequence: pads, difficulty curve and deterministic sequences.
import { createRng } from '../../platform/rng'

// Each pad has a colour, a symbol (so colour is never the only cue) and a note on a pentatonic scale,
// so any run of notes sounds pleasant.
export const PADS = [
  { name: 'coral', symbol: '●', freq: 261.63 },
  { name: 'sky', symbol: '▲', freq: 329.63 },
  { name: 'lime', symbol: '■', freq: 392.0 },
  { name: 'amber', symbol: '★', freq: 523.25 },
  { name: 'violet', symbol: '◆', freq: 293.66 },
  { name: 'teal', symbol: '✚', freq: 440.0 },
  { name: 'pink', symbol: '♥', freq: 587.33 },
  { name: 'gold', symbol: '✦', freq: 659.25 },
  { name: 'slate', symbol: '⬢', freq: 783.99 },
]

/**
 * Difficulty curve.
 *   pads    4 → 6 → 9 pads to choose from
 *   start   sequence length of the first round; each round adds one step
 *   target  length to repeat to clear the level
 *   flash   ms each step stays lit during playback (faster as levels go up)
 *   shuffle from level 12 the pads swap places after every round
 */
export function paramsFor(level) {
  const L = Math.max(1, level)
  const target = Math.min(24, 4 + L)
  return {
    pads: L <= 3 ? 4 : L <= 8 ? 6 : 9,
    target,
    start: L === 1 ? 1 : Math.max(1, target - 5),
    flash: Math.max(190, 520 - L * 20),
    gap: Math.max(70, 170 - L * 6),
    shuffle: L >= 12,
  }
}

/** The level's full sequence (prefixes are the rounds). Never three of the same pad in a row. */
export function sequenceFor(seed, length, pads) {
  const rng = createRng(`${seed}|seq`)
  const seq = []
  while (seq.length < length) {
    const n = rng.int(0, pads - 1)
    const k = seq.length
    if (k >= 2 && seq[k - 1] === n && seq[k - 2] === n) continue
    seq.push(n)
  }
  return seq
}

/** Pad order on screen for a round: identity, or a fresh shuffle each round when `shuffle` is on. */
export function layoutFor(seed, round, pads, shuffle) {
  const order = Array.from({ length: pads }, (_, i) => i)
  return shuffle && round > 0 ? createRng(`${seed}|layout|${round}`).shuffle(order) : order
}

/** Grid columns for a pad count. */
export const columnsFor = pads => (pads === 4 ? 2 : 3)
