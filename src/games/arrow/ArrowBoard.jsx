import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DIRS, generateLevel, findBlocker, pathPoints } from './levelGenerator'
import { playSound } from '../../platform/sound'
import { prefersReducedMotion } from '../../platform/settings'
import './ArrowGame.css'

const SHAKE_MS = 400
const LONG_PRESS_MS = 350
const MIN_CELL_PX = 22 // below this the board starts zoomed in (scroll to pan)

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
    [hx - dx * 0.02 + px * 0.26, hy - dy * 0.02 + py * 0.26],
    [hx - dx * 0.02 - px * 0.26, hy - dy * 0.02 - py * 0.26],
  ]
  return (
    <>
      <polyline className="ag-line" points={toStr(points)} />
      <polygon className="ag-head" points={toStr(head)} />
    </>
  )
}

// Faint straight line from the arrow tip to the edge of the board.
function PathPreview({ arrow, cols, rows }) {
  const head = arrow.cells[arrow.cells.length - 1]
  const { dx, dy } = DIRS[arrow.dir]
  const x1 = head.x + 0.5 + dx * 0.45, y1 = head.y + 0.5 + dy * 0.45
  const x2 = dx > 0 ? cols + 0.2 : dx < 0 ? -0.2 : x1
  const y2 = dy > 0 ? rows + 0.2 : dy < 0 ? -0.2 : y1
  return <line className="ag-preview" x1={x1} y1={y1} x2={x2} y2={y2} />
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
    const dur = prefersReducedMotion() ? 120 : Math.max(500, (ext / 30) * 1000)
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

// One idle/blocked arrow. Memoised: tapping one arrow doesn't re-render the other ~100.
const ArrowItem = memo(function ArrowItem({ arrow, hint, onActivate, onPressStart, onPressEnd }) {
  const pts = useMemo(() => pathPoints(arrow), [arrow.cells, arrow.dir]) // eslint-disable-line react-hooks/exhaustive-deps
  const head = arrow.cells[arrow.cells.length - 1]
  const cls = ['ag-arrow', arrow.status === 'blocked' && 'blocked', arrow.hit && 'hit', hint && 'hint'].filter(Boolean).join(' ')
  return (
    <g
      className={cls}
      role="button"
      tabIndex={0}
      aria-label={`Arrow pointing ${arrow.dir}, ${arrow.cells.length} cells long, head at row ${head.y + 1}, column ${head.x + 1}`}
      onClick={() => onActivate(arrow, false)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(arrow, true) }
      }}
      onPointerDown={() => onPressStart(arrow)}
      onPointerUp={onPressEnd}
      onPointerLeave={onPressEnd}
      onPointerCancel={onPressEnd}
      onContextMenu={e => e.preventDefault()}
    >
      <polyline className="ag-hit-area" points={toStr(pts)} />
      <Shape points={pts} dir={arrow.dir} />
    </g>
  )
})

