import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Modal from '../../platform/ui/Modal'
import { track } from '../../platform/analytics'
import { vibrate } from '../../platform/haptics'
import { getProgress, updateProgress, useProgress } from '../../platform/progress'
import { createRng } from '../../platform/rng'
import { prefersReducedMotion, updateSettings, useSettings } from '../../platform/settings'
import { useStore } from '../../platform/storage'
import { sfx, unlockAudio } from './audio'
import {
  SIZE,
  canPlace,
  fitsAnywhere,
  findFullLines,
  findPlacement,
  holdFromTray,
  levelProgress,
  newGame,
  placeCells,
  playPiece,
  rerollTray,
  targetForLevel,
} from './logic'
import { THEME_NAMES, blockyStore, clearSavedGame, loadSavedGame, saveGame, setTheme } from './store'
import './BlockyGame.css'

const GAME_ID = 'blocky'
const key = (r, c) => `${r},${c}`

// ───────────── small view pieces ─────────────
/** A piece drawn at a given cell size (px). The same tile style is used on the board, tray, hold slot and while dragging. */
function PieceView({ piece, cell }) {
  const gap = Math.max(1, Math.round(cell * 0.08))
  return (
    <div
      className="bb-piece"
      style={{
        '--cell': `${cell}px`,
        gridTemplateColumns: `repeat(${piece.w}, ${cell}px)`,
        gridTemplateRows: `repeat(${piece.h}, ${cell}px)`,
        gap,
      }}
    >
      {piece.cells.map(([r, c]) => (
        <div key={key(r, c)} className="bb-tile" style={{ gridRow: r + 1, gridColumn: c + 1, '--c': piece.color }} />
      ))}
    </div>
  )
}

/** Eases a number toward its target so the score counts up instead of jumping. */
function useCountUp(target) {
  const [shown, setShown] = useState(target)
  const shownRef = useRef(target)
  useEffect(() => {
    if (prefersReducedMotion() || target < shownRef.current) {
      shownRef.current = target
      setShown(target)
      return undefined
    }
    const from = shownRef.current
    const t0 = performance.now()
    let raf
    const step = now => {
      const k = Math.min(1, (now - t0) / 450)
      const v = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)))
      shownRef.current = v
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return shown
}

const Icon = {
  trophy: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path d="M7 3h10v4a5 5 0 0 1-10 0V3Z" fill="#ffd31a" />
      <path d="M7 4H3v2a4 4 0 0 0 4 4M17 4h4v2a4 4 0 0 1-4 4" fill="none" stroke="#ffd31a" strokeWidth="2" />
      <path d="M11 12h2v4h3v3H8v-3h3z" fill="#ffb300" />
    </svg>
  ),
  swap: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h14l-3-3M20 16H6l3 3" />
    </svg>
  ),
  palette: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20c1.4 0 2-1 1.6-2-.5-1.3.2-2.6 1.7-2.6H18a4 4 0 0 0 4-4C22 6.5 17.5 2 12 2Z" fill="#f5f7ff" />
      <circle cx="7.5" cy="11" r="1.7" fill="#ff3fa4" />
      <circle cx="11" cy="6.8" r="1.7" fill="#1e6bff" />
      <circle cx="16" cy="7.5" r="1.7" fill="#3ddc5a" />
      <circle cx="7.8" cy="16" r="1.7" fill="#ff9a00" />
    </svg>
  ),
  gear: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" fill="none" stroke="#f5f7ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  ),
}

