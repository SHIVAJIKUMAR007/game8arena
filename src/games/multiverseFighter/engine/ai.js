// Computer opponent. think(match, index) returns an INPUT bitmask for the AI fighter each tick. It decides only
// every `react` ticks (a shorter reaction time at higher player levels), then holds that choice: approach, retreat,
// block, a random attack, a jump or the special. All randomness comes from a seeded generator, so a match replays
// the same way for the same seed and inputs.
import { createRng } from '../../../platform/rng'
import { ENERGY_MAX, INPUT } from './sim'

/** Reaction time in ticks for a player level (floor of 6 so the AI is never frame-perfect). */
export const reactionFor = level => Math.max(6, Math.round(28 - 2.2 * Math.max(1, level)))
export const blockChanceFor = level => Math.min(0.7, 0.18 + 0.04 * Math.max(1, level))

export function createAI({ level = 1, seed = 1 } = {}) {
  const rng = createRng((seed ^ 0x9e3779b9) >>> 0)
  const react = reactionFor(level)
  const blockChance = blockChanceFor(level)
  const aggression = Math.min(0.85, 0.45 + 0.03 * level)
  let cool = 0
  let held = 0
  let tap = 0
  let blockT = 0
  return {
    react,
    think(m, idx) {
      if (m.phase !== 'fight') return 0
      const me = m.fighters[idx]
      const o = m.fighters[1 - idx]
      const out = held | tap
      tap = 0
      if (blockT > 0) {
        blockT--
        return INPUT.DOWN
      }
      if (--cool > 0) return out
      cool = react + rng.int(0, 4)
      const dist = Math.abs(o.x - me.x)
      const toward = o.x > me.x ? INPUT.RIGHT : INPUT.LEFT
      const away = toward === INPUT.RIGHT ? INPUT.LEFT : INPUT.RIGHT
      held = 0
      if (me.en >= ENERGY_MAX && dist < 460 && rng.next() < 0.65) {
        tap = INPUT.SPECIAL
        return held | tap
      }
      const threat = (o.state === 'attack' || o.state === 'special') && dist < 210
      if (threat && rng.next() < blockChance) {
        blockT = rng.int(12, 24)
        return INPUT.DOWN
      }
      if (dist > 210) {
        held = toward
        const r = rng.next()
        if (r < 0.1 && dist < 460) tap = INPUT.FKICK
        else if (r < 0.16) held |= INPUT.UP
      } else if (rng.next() < aggression) {
        if (dist > 150) held = toward
        const r = rng.next()
        tap = r < 0.4 ? INPUT.PUNCH : r < 0.7 ? INPUT.KICK : r < 0.9 ? INPUT.HEAVY : INPUT.FKICK
      } else if (rng.next() < 0.5) {
        held = away
      }
      return held | tap
    },
  }
}
