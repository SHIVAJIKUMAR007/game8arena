import { forwardRef } from 'react'
import { describeBottle, liquid, runsOf } from './liquids'

/**
 * One glass bottle. It only draws what it is told: the game screen decides selection, pouring and animation.
 * `pourStyle` holds the CSS variables (--tx, --ty, --rot) that carry the bottle over the one it pours into.
 */
const Bottle = forwardRef(function Bottle(
  { index, units, capacity, selected, hint, shake, celebrate, pouring, receiving, streamColor, symbols, onSelect, pourStyle },
  ref,
) {
  const done = units.length === capacity && units.every(c => c === units[0])
  const cls = [
    'fs-bottle',
    selected && 'selected',
    hint && `hint-${hint}`,
    shake && 'shake',
    celebrate && 'celebrate',
    pouring && 'pouring',
    done && 'done',
  ].filter(Boolean).join(' ')
  return (
    <div className="fs-slot" ref={ref}>
      <button
        type="button"
        className={cls}
        style={pourStyle}
        aria-label={describeBottle(units, index)}
        aria-pressed={selected}
        data-index={index}
        onClick={() => onSelect(index)}
      >
        <span className="fs-lip" aria-hidden="true" />
        <span className="fs-body" aria-hidden="true">
          <span className="fs-liquid">
            {runsOf(units).map((r, i) => (
              <span key={`${i}-${r.color}`} className="fs-run" style={{ '--n': r.n, '--c': liquid(r.color).c }}>
                {symbols && Array.from({ length: r.n }, (_, k) => <span key={k} className="fs-glyph">{liquid(r.color).glyph}</span>)}
              </span>
            ))}
          </span>
          <span className="fs-shine" />
        </span>
        {receiving && (
          <span
            className="fs-stream"
            style={{ '--c': liquid(streamColor).c, '--drop': `${((capacity - units.length) / capacity) * 86 + 6}%` }}
          />
        )}
        {celebrate && <span className="fs-spark" aria-hidden="true">✨</span>}
      </button>
    </div>
  )
})

export default Bottle
