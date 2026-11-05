import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { playSound } from '../../platform/sound'
import { generateLevel, hintFor, isDeadlock, isSolved, onTargetCount, step, walkPath } from './logic'
import './BoxGame.css'

const ARROW = { left: '←', right: '→', up: '↑', down: '↓' }
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down',
}
const SWIPE_PX = 24
const WALK_MS = 55

export default function BoxBoard({ level, seed, session }) {
  // Big rooms take a few hundred ms to generate: show the board after one paint.
  const [puzzle, setPuzzle] = useState(null)
  useEffect(() => {
    const t = setTimeout(() => setPuzzle(generateLevel(seed, level)), 30)
    return () => clearTimeout(t)
  }, [seed, level])
  if (!puzzle) return <div className="bx-root"><p className="bx-loading">Stacking crates…</p></div>
  return <Warehouse puzzle={puzzle} session={session} />
}

function Warehouse({ puzzle: p, session }) {
  const [st, setSt] = useState(() => ({ player: p.player, boxes: p.boxes, facing: 'down', moves: 0, pushes: 0 }))
  const [hint, setHint] = useState(null)   // { box, dir, stand }
  const [flash, setFlash] = useState(null) // { cell, key } a refused push
  const [msg, setMsg] = useState(null)
  const ref = useRef(st)
  ref.current = st
  const history = useRef([])               // state before each push
  const won = useRef(false)
  const walk = useRef([])                  // pending tap-to-walk timers
  const timers = useRef([])
  const swipe = useRef(null)
  const boardRef = useRef(null)

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  const stopWalk = () => { walk.current.forEach(clearTimeout); walk.current = [] }
  useEffect(() => () => { timers.current.forEach(clearTimeout); stopWalk() }, [])

  const tset = useMemo(() => new Set(p.targets), [p])
  const done = onTargetCount(p, st.boxes)
  useEffect(() => { session.setInfo({ label: 'Crates', value: `${done}/${p.boxes.length}` }) }, [done, p, session])

  const say = useCallback((text, tone = 'bad') => { setMsg({ text, tone }); session.announce(text) }, [session])

  const where = i => `row ${Math.floor(i / p.w)}, column ${i % p.w}`

  /** One step in a direction. Returns false if nothing happened. */
  const move = useCallback(dir => {
    if (session.locked || won.current) return false
    const s = ref.current
    const res = step(p, s.player, s.boxes, dir)
    if (!res) { setSt({ ...s, facing: dir }); return false }
    if (res.pushed < 0) {
      setSt({ ...s, player: res.player, facing: dir, moves: s.moves + 1 })
      return true
    }
    const to = res.boxes[res.pushed]
    if (isDeadlock(p, res.boxes, to)) {
      // Refuse the push: the crate could never reach a target from there.
      stopWalk()
      setSt({ ...s, facing: dir })
      setFlash({ cell: to, key: Date.now() })
      later(() => setFlash(null), 700)
      session.noteMove(false)
      session.loseLife()
      say('That push would trap the crate for good, so it was blocked. You lose a life.')
      return false
    }
    history.current.push(s)
    setHint(null)
    setMsg(null)
    const next = { player: res.player, boxes: res.boxes, facing: dir, moves: s.moves + 1, pushes: s.pushes + 1 }
    setSt(next)
    session.noteMove(true)
    if (isSolved(p, next.boxes)) {
      won.current = true
      stopWalk()
      later(() => session.win(), 250)
    }
    return true
  }, [p, session, say])

  const walkTo = useCallback(cell => {
    if (session.locked || won.current) return
    const s = ref.current
    stopWalk()
    // Tap a crate next to you: push it.
    for (const dir of Object.keys(ARROW)) {
      const r = step(p, s.player, s.boxes, dir)
      if (r && r.player === cell && r.pushed >= 0) { move(dir); return }
    }
    const path = walkPath(p, s.player, cell, s.boxes)
    if (!path) return
    path.forEach((dir, k) => walk.current.push(setTimeout(() => move(dir), k * WALK_MS)))
  }, [p, session, move])

  useEffect(() => {
    session.bindActions({
      hint() {
        if (session.locked || won.current) return false
        const s = ref.current
        const h = hintFor(p, s.player, s.boxes)
        if (h === null) { say('This position can no longer be solved. Undo or restart.'); return false }
        if (!h) { say('Too tangled for a hint right now. Try undoing a push.'); return false }
        setHint(h)
        later(() => setHint(cur => (cur === h ? null : cur)), 4000)
        say(`Hint: push the crate at ${where(h.box)} ${h.dir}. ${h.left} push${h.left === 1 ? '' : 'es'} to go.`, 'info')
        return true
      },
      undo() {
        if (session.locked || won.current) return false
        const prev = history.current.pop()
        if (!prev) return false
        stopWalk()
        setHint(null)
        setMsg(null)
        setSt({ ...prev, moves: ref.current.moves + 1 })
        playSound('undo')
        return true
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, p, say])

  // Keyboard
  useEffect(() => {
    const onKey = e => {
      const dir = KEYS[e.key]
      if (!dir || e.metaKey || e.ctrlKey || e.altKey) return
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return
      e.preventDefault()
      stopWalk()
      move(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [move])

  // Swipe to step, tap to walk
  const onPointerDown = e => { swipe.current = { x: e.clientX, y: e.clientY } }
  const onPointerUp = e => {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.clientX - s.x, dy = e.clientY - s.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE_PX) {
      stopWalk()
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'))
      return
    }
    const rect = boardRef.current.getBoundingClientRect()
    if (!rect.width) return
    const c = Math.floor((e.clientX - rect.left) / rect.width * p.w)
    const r = Math.floor((e.clientY - rect.top) / rect.height * p.h)
    if (r >= 0 && r < p.h && c >= 0 && c < p.w) walkTo(r * p.w + c)
  }

  // Only draw walls that touch the floor, so the room keeps its real outline.
  const visibleWall = useMemo(() => p.wall.map((w, i) => {
    if (!w) return false
    const r = Math.floor(i / p.w), c = i % p.w
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc
      if (rr >= 0 && rr < p.h && cc >= 0 && cc < p.w && !p.wall[rr * p.w + cc]) return true
    }
    return false
  }), [p])

  const pos = i => ({ left: `${(i % p.w) * 100 / p.w}%`, top: `${Math.floor(i / p.w) * 100 / p.h}%`, width: `${100 / p.w}%`, height: `${100 / p.h}%` })
  const boxSet = new Set(st.boxes)
  const label = i => {
    if (p.wall[i]) return 'wall'
    const parts = [i === st.player ? 'you' : boxSet.has(i) ? 'crate' : 'floor']
    if (tset.has(i)) parts.push('target')
    return `${where(i)}: ${parts.join(' on ')}`
  }

  return (
    <div className="bx-root">
      <p className="bx-goal">
        Moves <strong>{st.moves}</strong> · Pushes <strong>{st.pushes}</strong> · Par <strong>{p.par}</strong>
      </p>
      <div
        ref={boardRef}
        className="bx-board"
        style={{ '--w': p.w, '--h': p.h }}
        role="grid"
        aria-label={`Warehouse ${p.w - 2} by ${p.h - 2}, ${p.boxes.length} crates, ${done} on targets. Use arrow keys or swipe to move.`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { swipe.current = null }}
      >
        {Array.from({ length: p.h }, (_, r) => (
          <div key={r} role="row" className="bx-row">
            {Array.from({ length: p.w }, (_, c) => {
              const i = r * p.w + c
              const cls = p.wall[i] ? (visibleWall[i] ? 'bx-wall' : 'bx-void') : `bx-floor${tset.has(i) ? ' target' : ''}${hint?.stand === i ? ' stand' : ''}${flash?.cell === i ? ' bad' : ''}`
              return <div key={c} role="gridcell" className={cls} aria-label={label(i)} />
            })}
          </div>
        ))}
        {st.boxes.map((b, id) => (
          <div
            key={id}
            className={`bx-crate${tset.has(b) ? ' home' : ''}${hint?.box === b ? ` hint ${hint.dir}` : ''}`}
            style={pos(b)}
            aria-hidden="true"
          ><span /></div>
        ))}
        <div className={`bx-player ${st.facing}`} style={pos(st.player)} aria-hidden="true"><span /></div>
      </div>
      <p className={`bx-msg ${msg?.tone || ''}`} aria-hidden="true">{msg?.text || ' '}</p>
      <div className="bx-pad" role="group" aria-label="Move">
        {['left', 'up', 'down', 'right'].map(d => (
          <button key={d} aria-label={`Move ${d}`} onClick={() => { stopWalk(); move(d) }}>
            {ARROW[d]}
          </button>
        ))}
      </div>
    </div>
  )
}
