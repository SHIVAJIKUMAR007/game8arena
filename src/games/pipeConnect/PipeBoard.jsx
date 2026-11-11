import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { playSound } from '../../platform/sound'
import {
  REFILL, SIDES, flowStatus, generateLevel, hintCell, isFixed, maskAt, openSides, timeFor, turnsToSolve,
} from './logic'
import './PipeGame.css'

const KEYS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
const TICK = 200
const LOW = 10_000 // ms: the clock turns red

// Pipe artwork in a 1×1 cell, drawn unrotated; the cell's <g> turns it.
const MID = { 1: [0.5, 0], 2: [1, 0.5], 4: [0.5, 1], 8: [0, 0.5] }
const IN = { 1: [0, 1], 2: [-1, 0], 4: [0, -1], 8: [1, 0] }
const pt = ([x, y]) => `${+x.toFixed(3)},${+y.toFixed(3)}`
function pipePath(m) {
  const sides = [1, 2, 4, 8].filter(b => m & b)
  if (sides.length === 2 && m !== 5 && m !== 10) {
    // Elbow: a quarter circle around the shared corner.
    const [a, b] = sides, k = 0.276
    const c1 = [MID[a][0] + IN[a][0] * k, MID[a][1] + IN[a][1] * k]
    const c2 = [MID[b][0] + IN[b][0] * k, MID[b][1] + IN[b][1] * k]
    return `M${pt(MID[a])} C${pt(c1)} ${pt(c2)} ${pt(MID[b])}`
  }
  if (sides.length === 2) return `M${pt(MID[sides[0]])} L${pt(MID[sides[1]])}`
  return sides.map(s => `M${pt(MID[s])} L.5,.5`).join(' ')
}
const SIDE_ANGLE = { 1: 0, 2: 90, 4: 180, 8: 270 }

function Pipe({ mask }) {
  const d = pipePath(mask)
  const joint = openSides(mask) !== 2
  return (
    <>
      <path className="pc-pipe-o" d={d} />
      {joint && <circle className="pc-joint-o" cx={0.5} cy={0.5} r={0.2} />}
      <path className="pc-pipe-i" d={d} />
      {joint && <circle className="pc-joint-i" cx={0.5} cy={0.5} r={0.14} />}
      {[1, 2, 4, 8].filter(b => mask & b).map(b => (
        <rect key={b} className="pc-coupling" x={0.29} y={0.02} width={0.42} height={0.09} rx={0.02} transform={`rotate(${SIDE_ANGLE[b]} .5 .5)`} />
      ))}
    </>
  )
}

const BOLTS = [[0.17, 0.17], [0.83, 0.17], [0.17, 0.83], [0.83, 0.83]]
const fmt = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

function pieceName(m) {
  const k = openSides(m)
  return k === 1 ? 'end cap' : k === 3 ? 'T pipe' : k === 4 ? 'cross pipe' : m === 5 || m === 10 ? 'straight pipe' : 'elbow pipe'
}

export default function PipeBoard({ level, seed, session }) {
  const puzzle = useMemo(() => generateLevel(seed, level), [seed, level])
  return <Pipes p={puzzle} level={level} session={session} />
}

