// Generated "pixel board" cover: a grid of cells in the accent colour, patterned from a seed so every game
// (and every blog post) gets its own look without shipping an image. Decorative; the label lives elsewhere.
const COLS = 12
const ROWS = 6

function cells(seed) {
  let h = 2166136261
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const out = []
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      h = Math.imul(h ^ (h >>> 15), 2246822507) + 374761393
      const r = ((h >>> 0) % 1000) / 1000
      // Fade toward the right edge so the emoji sits on a calm area.
      const fade = 1 - (x / COLS) * 0.55
      if (r > 0.42) out.push({ x, y, o: Math.min(0.9, (0.12 + r * 0.55) * fade) })
    }
  }
  return out
}

export default function GameArt({ seed, color, emoji, className = '' }) {
  return (
    <div className={`gart ${className}`} style={{ '--accent': color }} aria-hidden="true">
      <svg viewBox={`0 0 ${COLS * 10} ${ROWS * 10}`} preserveAspectRatio="xMidYMid slice">
        {cells(seed).map(c => (
          <rect key={`${c.x}-${c.y}`} x={c.x * 10 + 1} y={c.y * 10 + 1} width="8" height="8" rx="1.5" fill="var(--accent)" opacity={c.o} />
        ))}
      </svg>
      <span className="gart-emoji">{emoji}</span>
    </div>
  )
}
