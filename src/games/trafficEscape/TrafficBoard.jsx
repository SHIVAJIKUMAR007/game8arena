import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hashString } from '../../platform/rng'
import { playSound } from '../../platform/sound'
import { hintFor, isSolved, levelFor, livesLost, nextLossAt, puzzleForHash, range } from './logic'
import './TrafficGame.css'

const DRAG_PX = 5
const ROW = r => `row ${r + 1}`
const COL = c => `column ${c + 1}`

export default function TrafficBoard({ level, mode, seed, session }) {
  const puzzle = useMemo(
    () => (mode === 'daily' ? puzzleForHash(hashString(seed)) : levelFor(level)),
    [level, mode, seed],
  )
  return <Lot puzzle={puzzle} session={session} />
}

function Lot({ puzzle: p, session }) {
  const [st, setSt] = useState(() => ({ state: p.start, moves: 0 }))
  const [drag, setDrag] = useState(null)   // { k, off } live drag position (fractional cells)
  const [hint, setHint] = useState(null)   // { car, to }
  const [exiting, setExiting] = useState(false)
  const ref = useRef(st)
  ref.current = st
  const history = useRef([])                // state before each counted move
  const lastCar = useRef(null)              // consecutive slides of one car count as one move
  const lost = useRef(0)                    // lives already taken by the move budget
  const won = useRef(false)
  const dragRef = useRef(null)
  const lotRef = useRef(null)
  const carRefs = useRef([])
  const timers = useRef([])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useEffect(() => { session.setInfo({ label: 'Moves', value: `${st.moves} / par ${p.par}` }) }, [st.moves, p, session])

  const describe = useCallback((k, pos) => {
    const { len, horiz, lane } = p.cars[k]
    const name = k === 0 ? 'Red car' : `${p.cars[k].color} ${len === 3 ? 'truck' : 'car'}`
    return horiz
      ? `${name}, horizontal, ${ROW(lane)}, ${COL(pos)} to ${COL(pos + len - 1)}`
      : `${name}, vertical, ${COL(lane)}, ${ROW(pos)} to ${ROW(pos + len - 1)}`
  }, [p])

  /** Slide car k to `to`. Returns true if the car moved. */
  const commit = useCallback((k, to) => {
    if (session.locked || won.current) return false
    const s = ref.current
    if (to === s.state[k]) return false
    const state = s.state.slice()
    state[k] = to
    let moves = s.moves
    const top = history.current.at(-1)
    if (k === lastCar.current && top) {
      if (top.every((v, i) => v === state[i])) { history.current.pop(); moves -= 1; lastCar.current = null } // slid back: not a move
    } else {
      history.current.push(s.state)
      moves += 1
      lastCar.current = k
    }
    setSt({ state, moves })
    setHint(null)

    // Move budget: lives go as the count passes par + slack, par + 2·slack, …
    const due = livesLost(p.par, moves)
    if (due > lost.current) {
      for (; lost.current < due; lost.current++) { session.noteMove(false); session.loseLife() }
      session.announce(`Over budget: ${moves} moves, par ${p.par}. You lost a life.`)
    } else if (due < lost.current) {
      for (; lost.current > due; lost.current--) session.restoreLife()
    } else if (moves > s.moves) {
      session.noteMove(true)
    } else {
      playSound('tap')
    }

    if (isSolved(p, state)) {
      won.current = true
      setExiting(true)
      session.announce('The red car escaped!')
      later(() => session.win(), 450)
    }
    return true
  }, [p, session])

  useEffect(() => {
    session.bindActions({
      hint() {
        if (session.locked || won.current) return false
        const h = hintFor(p, ref.current.state)
        if (!h) return false
        setHint(h)
        later(() => setHint(cur => (cur === h ? null : cur)), 4000)
        const { horiz } = p.cars[h.car]
        const from = ref.current.state[h.car]
        const dir = horiz ? (h.to > from ? 'right' : 'left') : (h.to > from ? 'down' : 'up')
        session.announce(`Hint: slide the ${describe(h.car, from)} ${dir} ${Math.abs(h.to - from)}. ${h.left} move${h.left === 1 ? '' : 's'} to go.`)
        carRefs.current[h.car]?.focus()
        return true
      },
      undo() {
        if (session.locked || won.current) return false
        const prev = history.current.pop()
        if (!prev) return false
        lastCar.current = null
        setHint(null)
        setSt(s => ({ ...s, state: prev })) // the move count stays: undo doesn't refund moves
        playSound('undo')
        return true
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, p, describe])

  // ----- dragging -----
  const onPointerDown = (e, k) => {
    if (session.locked || won.current || e.button > 0) return
    const rect = lotRef.current.getBoundingClientRect()
    const [lo, hi] = range(p, ref.current.state, k)
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragRef.current = { k, x: e.clientX, y: e.clientY, cell: rect.width / p.size, lo, hi, from: ref.current.state[k], moved: false }
  }
  const onPointerMove = e => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < DRAG_PX) return
    d.moved = true
    const delta = (p.cars[d.k].horiz ? dx : dy) / d.cell
    d.off = Math.min(d.hi, Math.max(d.lo, d.from + delta))
    setDrag({ k: d.k, off: d.off })
  }
  const onPointerUp = () => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    if (!d.moved) { carRefs.current[d.k]?.focus(); return }
    setDrag(null)
    commit(d.k, Math.round(d.off))
  }

  const onKeyDown = (e, k) => {
    const { horiz } = p.cars[k]
    const step = { ArrowLeft: horiz ? -1 : 0, ArrowRight: horiz ? 1 : 0, ArrowUp: horiz ? 0 : -1, ArrowDown: horiz ? 0 : 1 }[e.key]
    if (step === undefined) return
    e.preventDefault()
    if (!step) return
    const [lo, hi] = range(p, ref.current.state, k)
    const to = ref.current.state[k] + step
    if (to >= lo && to <= hi) commit(k, to)
  }

  const nextLoss = nextLossAt(p.par, st.moves)
  const livesGone = livesLost(p.par, st.moves)
  const pct = 100 / p.size

  const placement = (k, pos) => {
    const { len, horiz, lane } = p.cars[k]
    return horiz
      ? { left: `${pos * pct}%`, top: `${lane * pct}%`, width: `${len * pct}%`, height: `${pct}%` }
      : { left: `${lane * pct}%`, top: `${pos * pct}%`, width: `${pct}%`, height: `${len * pct}%` }
  }

  return (
    <div className="tr-root">
      <p className="tr-goal">
        Moves <strong>{st.moves}</strong> · Par <strong>{p.par}</strong>
        {livesGone < 3 && <> · <span className={nextLoss - st.moves <= 2 ? 'tr-warn' : ''}>next 💧 at {nextLoss}</span></>}
      </p>
      <div className="tr-frame">
        <div
          ref={lotRef}
          className="tr-lot"
          style={{ '--n': p.size }}
          role="group"
          aria-label={`Parking lot ${p.size} by ${p.size}. Exit on the right of ${ROW(p.exitRow)}. Tab to a car and use arrow keys to slide it.`}
        >
          <div className="tr-exit" style={{ top: `${p.exitRow * pct}%`, height: `${pct}%` }} aria-hidden="true"><span>EXIT</span></div>
          {hint && <div className={`tr-ghost ${p.cars[hint.car].horiz ? 'h' : 'v'}`} style={placement(hint.car, hint.to)} aria-hidden="true" />}
          {p.cars.map((car, k) => {
            const pos = drag?.k === k ? drag.off : st.state[k]
            const cls = [
              'tr-car', car.horiz ? 'h' : 'v', car.len === 3 ? 'truck' : '', k === 0 ? 'red' : '',
              drag?.k === k ? 'dragging' : '', hint?.car === k ? 'hint' : '', k === 0 && exiting ? 'out' : '',
            ].filter(Boolean).join(' ')
            return (
              <div
                key={k}
                ref={el => { carRefs.current[k] = el }}
                className={cls}
                data-color={car.color}
                style={placement(k, pos)}
                role="button"
                tabIndex={0}
                aria-label={describe(k, st.state[k])}
                onPointerDown={e => onPointerDown(e, k)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => { dragRef.current = null; setDrag(null) }}
                onKeyDown={e => onKeyDown(e, k)}
              ><span /></div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
