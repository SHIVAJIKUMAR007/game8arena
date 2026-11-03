import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRng } from '../../platform/rng'
import { playSound } from '../../platform/sound'
import { bestMove, bestTile, hasMoves, initialTiles, move, rescue, sizeFor, spawn, targetFor } from './logic'
import './MergeGame.css'

const ARROW = { left: '←', right: '→', up: '↑', down: '↓' }
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down',
}
const SWIPE_PX = 24
// Font scales with tile size and digit count, so 7-digit numbers still fit.
const tileStyle = v => ({ '--h': (Math.log(v) / Math.log(3) * 47) % 360, '--f': Math.min(0.5, 0.86 / (String(v).length * 0.62)) })

export default function MergeBoard({ level, seed, session }) {
  const target = targetFor(level)
  const size = sizeFor(level)
  const rng = useRef(null)
  if (!rng.current) rng.current = createRng(seed)

  const [board, setBoard] = useState(() => ({ tiles: initialTiles(level, rng.current, size), gone: [] }))
  const [hintDir, setHintDir] = useState(null)
  const ref = useRef(board)
  ref.current = board
  const undoStack = useRef([])
  const timers = useRef([])
  const swipe = useRef(null)
  const won = useRef(false)
  const bestSeen = useRef(0)

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const best = useMemo(() => bestTile(board.tiles), [board.tiles])
  useEffect(() => { session.setInfo({ label: 'Best tile', value: target ? `${best}/${target}` : best }) }, [best, target, session])

  const play = useCallback(dir => {
    if (session.locked || won.current) return
    const before = ref.current.tiles
    const res = move(before, dir, size)
    if (!res.moved) return // nothing slid: free, no penalty
    setHintDir(null)

    let tiles = spawn(res.tiles.map(t => ({ ...t, merged: false })), rng.current, size)
    let lostLife = false
    session.noteMove(true)
    playSound(res.gone.length ? 'combo' : 'tap', res.gone.length)

    if (target && bestTile(tiles) >= target) {
      won.current = true
      undoStack.current.push({ tiles: before, life: false })
      setBoard({ tiles, gone: res.gone })
      later(() => setBoard(b => ({ ...b, gone: [] })), 160)
      later(() => session.win(), 350)
      return
    }
    if (!hasMoves(tiles, size)) {
      lostLife = true
      session.announce('Board is full — you lose a life and the smallest tiles are cleared.')
      session.loseLife()
      tiles = rescue(tiles, 3)
    }
    if (bestTile(tiles) > bestSeen.current && bestTile(tiles) >= 27) {
      bestSeen.current = bestTile(tiles)
      session.announce(`New best tile: ${bestSeen.current}`)
    }
    undoStack.current.push({ tiles: before, life: lostLife })
    setBoard({ tiles, gone: res.gone })
    later(() => setBoard(b => ({ ...b, gone: [] })), 160)
  }, [session, target, size])

  useEffect(() => {
    session.bindActions({
      hint() {
        if (session.locked) return false
        const dir = bestMove(ref.current.tiles, size)
        if (!dir) return false
        setHintDir(dir)
        later(() => setHintDir(null), 2500)
        session.announce(`Hint: swipe ${dir}.`)
        return true
      },
      undo() {
        if (session.locked || won.current) return false
        const entry = undoStack.current.pop()
        if (!entry) return false
        if (entry.life) session.restoreLife()
        setBoard({ tiles: entry.tiles, gone: [] })
        return true
      },
    })
  }, [session, size])

  // Keyboard
  useEffect(() => {
    const onKey = e => {
      const dir = KEYS[e.key]
      if (!dir || e.metaKey || e.ctrlKey || e.altKey) return
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return
      e.preventDefault()
      play(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [play])

  // Swipe
  const onPointerDown = e => { swipe.current = { x: e.clientX, y: e.clientY } }
  const onPointerUp = e => {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.clientX - s.x, dy = e.clientY - s.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return
    play(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'))
  }

  const pct = 100 / size
  const cells = [...board.tiles, ...board.gone.map(t => ({ ...t, gone: true }))]

  return (
    <div className="mg-root">
      <p className="mg-goal">
        {target ? <>Merge tiles to make <strong>{target.toLocaleString()}</strong></> : <>Endless — go for a new high score</>} · {size}×{size}
      </p>
      <div
        className="mg-board"
        style={{ '--n': size }}
        role="group"
        aria-label={`Merge board, ${board.tiles.length} tiles, goal ${target}. Use arrow keys or swipe.`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { swipe.current = null }}
      >
        {Array.from({ length: size * size }, (_, i) => <div key={i} className="mg-cell" />)}
        {cells.map(t => (
          <div
            key={t.id}
            className={`mg-tile${t.merged ? ' pop' : ''}${t.gone ? ' gone' : ''}`}
            style={{ left: `${t.c * pct}%`, top: `${t.r * pct}%`, width: `${pct}%`, height: `${pct}%` }}
          >
            <span style={tileStyle(t.v)} >{t.v}</span>
          </div>
        ))}
      </div>
      <div className="mg-pad" role="group" aria-label="Move tiles">
        {['left', 'up', 'down', 'right'].map(d => (
          <button key={d} className={`mg-${d}${hintDir === d ? ' hint' : ''}`} aria-label={`Slide ${d}`} onClick={() => play(d)}>
            {ARROW[d]}
          </button>
        ))}
      </div>
    </div>
  )
}