export default function ArrowBoard({ level, mode, seed, session }) {
  const [data, setData] = useState(() => generateLevel({ level, seed, mode }))
  const [preview, setPreview] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [hintId, setHintId] = useState(null)
  const [zoom, setZoom] = useState(1)

  const dataRef = useRef(data)
  dataRef.current = data
  const timers = useRef([])
  const undoStack = useRef([])
  const pressTimer = useRef(null)
  const longPressed = useRef(false)
  const hintTimer = useRef(null)
  const wrapRef = useRef(null)
  const autoZoomed = useRef(false)

  const { cols, rows, arrows } = data
  const size = Math.max(cols, rows)
  const pad = 0.5

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => {
    timers.current.forEach(clearTimeout)
    clearTimeout(pressTimer.current)
    clearTimeout(hintTimer.current)
  }, [])

  const patch = useCallback((id, changes) =>
    setData(d => ({ ...d, arrows: d.arrows.map(a => (a.id === id ? { ...a, ...changes } : a)) })), [])

  const remove = useCallback(id =>
    setData(d => ({ ...d, arrows: d.arrows.filter(a => a.id !== id) })), [])

  // HUD info + win detection
  useEffect(() => { session.setInfo({ label: 'Arrows', value: arrows.length }) }, [arrows.length, session])
  useEffect(() => { if (arrows.length === 0) session.win() }, [arrows.length, session])

  const clearHint = () => { clearTimeout(hintTimer.current); setHintId(null) }

  const activate = useCallback((arrow, fromKeyboard) => {
    if (!fromKeyboard && longPressed.current) { longPressed.current = false; return } // it was a long press
    if (session.locked) return
    const { arrows: list, cols: c, rows: r } = dataRef.current
    const cur = list.find(a => a.id === arrow.id)
    if (!cur || cur.status !== 'idle') return
    clearHint()

    const blocker = findBlocker(cur, list, c, r)
    if (blocker) {
      patch(cur.id, { status: 'blocked' })
      patch(blocker.id, { hit: true })
      undoStack.current.push({ type: 'life' })
      session.noteMove(false)
      session.loseLife()
      session.announce(`Blocked by another arrow.`)
      later(() => {
        patch(cur.id, { status: 'idle' })
        patch(blocker.id, { hit: false })
      }, SHAKE_MS)
      return
    }

    undoStack.current.push({ type: 'launch', id: cur.id, arrow: { ...cur, status: 'idle', hit: false } })
    session.noteMove(true)
    playSound('launch')
    patch(cur.id, { status: 'flying' }) // <Flying> removes it from the DOM once it has left the board
  }, [patch, session])

  // Long press shows that arrow's flight path until release.
  const pressStart = useCallback(arrow => {
    longPressed.current = false
    clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => { longPressed.current = true; setPreview(arrow.id) }, LONG_PRESS_MS)
  }, [])
  const pressEnd = useCallback(() => { clearTimeout(pressTimer.current); setPreview(null) }, [])

  // Actions the shell's Hint / Undo buttons call.
  useEffect(() => {
    session.bindActions({
      hint() {
        if (session.locked) return false
        const { arrows: list, cols: c, rows: r } = dataRef.current
        const safe = list.filter(a => a.status === 'idle' && !findBlocker(a, list, c, r))
        if (!safe.length) return false
        const pick = safe[Math.floor(Math.random() * safe.length)]
        setHintId(pick.id)
        clearTimeout(hintTimer.current)
        hintTimer.current = setTimeout(() => setHintId(null), 3000)
        session.announce(`Hint: the arrow at row ${pick.cells.at(-1).y + 1}, column ${pick.cells.at(-1).x + 1} can fly safely.`)
        return true
      },
      undo() {
        if (session.locked) return false
        const entry = undoStack.current.pop()
        if (!entry) return false
        if (entry.type === 'life') {
          session.restoreLife()
          return true
        }
        setData(d =>
          d.arrows.some(a => a.id === entry.id)
            ? { ...d, arrows: d.arrows.map(a => (a.id === entry.id ? { ...entry.arrow } : a)) } // cancel mid-flight
            : { ...d, arrows: [...d.arrows, entry.arrow] }) // bring it back
        return true
      },
    })
  }, [session])

  // Start zoomed in when cells would be too small to tap comfortably.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const apply = () => {
      if (autoZoomed.current) return
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return
      autoZoomed.current = true
      const cell = Math.min(w / (cols + 1), h / (rows + 1))
      setZoom(Math.min(3, Math.max(1, +(MIN_CELL_PX / cell).toFixed(2))))
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [cols, rows])

  const previewArrow = preview != null ? arrows.find(a => a.id === preview && a.status !== 'flying') : null
  const zoomBy = f => setZoom(z => Math.min(4, Math.max(1, +(z * f).toFixed(2))))

  return (
    <div className="ag-root">
      <div className="ag-tools">
        <button className={`ag-toggle ${showAll ? 'active' : ''}`} aria-pressed={showAll} onClick={() => setShowAll(v => !v)}>
          {showAll ? 'Hide paths' : 'Show paths'}
        </button>
        <span className="ag-zoom" role="group" aria-label="Zoom">
          <button aria-label="Zoom out" onClick={() => zoomBy(0.8)} disabled={zoom <= 1}>−</button>
          <button aria-label="Fit board to screen" onClick={() => setZoom(1)}>Fit</button>
          <button aria-label="Zoom in" onClick={() => zoomBy(1.25)} disabled={zoom >= 4}>+</button>
        </span>
      </div>

      <div className="ag-board-wrap" ref={wrapRef}>
        <svg
          className="ag-board"
          style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
          viewBox={`${-pad} ${-pad} ${cols + pad * 2} ${rows + pad * 2}`}
          role="group"
          aria-label={`Arrow board, ${arrows.length} arrows left. Press Enter on an arrow to launch it.`}
        >
          <rect x={-0.2} y={-0.2} width={cols + 0.4} height={rows + 0.4} rx={0.5} className="ag-tile" />
          {arrows.map(a =>
            a.status === 'flying' ? (
              <Flying key={a.id} arrow={a} size={size} onDone={() => remove(a.id)} />
            ) : (
              <ArrowItem
                key={a.id}
                arrow={a}
                hint={hintId === a.id}
                onActivate={activate}
                onPressStart={pressStart}
                onPressEnd={pressEnd}
              />
            )
          )}
          {showAll && arrows.filter(a => a.status !== 'flying').map(a => (
            <PathPreview key={`p${a.id}`} arrow={a} cols={cols} rows={rows} />
          ))}
          {!showAll && previewArrow && <PathPreview arrow={previewArrow} cols={cols} rows={rows} />}
        </svg>
      </div>
    </div>
  )
}
