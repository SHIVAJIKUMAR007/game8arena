import Stars from './Stars'

// Level map: levels up to best+1 are playable; a few locked ones are shown ahead.
export default function LevelSelect({ best, stars, maxStars = 3, onPick, onBack }) {
  const count = Math.max(30, Math.ceil((best + 10) / 5) * 5)
  return (
    <div className="ls-root">
      <div className="ls-head">
        <button className="lg-btn ghost" onClick={onBack}>← Menu</button>
        <h2>Levels</h2>
        <span />
      </div>
      <div className="ls-grid">
        {Array.from({ length: count }, (_, i) => {
          const lvl = i + 1
          const locked = lvl > best + 1
          return (
            <button
              key={lvl}
              className={`ls-cell ${locked ? 'locked' : ''} ${lvl === best + 1 ? 'next' : ''}`}
              disabled={locked}
              onClick={() => onPick(lvl)}
              aria-label={locked ? `Level ${lvl}, locked` : `Level ${lvl}, ${stars[lvl] || 0} stars`}
            >
              <b>{locked ? '🔒' : lvl}</b>
              {!locked && <Stars value={stars[lvl] || 0} max={maxStars} size=".8em" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