function Pipes({ p, level, session }) {
  const D = p.drains.length
  const limit = useMemo(() => timeFor(p, level) * 1000, [p, level])
  const [rot, setRot] = useState(() => [...p.start])
  const [pinned, setPinned] = useState(() => new Set()) // pieces a hint set (bolted down)
  const [cursor, setCursor] = useState(p.source)
  const [turns, setTurns] = useState(0)
  const [left, setLeft] = useState(limit)
  const [started, setStarted] = useState(false)
  const [flash, setFlash] = useState(-1)
  const [msg, setMsg] = useState('The clock starts when you turn your first pipe.')

  const live = useRef({ rot, pinned, cursor })
  useLayoutEffect(() => { live.current = { rot, pinned, cursor } })
  const history = useRef([]) // { cell, prev } per turn
  const clock = useRef({ started: false, remaining: limit, last: 0 })
  const won = useRef(false)
  const svgRef = useRef(null)
  const timers = useRef([])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const st = useMemo(() => flowStatus(p, rot), [p, rot])
  const drainSet = useMemo(() => new Set(p.drains), [p])

  useEffect(() => { session.setInfo({ label: 'Drains', value: `${st.reached}/${D}` }) }, [st.reached, D, session])

  const say = useCallback(text => { setMsg(text); session.announce(text) }, [session])

  /** Apply a new rotation array and react to what the water does. */
  const commit = useCallback((after, { scored = true } = {}) => {
    const a = flowStatus(p, live.current.rot), b = flowStatus(p, after)
    live.current.rot = after
    setRot(after)
    if (scored && b.wetCount > a.wetCount) session.noteMove(true)
    else if (scored && b.wetCount < a.wetCount) session.noteMove(false)
    if (b.solved) {
      won.current = true
      say(D > 1 ? 'Water is flowing into every drain!' : 'Water is flowing into the drain!')
      later(() => session.win(), 450)
    } else if (b.reached > a.reached) {
      playSound('launch')
      say(`Drain filled: ${b.reached} of ${D}.`)
    } else if (b.reached < a.reached) {
      say(`A drain ran dry: ${b.reached} of ${D}.`)
    }
  }, [p, D, session, say])

  const rotate = useCallback((cell, dir = 1) => {
    if (session.locked || won.current) return false
    if (isFixed(p, cell) || live.current.pinned.has(cell)) {
      say(cell === p.source ? 'The water source can’t turn.' : drainSet.has(cell) ? 'Drains can’t turn.' : 'That piece is bolted down.')
      return false
    }
    const before = live.current.rot
    const after = before.slice()
    after[cell] += dir
    history.current.push({ cell, prev: before[cell] })
    setTurns(t => t + 1)
    if (!clock.current.started) {
      Object.assign(clock.current, { started: true, last: Date.now() })
      setStarted(true)
      setMsg(null)
    }
    playSound('tap')
    commit(after)
    return true
  }, [p, session, say, commit, drainSet])

  // ----- clock: runs from the first turn; pauses while the shell is locked or the tab is hidden -----
  useEffect(() => {
    const id = setInterval(() => {
      const c = clock.current, now = Date.now()
      const dt = now - c.last
      c.last = now
      if (!c.started || won.current || session.locked || document.hidden) return
      c.remaining -= dt
      if (c.remaining <= 0) {
        c.remaining = Math.round(limit * REFILL)
        const lives = session.loseLife()
        if (lives > 0) say(`Time’s up! You lost a 💧. The clock refills to ${fmt(c.remaining)}.`)
      }
      setLeft(Math.max(0, c.remaining))
    }, TICK)
    return () => clearInterval(id)
  }, [session, limit, say])

  // ----- pointer: click turns clockwise, right-click anticlockwise -----
  const cellAt = e => {
    const rect = svgRef.current.getBoundingClientRect()
    const c = Math.floor((e.clientX - rect.left) / rect.width * p.n)
    const r = Math.floor((e.clientY - rect.top) / rect.height * p.n)
    return r >= 0 && r < p.n && c >= 0 && c < p.n ? r * p.n + c : -1
  }
  const onClick = e => {
    const cell = cellAt(e)
    if (cell < 0) return
    setCursor(cell)
    rotate(cell, 1)
  }
  const onContextMenu = e => {
    e.preventDefault()
    const cell = cellAt(e)
    if (cell < 0) return
    setCursor(cell)
    rotate(cell, -1)
  }

  // ----- keyboard: arrows move, Space/Enter turns clockwise, with Shift anticlockwise -----
  const onKeyDown = e => {
    if (KEYS[e.key]) {
      e.preventDefault()
      const [dr, dc] = KEYS[e.key]
      const cur = live.current.cursor
      const r = Math.floor(cur / p.n) + dr, c = cur % p.n + dc
      if (r < 0 || r >= p.n || c < 0 || c >= p.n) return
      const cell = r * p.n + c
      live.current.cursor = cell
      setCursor(cell)
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      rotate(live.current.cursor, e.shiftKey ? -1 : 1)
    }
  }

  useEffect(() => {
    session.bindActions({
      hint() {
        if (session.locked || won.current) return false
        const { rot: now, pinned: pins } = live.current
        const cell = hintCell(p, now, pins)
        if (cell < 0) return false
        const after = now.slice()
        after[cell] += turnsToSolve(p, now, cell)
        const nextPins = new Set(pins).add(cell)
        live.current.pinned = nextPins
        setPinned(nextPins)
        history.current = history.current.filter(h => h.cell !== cell)
        setCursor(cell)
        setFlash(cell)
        later(() => setFlash(f => (f === cell ? -1 : f)), 1200)
        const r = Math.floor(cell / p.n) + 1, c = cell % p.n + 1
        say(`Hint: the piece at row ${r}, column ${c} is turned the right way and bolted down.`)
        commit(after, { scored: false })
        return true
      },
      undo() {
        if (session.locked || won.current) return false
        const last = history.current.pop()
        if (!last) return false
        const after = live.current.rot.slice()
        after[last.cell] = last.prev
        setCursor(last.cell)
        commit(after, { scored: false })
        return true // time isn't refunded
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, p, say, commit])

  const describe = i => {
    const where = `row ${Math.floor(i / p.n) + 1}, column ${i % p.n + 1}`
    const m = maskAt(p, rot, i)
    const what = i === p.source ? 'water source' : drainSet.has(i) ? 'drain' : pieceName(m)
    const open = SIDES.filter(s => m & s.bit).map(s => s.name).join(' and ')
    const bolted = !(i === p.source || drainSet.has(i)) && (p.locked[i] || pinned.has(i)) ? ', bolted' : ''
    return `${where}: ${what}, open ${open}${bolted}, ${st.wet[i] ? 'full of water' : 'dry'}`
  }

  const frac = Math.max(0, Math.min(1, left / limit))
  const low = started && left <= LOW

  return (
    <div className="pc-root">
      <p className="pc-goal">
        Drains <strong>{st.reached}/{D}</strong> · Turns <strong>{turns}</strong>
      </p>
      <div className="pc-timer" role="timer" aria-label={`Time left ${fmt(left)}${started ? '' : ', starts on your first turn'}`}>
        <span className="pc-drop" aria-hidden="true">💧</span>
        <div className="pc-tank" aria-hidden="true">
          <div className={`pc-fill${low ? ' low' : ''}`} style={{ width: `${frac * 100}%` }} />
        </div>
        <span className={`pc-time${low ? ' low' : ''}`}>{fmt(left)}</span>
      </div>
      <svg
        ref={svgRef}
        className="pc-grid"
        viewBox={`0 0 ${p.n} ${p.n}`}
        role="application"
        tabIndex={0}
        aria-label={`Pipe Connect ${p.n} by ${p.n}, ${D} ${D > 1 ? 'drains' : 'drain'}. Arrow keys move, Space turns a pipe clockwise, Shift+Space anticlockwise. Cursor at ${describe(cursor)}.`}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onKeyDown={onKeyDown}
      >
        {rot.map((turn, i) => {
          const kind = i === p.source ? 'source' : drainSet.has(i) ? 'drain' : 'pipe'
          const bolted = kind === 'pipe' && (p.locked[i] || pinned.has(i))
          const cls = ['pc-cell', kind, bolted && 'bolted', pinned.has(i) && 'pinned', st.wet[i] && 'wet', flash === i && 'flash']
          return (
            <g key={i} className={cls.filter(Boolean).join(' ')} transform={`translate(${i % p.n} ${Math.floor(i / p.n)})`}>
              <rect className="pc-tile" x={0.03} y={0.03} width={0.94} height={0.94} rx={0.12} />
              {bolted && BOLTS.map(([x, y]) => <circle key={`${x}${y}`} className="pc-bolt" cx={x} cy={y} r={0.045} />)}
              <g className="pc-rot" style={{ transform: `rotate(${turn * 90}deg)` }}>
                <rect width={1} height={1} fill="none" />
                <Pipe mask={p.solution[i]} />
              </g>
              {kind === 'source' && (
                <g className="pc-faucet">
                  <circle cx={0.5} cy={0.5} r={0.3} />
                  <path d="M.5,.3 V.7 M.3,.5 H.7" />
                  <circle className="pc-faucet-cap" cx={0.5} cy={0.5} r={0.08} />
                </g>
              )}
              {kind === 'drain' && (
                <g className="pc-drain">
                  <circle cx={0.5} cy={0.5} r={0.3} />
                  <circle className="pc-hole" cx={0.5} cy={0.5} r={0.19} />
                  <path d="M.38,.42 H.62 M.34,.5 H.66 M.38,.58 H.62" />
                </g>
              )}
            </g>
          )
        })}
        <rect className="pc-cursor" x={cursor % p.n + 0.03} y={Math.floor(cursor / p.n) + 0.03} width={0.94} height={0.94} rx={0.12} />
      </svg>
      <p className="pc-msg">{msg || ' '}</p>
    </div>
  )
}