// ───────────── the game ─────────────
export default function BlockyGame() {
  const [rng] = useState(() => createRng((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0))
  const [game, setGame] = useState(() => loadSavedGame() ?? newGame(rng))
  const gameRef = useRef(game)
  gameRef.current = game

  const progress = useProgress(GAME_ID)
  const settings = useSettings()
  const { theme } = useStore(blockyStore)
  const best = Math.max(progress.highScore, 0)
  const bestAtStart = useRef(getProgress(GAME_ID).highScore)

  const rootRef = useRef(null)
  const gridRef = useRef(null)
  const holdRef = useRef(null)
  const trayRefs = useRef([])
  const timers = useRef(new Set())
  const fxId = useRef(0)

  const [cell, setCell] = useState(36)
  const [drag, setDrag] = useState(null)
  const dragRef = useRef(null)
  const [fly, setFly] = useState(null)
  const [kbd, setKbd] = useState(null) // keyboard placement: { src, r, c }
  const [fx, setFx] = useState([]) // cosmetic effects: clearing cells, particles, popups, banners
  const [pops, setPops] = useState(() => new Set())
  const [shake, setShake] = useState(false)
  const [showOver, setShowOver] = useState(false)
  const [modal, setModal] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [note, setNote] = useState('')

  const later = useCallback((fn, ms) => {
    const t = setTimeout(() => {
      timers.current.delete(t)
      fn()
    }, ms)
    timers.current.add(t)
    return t
  }, [])
  useEffect(() => {
    const all = timers.current
    return () => all.forEach(clearTimeout)
  }, [])

  // Size everything from the space we are given: a square board that leaves room for the bar, hold row and tray.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return undefined
    const fit = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (!w || !h) return
      setCell(Math.max(18, Math.min(58, Math.floor(Math.min((w - 20) / 8.9, (h - 14) / 16.3)))))
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Touch scrolling must never steal a drag: React's own touch listeners are passive, so block it here.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return undefined
    const stop = e => {
      if (e.cancelable && (dragRef.current || (e.type === 'touchstart' && e.target.closest?.('.bb-slotpiece')))) e.preventDefault()
    }
    el.addEventListener('touchstart', stop, { passive: false })
    el.addEventListener('touchmove', stop, { passive: false })
    return () => {
      el.removeEventListener('touchstart', stop)
      el.removeEventListener('touchmove', stop)
    }
  }, [])

  // Save after every move; a finished game is not resumed. Best score and level feed the shared progress card.
  useEffect(() => {
    if (game.over) clearSavedGame()
    else saveGame(game)
    updateProgress(GAME_ID, p => {
      const highScore = Math.max(p.highScore, game.score)
      const bestLevel = Math.max(p.best, game.level - 1)
      return highScore === p.highScore && bestLevel === p.best ? p : { ...p, highScore, best: bestLevel }
    })
  }, [game])

  const score = useCountUp(game.score)

  // ── effects ──
  const addFx = useCallback(
    (item, ms) => {
      const id = ++fxId.current
      setFx(list => [...list, { ...item, id }])
      later(() => setFx(list => list.filter(f => f.id !== id)), ms)
    },
    [later]
  )

  const celebrate = useCallback(
    (move, prev, next) => {
      const calm = prefersReducedMotion()
      sfx('place')
      vibrate(10)
      const placed = new Set(move.piece.cells.map(([dr, dc]) => key(move.r + dr, move.c + dc)))
      setPops(placed)
      later(() => setPops(new Set()), 280)

      if (move.lineCount > 0) {
        const combo = next.streak
        sfx('clear', combo)
        vibrate(move.lineCount >= 3 ? [20, 30, 40] : 25)
        const cx = move.r + (move.piece.h - 1) / 2
        const cy = move.c + (move.piece.w - 1) / 2
        let sumR = 0
        let sumC = 0
        move.cleared.forEach(({ r, c, color }, i) => {
          sumR += r
          sumC += c
          const delay = Math.round(Math.hypot(r - cx, c - cy) * 38)
          addFx({ kind: 'cell', r, c, color, delay }, 900 + delay)
          if (!calm && i % 2 === 0) {
            for (let p = 0; p < 3; p++) {
              const a = Math.random() * Math.PI * 2
              const d = 0.7 + Math.random() * 1.3
              addFx({ kind: 'part', r, c, color, delay: delay + 80, dx: Math.cos(a) * d, dy: Math.sin(a) * d }, 900 + delay)
            }
          }
        })
        const n = move.cleared.length || 1
        addFx({ kind: 'score', text: `+${move.points.bonus + move.points.perfect}`, r: sumR / n, c: sumC / n }, 1100)
        if (combo >= 2) addFx({ kind: 'combo', text: `COMBO x${combo}` }, 1200)
        if (move.perfect) {
          addFx({ kind: 'banner', text: 'PERFECT!' }, 1700)
          setNote('Perfect clear')
        }
        if (move.lineCount >= 3 && !calm) {
          setShake(true)
          later(() => setShake(false), 450)
        }
        setNote(`${move.lineCount} ${move.lineCount === 1 ? 'line' : 'lines'} cleared, plus ${move.points.total} points`)
      }

      if (move.levelsGained > 0) {
        later(() => sfx('levelUp'), 350)
        addFx({ kind: 'toast', text: 'Level Up!', sub: `Level ${next.level}` }, 1900)
        setNote(`Level up. Now level ${next.level}. Extra re-roll earned`)
      }

      if (next.over) {
        const finalBest = Math.max(bestAtStart.current, prev.score)
        track('blocky_game_over', { score: next.score, level: next.level, newBest: next.score > finalBest })
        later(() => {
          sfx('gameOver')
          vibrate([60, 40, 80])
          setShowOver(true)
        }, move.lineCount > 0 ? 900 : 500)
      }
    },
    [addFx, later]
  )

  // ── actions ──
  const doPlay = useCallback(
    (src, r, c) => {
      const prev = gameRef.current
      const res = playPiece(prev, src, r, c, rng)
      if (!res.ok) return false
      setGame(res.state)
      setKbd(null)
      celebrate(res.move, prev, res.state)
      return true
    },
    [celebrate, rng]
  )

  const doHold = useCallback(
    index => {
      const prev = gameRef.current
      const next = holdFromTray(prev, index, rng)
      if (next === prev) return
      setGame(next)
      setKbd(null)
      sfx('pick')
      vibrate(8)
      setNote('Piece held')
      if (next.over) later(() => setShowOver(true), 400)
    },
    [later, rng]
  )

  const doReroll = () => {
    unlockAudio()
    const prev = gameRef.current
    const next = rerollTray(prev, rng)
    if (next === prev) return
    setGame(next)
    sfx('pick')
    setNote(`New pieces. ${next.rerolls} re-rolls left`)
    if (next.over) later(() => setShowOver(true), 400)
  }

  const startNew = () => {
    setGame(newGame(rng))
    setShowOver(false)
    setModal(null)
    setConfirmReset(false)
    setFx([])
    setKbd(null)
    bestAtStart.current = getProgress(GAME_ID).highScore
    setNote('New game')
  }

  // ── pointer drag and drop ──
  const measure = useCallback(() => {
    const root = rootRef.current.getBoundingClientRect()
    const grid = gridRef.current.getBoundingClientRect()
    const hold = holdRef.current.getBoundingClientRect()
    return {
      root,
      pitch: grid.width / SIZE,
      gx: grid.left - root.left,
      gy: grid.top - root.top,
      hold: { l: hold.left - root.left, t: hold.top - root.top, r: hold.right - root.left, b: hold.bottom - root.top },
    }
  }, [])

  const aimFrom = useCallback(
    (d, x, y) => {
      const m = measure()
      const cy = y - (d.touch ? 1.5 : 0.5) * m.pitch
      const left = x - (d.piece.w * m.pitch) / 2
      const top = cy - (d.piece.h * m.pitch) / 2
      const c = Math.round((left - m.gx) / m.pitch)
      const r = Math.round((top - m.gy) / m.pitch)
      const pad = m.pitch * 0.3
      const inHold = (px, py) => px > m.hold.l - pad && px < m.hold.r + pad && py > m.hold.t - pad && py < m.hold.b + pad
      return {
        ...d,
        x,
        y,
        cy,
        pitch: m.pitch,
        r,
        c,
        valid: canPlace(gameRef.current.board, d.piece.cells, r, c),
        overHold: d.src.type === 'tray' && (inHold(x, y) || inHold(x, cy)),
      }
    },
    [measure]
  )

  const pieceOf = (g, src) => (src.type === 'hold' ? g.hold : g.tray[src.index])

  const onSlotDown = (e, src) => {
    const g = gameRef.current
    const piece = pieceOf(g, src)
    if (!piece || g.over || dragRef.current || fly) return
    if (e.button !== undefined && e.button > 0) return
    e.preventDefault()
    unlockAudio()
    try {
      rootRef.current.setPointerCapture(e.pointerId)
    } catch {
      /* capture is a nicety */
    }
    const root = rootRef.current.getBoundingClientRect()
    const d = aimFrom({ src, piece, pointerId: e.pointerId, touch: e.pointerType !== 'mouse' }, e.clientX - root.left, e.clientY - root.top)
    dragRef.current = d
    setDrag(d)
    setKbd(null)
    sfx('pick')
    vibrate(5)
  }

  const onMove = e => {
    const d = dragRef.current
    if (!d || e.pointerId !== d.pointerId) return
    const root = rootRef.current.getBoundingClientRect()
    const next = aimFrom(d, e.clientX - root.left, e.clientY - root.top)
    dragRef.current = next
    setDrag(next)
  }

  const flyBack = useCallback(
    d => {
      const slot = d.src.type === 'hold' ? holdRef.current : trayRefs.current[d.src.index]
      const root = rootRef.current.getBoundingClientRect()
      const rect = slot.getBoundingClientRect()
      const scale = trayCellFor(d.piece, d.src.type === 'hold', cell) / d.pitch
      const toLeft = rect.left - root.left + rect.width / 2 - (d.piece.w * d.pitch * scale) / 2
      const toTop = rect.top - root.top + rect.height / 2 - (d.piece.h * d.pitch * scale) / 2
      setFly({ piece: d.piece, src: d.src, pitch: d.pitch, from: { left: d.x - (d.piece.w * d.pitch) / 2, top: d.cy - (d.piece.h * d.pitch) / 2 }, to: { left: toLeft, top: toTop, scale }, go: false })
      requestAnimationFrame(() => requestAnimationFrame(() => setFly(f => (f ? { ...f, go: true } : f))))
      later(() => setFly(null), 260)
    },
    [cell, later]
  )

  const finishDrag = (e, cancelled) => {
    const d = dragRef.current
    if (!d || (e && e.pointerId !== d.pointerId)) return
    dragRef.current = null
    setDrag(null)
    try {
      rootRef.current.releasePointerCapture(d.pointerId)
    } catch {
      /* already released */
    }
    if (!cancelled && d.valid && doPlay(d.src, d.r, d.c)) return
    if (!cancelled && d.overHold) {
      doHold(d.src.index)
      return
    }
    if (!cancelled) {
      sfx('error')
      vibrate(15)
    }
    flyBack(d)
  }

  // ── keyboard play: Enter picks up, arrows move, Enter places, H holds, Escape cancels ──
  const onSlotKey = (e, src) => {
    const g = gameRef.current
    const piece = pieceOf(g, src)
    if (!piece || g.over) return
    const same = kbd && kbd.src.type === src.type && kbd.src.index === src.index
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      unlockAudio()
      if (same) {
        if (!doPlay(src, kbd.r, kbd.c)) {
          sfx('error')
          setNote('That spot is not free')
        }
      } else {
        const spot = findPlacement(g.board, piece.cells) ?? { r: 0, c: 0 }
        setKbd({ src, r: spot.r, c: spot.c })
        setNote(`Piece picked up. Use the arrow keys to move it and Enter to place it`)
      }
    } else if (same && e.key.startsWith('Arrow')) {
      e.preventDefault()
      const dr = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
      const dc = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      setKbd(k => ({ ...k, r: Math.max(0, Math.min(SIZE - piece.h, k.r + dr)), c: Math.max(0, Math.min(SIZE - piece.w, k.c + dc)) }))
    } else if (same && e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setKbd(null)
    } else if ((e.key === 'h' || e.key === 'H') && src.type === 'tray') {
      e.preventDefault()
      doHold(src.index)
    }
  }

  // ── what the board shows while aiming ──
  const kbdPiece = kbd ? pieceOf(game, kbd.src) : null
  const aim = drag ?? (kbdPiece ? { piece: kbdPiece, r: kbd.r, c: kbd.c, valid: canPlace(game.board, kbdPiece.cells, kbd.r, kbd.c) } : null)
  const preview = useMemo(() => {
    if (!aim || !aim.piece || !aim.valid) return null
    const ghost = new Map(aim.piece.cells.map(([dr, dc]) => [key(aim.r + dr, aim.c + dc), aim.piece.color]))
    const after = placeCells(game.board, aim.piece.cells, aim.r, aim.c, aim.piece.color)
    const { rows, cols } = findFullLines(after)
    const hl = new Set()
    for (const r of rows) for (let c = 0; c < SIZE; c++) hl.add(key(r, c))
    for (const c of cols) for (let r = 0; r < SIZE; r++) hl.add(key(r, c))
    return { ghost, hl, color: aim.piece.color }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aim?.piece, aim?.r, aim?.c, aim?.valid, game.board])

  const lifted = drag?.src ?? fly?.src ?? null
  const isLifted = src => lifted && lifted.type === src.type && lifted.index === src.index
  const progressPct = Math.round(levelProgress(game.score, game.level) * 100)
  const newBest = game.score > bestAtStart.current && game.score > 0
  const floatDrag = drag
    ? { left: drag.x - (drag.piece.w * drag.pitch) / 2, top: drag.cy - (drag.piece.h * drag.pitch) / 2, scale: 1, pitch: drag.pitch, piece: drag.piece }
    : null

  const cells = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const k = key(r, c)
      const color = game.board[r][c]
      const ghost = preview?.ghost.get(k)
      const hl = preview?.hl.has(k)
      cells.push(
        <div
          key={k}
          className={`bb-cell${color ? ' on' : ''}${ghost ? ' ghost' : ''}${hl ? ' hl' : ''}${pops.has(k) ? ' pop' : ''}`}
          style={{ '--c': ghost || color || undefined, '--pc': preview?.color }}
        />
      )
    }
  }

  return (
    <div
      ref={rootRef}
      className={`bb-root${shake ? ' shake' : ''}`}
      data-theme={theme}
      style={{ '--cell': `${cell}px` }}
      onPointerMove={onMove}
      onPointerUp={e => finishDrag(e, false)}
      onPointerCancel={e => finishDrag(e, true)}
    >
      <div className="bb-top">
        <div className="bb-best" title="Best score">
          <span className="bb-trophy">{Icon.trophy}</span>
          <span aria-label={`Best score ${best}`}>{best}</span>
        </div>
        <div className="bb-scorebox">
          <div className="bb-score" aria-label={`Score ${game.score}`}>{score}</div>
          <div className="bb-bar" role="progressbar" aria-label={`Level ${game.level} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}>
            <i style={{ width: `${progressPct}%` }} />
            <span className="bb-level">Level {game.level}</span>
            <span className="bb-target">{targetForLevel(game.level)}</span>
          </div>
        </div>
        <div className="bb-icons">
          <button className="bb-ibtn" aria-label={`Change colour theme (${THEME_NAMES[theme]})`} onClick={() => setTheme(theme + 1)}>{Icon.palette}</button>
          <button className="bb-ibtn" aria-label="Settings" onClick={() => setModal('settings')}>{Icon.gear}</button>
        </div>
      </div>

      <div className="bb-board">
        <div ref={gridRef} className="bb-grid" role="img" aria-label="8 by 8 game board">{cells}</div>
        <div className="bb-fxlayer" aria-hidden="true">
          {fx.map(f => {
            if (f.kind === 'cell')
              return <div key={f.id} className="bb-fxcell" style={{ left: `${f.c * 12.5}%`, top: `${f.r * 12.5}%`, '--c': f.color, animationDelay: `${f.delay}ms` }}><i /></div>
            if (f.kind === 'part')
              return <div key={f.id} className="bb-part" style={{ left: `${f.c * 12.5 + 6.25}%`, top: `${f.r * 12.5 + 6.25}%`, '--c': f.color, '--dx': `${f.dx * cell}px`, '--dy': `${f.dy * cell}px`, animationDelay: `${f.delay}ms` }} />
            if (f.kind === 'score')
              return <div key={f.id} className="bb-popup" style={{ left: `${f.c * 12.5 + 6.25}%`, top: `${f.r * 12.5 + 6.25}%` }}>{f.text}</div>
            return null
          })}
        </div>
        {fx.map(f =>
          f.kind === 'combo' ? <div key={f.id} className="bb-combo" aria-hidden="true">{f.text}</div>
          : f.kind === 'banner' ? <div key={f.id} className="bb-banner" aria-hidden="true">{f.text}</div>
          : f.kind === 'toast' ? <div key={f.id} className="bb-toast" aria-hidden="true"><b>{f.text}</b><span>{f.sub}</span></div>
          : null
        )}
        {game.over && <div className="bb-dim" />}
      </div>

      <div className="bb-row">
        <button className="bb-reroll" onClick={doReroll} disabled={game.rerolls <= 0 || game.over} aria-label={`Re-roll the pieces in the tray, ${game.rerolls} left`}>
          <span className="bb-swap">{Icon.swap}</span>
          <b>{game.rerolls}</b>
        </button>
        <div
          ref={holdRef}
          className={`bb-hold${drag?.overHold ? ' target' : ''}`}
          role="group"
          aria-label={game.hold ? 'Hold slot, one piece stored' : 'Hold slot, empty'}
        >
          {game.hold && (
            <div
              className={`bb-slotpiece${isLifted({ type: 'hold' }) ? ' lifted' : ''}${kbd?.src.type === 'hold' ? ' kbd' : ''}${fitsAnywhere(game.board, game.hold.cells) ? '' : ' dim'}`}
              role="button"
              tabIndex={0}
              aria-label="Held piece. Press Enter to pick it up"
              onPointerDown={e => onSlotDown(e, { type: 'hold' })}
              onKeyDown={e => onSlotKey(e, { type: 'hold' })}
              onBlur={() => kbd?.src.type === 'hold' && setKbd(null)}
            >
              <PieceView piece={game.hold} cell={trayCellFor(game.hold, true, cell)} />
            </div>
          )}
        </div>
      </div>

      <div className="bb-tray" role="group" aria-label="Pieces to place">
        {game.tray.map((p, i) => {
          const src = { type: 'tray', index: i }
          return (
            <div key={i} ref={el => (trayRefs.current[i] = el)} className="bb-slot">
              {p && (
                <div
                  className={`bb-slotpiece${isLifted(src) ? ' lifted' : ''}${kbd?.src.type === 'tray' && kbd.src.index === i ? ' kbd' : ''}${fitsAnywhere(game.board, p.cells) ? '' : ' dim'}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Piece ${i + 1} of 3. Press Enter to pick it up, then arrow keys to move and Enter to place. Press H to hold it`}
                  onPointerDown={e => onSlotDown(e, src)}
                  onKeyDown={e => onSlotKey(e, src)}
                  onBlur={() => kbd?.src.type === 'tray' && kbd.src.index === i && setKbd(null)}
                >
                  <PieceView piece={p} cell={trayCellFor(p, false, cell)} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {(floatDrag || fly) && (() => {
        const f = floatDrag ?? { ...(fly.go ? fly.to : fly.from), pitch: fly.pitch, piece: fly.piece, scale: fly.go ? fly.to.scale : 1 }
        return (
          <div
            className={`bb-float${fly ? ' flying' : ''}`}
            style={{ transform: `translate(${f.left}px, ${f.top}px) scale(${f.scale})` }}
            aria-hidden="true"
          >
            <div className="bb-grow"><PieceView piece={f.piece} cell={f.pitch} /></div>
          </div>
        )
      })()}

      <div className="sr-only" role="status" aria-live="polite">{note}</div>

      {showOver && (
        <div className="bb-over" role="dialog" aria-modal="true" aria-label="Game over">
          <div className="bb-card">
            <h2>Game Over</h2>
            {newBest && <p className="bb-newbest">New Best!</p>}
            <dl>
              <div><dt>Score</dt><dd>{game.score}</dd></div>
              <div><dt>Best</dt><dd>{Math.max(best, game.score)}</dd></div>
              <div><dt>Level</dt><dd>{game.level}</dd></div>
            </dl>
            <button className="bb-play" autoFocus onClick={startNew}>Play Again</button>
          </div>
        </div>
      )}

      {modal === 'settings' && (
        <Modal title="Settings" onClose={() => { setModal(null); setConfirmReset(false) }}>
          <label className="st-row">
            <span>Sound</span>
            <input type="checkbox" checked={settings.sound} onChange={e => updateSettings({ sound: e.target.checked })} />
          </label>
          <label className="st-row">
            <span>Vibration (mobile)</span>
            <input type="checkbox" checked={settings.haptics} onChange={e => updateSettings({ haptics: e.target.checked })} />
          </label>
          <div className="st-row">
            <span>Best score ({best})</span>
            <button
              className="st-danger"
              onClick={() => {
                if (!confirmReset) return setConfirmReset(true)
                updateProgress(GAME_ID, p => ({ ...p, highScore: 0 }))
                bestAtStart.current = 0
                setConfirmReset(false)
              }}
            >
              {confirmReset ? 'Tap again to reset' : 'Reset best score'}
            </button>
          </div>
          <div className="st-row">
            <span>Current game</span>
            <button className="lg-btn small" onClick={startNew}>New Game</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/** Pixel size of one cell for a piece in the tray (or the smaller hold slot): about 60% of a board cell, shrunk to fit. */
function trayCellFor(piece, inHold, cell) {
  const [maxW, maxH] = inHold ? [1.9, 1.3] : [2.5, 2.3]
  return Math.max(6, Math.floor(cell * Math.min(0.6, maxW / piece.w, maxH / piece.h)))
}
