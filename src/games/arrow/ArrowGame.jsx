import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { DIRS, generateLevel, findBlocker, pathPoints } from './levelGenerator'
import './ArrowGame.css'

const MAX_LIVES = 3
const SHAKE_MS = 400

const toStr = pts => pts.map(p => p.join(',')).join(' ')

// Part of a polyline between arc-lengths a and b.
function slicePath(pts, a, b) {
  const out = []
  let acc = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]
    const len = Math.hypot(x2 - x1, y2 - y1)
    const s = acc, e = acc + len
    if (len > 0 && e > a && s < b) {
      const t0 = (Math.max(a, s) - s) / len, t1 = (Math.min(b, e) - s) / len
      if (!out.length) out.push([x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0])
      out.push([x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1])
    }
    acc = e
  }
  return out
}

// Line + arrowhead, drawn in board (cell) units.
function Shape({ points, dir }) {
  if (points.length < 2) return null
  const [hx, hy] = points[points.length - 1]
  const { dx, dy } = DIRS[dir]
  const px = -dy, py = dx
  const head = [
    [hx + dx * 0.4, hy + dy * 0.4],
    [hx - dx * 0.02 + px * 0.26, hy - dy * 0.02 + py * 0.3],
    [hx - dx * 0.02 - px * 0.26, hy - dy * 0.02 - py * 0.3],
  ]
  return (
    <>
      <polyline className="ag-line" points={toStr(points)} />
      <polygon className="ag-head" points={toStr(head)} />
    </>
  )
}

// The arrow slides along its own path, then straight off the board.
function Flying({ arrow, size, onDone }) {
  const { pts, bodyLen, ext } = useMemo(() => {
    const body = pathPoints(arrow)
    const bodyLen = body.slice(1).reduce((t, p, i) => t + Math.hypot(p[0] - body[i][0], p[1] - body[i][1]), 0)
    const ext = bodyLen + size + 2
    const { dx, dy } = DIRS[arrow.dir]
    const head = body[body.length - 1]
    return { pts: [...body, [head[0] + dx * ext, head[1] + dy * ext]], bodyLen, ext }
  }, [arrow, size])

  const [s, setS] = useState(0)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const dur = Math.max(500, (ext / 30) * 1000)
    const t0 = performance.now()
    let raf
    const tick = now => {
      const t = Math.min(1, (now - t0) / dur)
      setS(ext * t * t)
      if (t < 1) raf = requestAnimationFrame(tick)
      else done.current()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ext])

  return (
    <g className="ag-arrow flying">
      <Shape points={slicePath(pts, s, s + bodyLen)} dir={arrow.dir} />
    </g>
  )
}

export default function ArrowGame() {
  const [level, setLevel] = useState(1)
  const [data, setData] = useState(() => generateLevel(1))
  const [lives, setLives] = useState(MAX_LIVES)
  const [phase, setPhase] = useState('playing') // playing | won | lost
  const timers = useRef([])

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const startLevel = useCallback(n => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setLevel(n)
    setData(generateLevel(n))
    setLives(MAX_LIVES)
    setPhase('playing')
  }, [])

  const patch = (id, changes) =>
    setData(d => ({ ...d, arrows: d.arrows.map(a => (a.id === id ? { ...a, ...changes } : a)) }))

  const remove = id =>
    setData(d => {
      const arrows = d.arrows.filter(a => a.id !== id)
      if (arrows.length === 0) setPhase(p => (p === 'playing' ? 'won' : p))
      return { ...d, arrows }
    })

  const handleClick = arrow => {
    if (phase !== 'playing' || arrow.status !== 'idle') return

    const blocker = findBlocker(arrow, data.arrows, data.cols, data.rows)
    if (blocker) {
      patch(arrow.id, { status: 'blocked' })
      patch(blocker.id, { hit: true })
      later(() => {
        patch(arrow.id, { status: 'idle' })
        patch(blocker.id, { hit: false })
      }, SHAKE_MS)
      const left = lives - 1
      setLives(left)
      if (left <= 0) later(() => setPhase('lost'), SHAKE_MS)
      return
    }
    patch(arrow.id, { status: 'flying' }) // <Flying> removes it from the DOM when it has left the board
  }

  const { cols, rows, arrows, shapeName } = data
  const size = Math.max(cols, rows)
  const pad = 0.5

  return (
    <div className="ag-root">
      <div className="ag-hud">
        <span className="ag-lives" aria-label={`${lives} lives left`}>
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <span key={i} className={i < lives ? 'on' : 'off'}>💧</span>
          ))}
        </span>
        <span className="ag-title">Level {level}</span>
        <span>Arrows: {arrows.length}</span>
      </div>

      <div className="ag-board-wrap">
        <svg className="ag-board" viewBox={`${-pad} ${-pad} ${cols + pad * 2} ${rows + pad * 2}`}>
          <rect x={-0.2} y={-0.2} width={cols + 0.4} height={rows + 0.4} rx={0.5} className="ag-tile" />
          {arrows.map(a =>
            a.status === 'flying' ? (
              <Flying key={a.id} arrow={a} size={size} onDone={() => remove(a.id)} />
            ) : (
              <g
                key={a.id}
                className={`ag-arrow ${a.status === 'blocked' ? 'blocked' : ''} ${a.hit ? 'hit' : ''}`}
                onClick={() => handleClick(a)}
              >
                <polyline className="ag-hit-area" points={toStr(pathPoints(a))} />
                <Shape points={pathPoints(a)} dir={a.dir} />
              </g>
            )
          )}
        </svg>
      </div>

      {phase !== 'playing' && (
        <div className="ag-overlay">
          {phase === 'won' ? (
            <>
              <h2>Level {level} cleared! 🎉</h2>
              <button onClick={() => startLevel(level + 1)}>Next level →</button>
            </>
          ) : (
            <>
              <h2>Out of lives 💔</h2>
              <button onClick={() => startLevel(level)}>Retry level {level}</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
