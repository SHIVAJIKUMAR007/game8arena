import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { playSound } from '../../platform/sound'
import {
  COLORS, applySolution, extendStroke, generateLevel, isConnected, livesLost, mergeStroke,
  nextHintColor, nextLossAt, progress, startStroke,
} from './logic'
import './ConnectGame.css'

const KEYS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
const ROW = r => `row ${r + 1}`
const COL = c => `column ${c + 1}`

export default function ConnectBoard({ level, seed, session }) {
  const puzzle = useMemo(() => generateLevel(seed, level), [seed, level])
  return <Grid puzzle={puzzle} session={session} />
}

function Grid({ puzzle: p, session }) {
  const k = p.dots.length
  const [paths, setPaths] = useState(() => p.dots.map(() => []))
  const [stroke, setStroke] = useState(null)       // { color, path } while drawing
  const [moves, setMoves] = useState(0)
  const [cursor, setCursor] = useState(p.dots[0][0])
  const [flash, setFlash] = useState(null)         // colour just hinted or just connected
  const [msg, setMsg] = useState(null)

  const live = useRef({})
  useLayoutEffect(() => { live.current = { paths, stroke, moves, cursor } })
  const history = useRef([])                        // committed `paths` before each stroke
  const lastColor = useRef(null)
  const lost = useRef(0)
  const won = useRef(false)
  const svgRef = useRef(null)
  const pointerCell = useRef(-1)
  const timers = useRef([])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const shown = useMemo(() => mergeStroke(paths, stroke), [paths, stroke])
  const prog = useMemo(() => progress(p, shown), [p, shown])
  const owner = useMemo(() => {
    const o = new Int8Array(p.n * p.n).fill(-1)
    shown.forEach((path, c) => path.forEach(x => { o[x] = c }))
    return o
  }, [p, shown])

  useEffect(() => { session.setInfo({ label: 'Flows', value: `${prog.connected}/${k}` }) }, [prog.connected, k, session])

  const say = useCallback(text => { setMsg(text); session.announce(text) }, [session])

  /** Finish a stroke: commit it, count the move, check budget and win. */
  const finish = useCallback(() => {
    const { paths: before, stroke: s, moves: m } = live.current
    if (!s) return
    setStroke(null)
    live.current.stroke = null
    const after = mergeStroke(before, s)
    const changed = after.some((path, c) => path.length !== before[c].length || path.some((x, i) => x !== before[c][i]))
    if (!changed) return
    history.current.push(before)
    setPaths(after)
    let next = m
    if (s.color !== lastColor.current) { next = m + 1; lastColor.current = s.color; setMoves(next) }

    const due = livesLost(k, next)
    if (due > lost.current) {
      for (; lost.current < due; lost.current++) { session.noteMove(false); session.loseLife() }
      say(`That's ${next} moves for ${k} colours: you lost a life.`)
    } else if (next > m) {
      session.noteMove(true)
    }

    const pr = progress(p, after)
    if (isConnected(p, s.color, after[s.color])) { setFlash(s.color); later(() => setFlash(f => (f === s.color ? null : f)), 500) }
    if (pr.solved) {
      won.current = true
      say('Every flow connected and the grid is full!')
      later(() => session.win(), 350)
    } else if (pr.connected === k) {
      say(`All colours connected, but ${Math.round((1 - pr.filled) * p.n * p.n)} squares are empty. Fill the whole grid!`)
    } else if (due <= lost.current) {
      setMsg(null)
    }
  }, [p, k, session, say])

  const begin = useCallback(cell => {
    if (session.locked || won.current) return false
    const s = startStroke(p, mergeStroke(live.current.paths, live.current.stroke), cell)
    if (!s) return false
    setStroke(s)
    live.current.stroke = s
    playSound('tap')
    return true
  }, [p, session])

  /** Move the stroke into `cell`, walking square by square if the pointer skipped ahead. */
  const extendTo = useCallback(cell => {
    let s = live.current.stroke
    if (!s) return false
    const target = [Math.floor(cell / p.n), cell % p.n]
    for (let guard = 0; guard < p.n * 2; guard++) {
      const last = s.path.at(-1)
      if (last === cell || s.path.includes(cell)) { s = extendStroke(p, s, cell) || s; break }
      const r = Math.floor(last / p.n), c = last % p.n
      const dr = Math.sign(target[0] - r), dc = Math.sign(target[1] - c)
      const step = dr && (Math.abs(target[0] - r) >= Math.abs(target[1] - c) || !dc) ? last + dr * p.n : last + dc
      const next = extendStroke(p, s, step)
      if (!next) break
      s = next
    }
    if (s === live.current.stroke) return false
    setStroke(s)
    live.current.stroke = s
    return true
  }, [p])

  // ----- pointer -----
  const cellAt = e => {
    const rect = svgRef.current.getBoundingClientRect()
    const c = Math.floor((e.clientX - rect.left) / rect.width * p.n)
    const r = Math.floor((e.clientY - rect.top) / rect.height * p.n)
    return r >= 0 && r < p.n && c >= 0 && c < p.n ? r * p.n + c : -1
  }
  const onPointerDown = e => {
    const cell = cellAt(e)
    if (cell < 0 || !begin(cell)) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointerCell.current = cell
    setCursor(cell)
  }
  const onPointerMove = e => {
    if (!live.current.stroke) return
    const cell = cellAt(e)
    if (cell < 0 || cell === pointerCell.current) return
    pointerCell.current = cell
    extendTo(cell)
  }
  const onPointerUp = () => { pointerCell.current = -1; finish() }

  // ----- keyboard: arrows move the cursor; Space/Enter picks up or puts down a colour -----
  const onKeyDown = e => {
    if (KEYS[e.key]) {
      e.preventDefault()
      const [dr, dc] = KEYS[e.key]
      const { cursor: cur, stroke: s } = live.current
      const r = Math.floor(cur / p.n) + dr, c = cur % p.n + dc
      if (r < 0 || r >= p.n || c < 0 || c >= p.n) return
      const cell = r * p.n + c
      if (s) {
        const next = extendStroke(p, s, cell)
        if (!next) return
        setStroke(next)
        live.current.stroke = next
        setCursor(cell)
        if (isConnected(p, next.color, next.path)) finish() // joined: put the colour down
      } else {
        setCursor(cell)
      }
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (live.current.stroke) finish()
      else begin(live.current.cursor)
    } else if (e.key === 'Escape' && live.current.stroke) {
      setStroke(null)
      live.current.stroke = null
    }
  }

  useEffect(() => {
    session.bindActions({
      hint() {
        if (session.locked || won.current) return false
        const color = nextHintColor(p, live.current.paths)
        if (color < 0) return false
        history.current.push(live.current.paths)
        const after = applySolution(p, live.current.paths, color)
        setPaths(after)
        setStroke(null)
        setFlash(color)
        later(() => setFlash(f => (f === color ? null : f)), 1500)
        say(`Hint: the ${COLORS[color]} flow is drawn for you.`)
        if (progress(p, after).solved) { won.current = true; later(() => session.win(), 600) }
        return true
      },
      undo() {
        if (session.locked || won.current) return false
        const prev = history.current.pop()
        if (!prev) return false
        setPaths(prev)
        setStroke(null)
        lastColor.current = null
        setMsg(null)
        return true // moves aren't refunded
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, p, say])

  const center = i => [(i % p.n) + 0.5, Math.floor(i / p.n) + 0.5]
  const dotColor = new Map(p.dots.flatMap(([a, b], c) => [[a, c], [b, c]]))
  const describe = i => {
    const where = `${ROW(Math.floor(i / p.n))}, ${COL(i % p.n)}`
    if (dotColor.has(i)) return `${where}: ${COLORS[dotColor.get(i)]} dot ${dotColor.get(i) + 1}`
    return owner[i] >= 0 ? `${where}: ${COLORS[owner[i]]} path` : `${where}: empty`
  }
  const nextLoss = nextLossAt(k, moves)
  const done = livesLost(k, moves) >= 3

  return (
    <div className="cc-root">
      <p className="cc-goal">
        Flows <strong>{prog.connected}/{k}</strong> · Filled <strong>{Math.round(prog.filled * 100)}%</strong> · Moves <strong>{moves}</strong>
        {!done && <> · <span className={nextLoss - moves <= 1 ? 'cc-warn' : ''}>next 💧 at {nextLoss}</span></>}
      </p>
      <svg
        ref={svgRef}
        className="cc-grid"
        viewBox={`0 0 ${p.n} ${p.n}`}
        style={{ '--n': p.n }}
        role="application"
        tabIndex={0}
        aria-label={`Color Connect ${p.n} by ${p.n} with ${k} colours. Arrow keys move, Space picks up or puts down a colour. Cursor at ${describe(cursor)}.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        {Array.from({ length: p.n * p.n }, (_, i) => (
          <rect
            key={i}
            className={`cc-cell${owner[i] >= 0 ? ` own c${owner[i]}` : ''}`}
            x={i % p.n + 0.04} y={Math.floor(i / p.n) + 0.04} width={0.92} height={0.92} rx={0.14}
          />
        ))}
        {shown.map((path, c) => path.length > 1 && (
          <polyline
            key={`p${c}`}
            className={`cc-pipe c${c}${flash === c ? ' flash' : ''}`}
            points={path.map(x => center(x).join(',')).join(' ')}
          />
        ))}
        {p.dots.map((pair, c) => pair.map(x => {
          const [cx, cy] = center(x)
          return (
            <g key={`d${x}`} className={`cc-dot c${c}${isConnected(p, c, shown[c]) ? ' joined' : ''}`}>
              <circle cx={cx} cy={cy} r={0.33} />
              <text x={cx} y={cy} dy="0.11">{c + 1}</text>
            </g>
          )
        }))}
        <rect className="cc-cursor" x={cursor % p.n + 0.04} y={Math.floor(cursor / p.n) + 0.04} width={0.92} height={0.92} rx={0.14} />
      </svg>
      <p className="cc-msg">{msg || ' '}</p>
    </div>
  )
}
