// Liquid colours and small helpers shared by the bottle drawing and the game screen.
/** Liquid colours. Index = colour id from the engine. The glyph lets the optional symbol mode tell colours apart. */
export const LIQUIDS = [
  { name: 'red', c: '#e53935', glyph: '●' },
  { name: 'blue', c: '#1e6fe0', glyph: '▲' },
  { name: 'yellow', c: '#fdd835', glyph: '■' },
  { name: 'green', c: '#3fae4a', glyph: '◆' },
  { name: 'purple', c: '#8e44ad', glyph: '★' },
  { name: 'orange', c: '#fb8c00', glyph: '♥' },
  { name: 'pink', c: '#ee6fb4', glyph: '✚' },
  { name: 'cyan', c: '#22c1d6', glyph: '✿' },
  { name: 'brown', c: '#8d5a3b', glyph: '☾' },
  { name: 'grey', c: '#78909c', glyph: '⬟' },
]

export const liquid = id => LIQUIDS[id % LIQUIDS.length]

/** Splits a bottle into runs of one colour so neighbouring units of a colour read as a single column of liquid. */
export function runsOf(units) {
  const runs = []
  for (const c of units) {
    const last = runs[runs.length - 1]
    if (last && last.color === c) last.n++
    else runs.push({ color: c, n: 1 })
  }
  return runs
}

export const describeBottle = (units, index) =>
  `Bottle ${index + 1}: ${units.length ? `${units.map(c => liquid(c).name).join(', ')} from bottom to top` : 'empty'}`
