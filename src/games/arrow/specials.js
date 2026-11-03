// Special arrows: a registry, so adding a new kind is ONE entry here (+ a CSS class for its look).
//
// A special arrow is a normal arrow (same blocking rules, still solvable) with a `special: '<type>'` tag.
//   minLevel          first level the kind can appear on
//   count(level)      how many of them a level gets
//   className         CSS class on the arrow (see ArrowGame.css)
//   label             screen-reader / tooltip name
//   onLaunch(ctx)     runs when the player launches it successfully; returns effects for the board to apply.
//                     ctx = { arrow, arrows, cols, rows, level, rng }  (arrows = all arrows still on board)
//   Effects: { type: 'launch', ids: [...], message } — launch these arrows (they must be free to go).
//
// Levels only get specials in campaign mode; the choice is seeded, so every player sees the same board.
import { createRng } from '../../platform/rng'
import { findBlocker } from './levelGenerator'

// Arrows that can leave right now with a single tap.
export function freeArrows(arrows, cols, rows) {
  return arrows.filter(a => a.status === 'idle' && !findBlocker(a, arrows, cols, rows))
}

export const SPECIALS = {
  rainbow: {
    minLevel: 21, // unlocked after level 20
    count: level => (level >= 40 ? 2 : 1),
    className: 'sp-rainbow',
    label: 'rainbow special arrow',
    bonus: level => Math.min(6, 3 + Math.floor((level - 21) / 10)), // arrows it sends out with it
    onLaunch({ arrow, arrows, cols, rows, level, rng }) {
      // Only plain arrows that are free right now; removing free arrows can't block each other.
      const pool = freeArrows(arrows, cols, rows).filter(a => a.id !== arrow.id && !a.special)
      const ids = rng.shuffle([...pool]).slice(0, this.bonus(level)).map(a => a.id)
      if (!ids.length) return []
      return [{ type: 'launch', ids, message: `Rainbow! ${ids.length} more arrow${ids.length > 1 ? 's' : ''} flew out.` }]
    },
  },
  // Future kinds go here, e.g.:
  // bomb: { minLevel: 30, count: () => 1, className: 'sp-bomb', label: 'bomb arrow', onLaunch(ctx) { ... } },
}

export const specialOf = arrow => (arrow.special ? SPECIALS[arrow.special] : null)

// Tags some arrows of a freshly generated level as special. Deterministic per seed.
export function assignSpecials(arrows, { level, mode, seed }) {
  if (mode === 'daily' || !arrows.length) return arrows
  const rng = createRng(`${seed}:special`)
  const tagged = new Map()
  for (const [type, def] of Object.entries(SPECIALS)) {
    if (level < def.minLevel) continue
    // Prefer arrows that aren't trivially exposed? Any arrow works; keep it simple and untagged-only.
    const pool = arrows.filter(a => !tagged.has(a.id))
    for (let i = 0; i < def.count(level) && pool.length; i++) {
      const [pick] = pool.splice(Math.floor(rng.next() * pool.length), 1)
      tagged.set(pick.id, type)
    }
  }
  return arrows.map(a => (tagged.has(a.id) ? { ...a, special: tagged.get(a.id) } : a))
}
