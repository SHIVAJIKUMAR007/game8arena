import { useCallback, useEffect, useRef, useState } from 'react'
import { playSound } from '../../platform/sound'
import { generateLevel, hintFor } from './logic'
import './GodGame.css'

// Tap = discard (✕), double-tap = search. Keyboard: arrows move, Space / X discard, Enter / S search.
const DOUBLE_TAP_MS = 320
const ROW = r => `row ${r + 1}`
const COL = c => `column ${String.fromCharCode(65 + c)}`

export default function GodBoard({ level, seed, session }) {
  // 9×9 boards can take a few hundred ms to build: show the board after one paint.
  const [puzzle, setPuzzle] = useState(null)
  useEffect(() => {
    const t = setTimeout(() => setPuzzle(generateLevel(seed, level)), 30)
    return () => clearTimeout(t)
  }, [seed, level])
  if (!puzzle) return <div className="gd-root"><p className="gd-loading">Summoning the realms…</p></div>
  return <Realms puzzle={puzzle} session={session} />
}

function Realms({ puzzle, session }) {
  const { n, regions, gods, solution, target } = puzzle
  const wanted = gods[target]

  const [marks, setMarks] = useState(() => new Set())   // cells the player discarded
  const [empty, setEmpty] = useState(() => new Set())   // searched, nothing there
  const [found, setFound] = useState(() => new Map())   // realm → cell of a revealed god
  const [glow, setGlow] = useState(null)                // { cell, kind } hint / search flash
  const [msg, setMsg] = useState(null)
  const [won, setWon] = useState(false)

  const st = useRef({})
  st.current = { marks, empty, found, won }
  const history = useRef([])     // previous `marks` sets, for undo
  const lastTap = useRef({ cell: -1, at: 0 })
  const timers = useRef([])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useEffect(() => {
    session.setInfo({ label: 'Seeking', value: `${wanted.icon} ${wanted.name}` })
  }, [session, wanted])

  const say = useCallback((text, tone = 'info') => {
    setMsg({ text, tone })
    session.announce(text)
  }, [session])

  const flash = (cell, kind, ms = 2400) => {
    setGlow({ cell, kind })
    later(() => setGlow(g => (g && g.cell === cell ? null : g)), ms)
  }

  const where = i => `${ROW(Math.floor(i / n))}, ${COL(i % n)}`

  const toggleMark = useCallback(i => {
    const s = st.current
    if (session.locked || s.won || s.empty.has(i) || [...s.found.values()].includes(i)) return
    history.current.push(s.marks)
    const next = new Set(s.marks)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setMarks(next)
    playSound('tap')
  }, [session])

  const search = useCallback(i => {
    const s = st.current
    if (session.locked || s.won || s.empty.has(i)) return
    const realm = regions[i]
    if (solution[realm] !== i) {
      setEmpty(e => new Set(e).add(i))
      setMarks(m => { const x = new Set(m); x.delete(i); return x })
      flash(i, 'miss', 700)
      say(`Nothing under ${where(i)}. Your search costs a life.`, 'bad')
      session.noteMove(false)
      session.loseLife()
      return
    }
    if (realm === target) {
      setWon(true)
      setFound(f => new Map(f).set(realm, i))
      flash(i, 'win', 5000)
      say(`You found the God of ${wanted.name}! ${wanted.asker.split(' ').slice(1).join(' ')} is saved.`, 'good')
      session.noteMove(true)
      session.win()
      return
    }
    if (s.found.has(realm)) return
    const g = gods[realm]
    setFound(f => new Map(f).set(realm, i))
    setMarks(m => { const x = new Set(m); x.delete(i); return x })
    flash(i, 'miss', 900)
    say(`You disturbed the God of ${g.name} ${g.icon} — wrong god! It costs a life, but now you know where ${g.name} hides.`, 'bad')
    session.noteMove(false)
    session.loseLife()
  }, [session, regions, solution, target, gods, wanted, say]) // eslint-disable-line react-hooks/exhaustive-deps

  // One tap = discard (✕). A second tap on the same cell soon after = search instead.
  const onTap = i => {
    const now = performance.now()
    const t = lastTap.current
    if (t.cell === i && now - t.at < DOUBLE_TAP_MS) {
      lastTap.current = { cell: -1, at: 0 }
      // Take back the discard toggle the first tap made, then search.
      const prev = history.current.pop()
      if (prev) setMarks(prev)
      search(i)
      return
    }
    lastTap.current = { cell: i, at: now }
    toggleMark(i)
  }

  const onKey = (e, i) => {
    const r = Math.floor(i / n), c = i % n
    const move = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key]
    if (move) {
      e.preventDefault()
      const rr = Math.min(n - 1, Math.max(0, r + move[0])), cc = Math.min(n - 1, Math.max(0, c + move[1]))
      document.getElementById(`gd-cell-${rr * n + cc}`)?.focus()
    } else if (e.key === 'x') {
      e.preventDefault(); toggleMark(i)
    } else if (e.key === 'Enter' || e.key === 's') {
      e.preventDefault(); search(i)
    }
  }

  useEffect(() => {
    session.bindActions({
      hint() {
        const s = st.current
        if (session.locked || s.won) return false
        const h = hintFor(puzzle, new Set([...s.marks, ...s.empty]), s.found)
        if (h.type === 'wrongMark') {
          history.current.push(s.marks)
          setMarks(m => { const x = new Set(m); x.delete(h.cell); return x })
          flash(h.cell, 'hint')
          say(`You discarded ${where(h.cell)}, but a god could still hide there — mark removed.`)
          return true
        }
        if (h.type === 'clear') {
          history.current.push(s.marks)
          setMarks(m => new Set(m).add(h.cell))
          flash(h.cell, 'hint')
          say(explainClear(h, gods, regions, n, where))
          return true
        }
        flash(h.cell, 'hint', 4000)
        say(explainGod(h, gods, regions, n, where))
        return true
      },
      undo() {
        if (session.locked || st.current.won) return false
        const prev = history.current.pop()
        if (!prev) return false
        setMarks(prev)
        return true
      },
    })
  }, [session, puzzle, gods, regions, n, say]) // eslint-disable-line react-hooks/exhaustive-deps

  const godAt = new Map([...found].map(([realm, cell]) => [cell, gods[realm]]))

  return (
    <div className="gd-root">
      <div className="gd-wrap">
      <div className="gd-quest">
        <span><b className="gd-asker">{wanted.asker}:</b> <i className="gd-plea">“{wanted.plea}”</i></span>
        <span className="gd-need">Find the God of <b style={{ '--c': wanted.color }}>{wanted.icon} {wanted.name}</b> — hiding under the <b style={{ '--c': wanted.color }} className="gd-swatch" /> realm.</span>
      </div>

      <div className="gd-card">
      <div className="gd-board" style={{ '--n': n }} role="grid" aria-label={`${n} by ${n} realm board`}>
        {regions.map((realm, i) => {
          const g = godAt.get(i)
          const state = g ? 'god' : empty.has(i) ? 'empty' : marks.has(i) ? 'mark' : ''
          const cls = [
            'gd-cell', state,
            realm === target && 'target', glow?.cell === i && `glow-${glow.kind}`,
          ].filter(Boolean).join(' ')
          return (
            <button
              key={i} id={`gd-cell-${i}`} className={cls} role="gridcell"
              style={{ '--c': gods[realm].color }}
              aria-label={`${where(i)}, ${gods[realm].name} realm${g ? `, God of ${g.name}` : state === 'empty' ? ', searched, empty' : state === 'mark' ? ', discarded' : ''}`}
              tabIndex={i === 0 ? 0 : -1}
              // detail 0 = keyboard Space / screen reader activation: just discard.
              onClick={e => (e.detail === 0 ? toggleMark(i) : onTap(i))}
              onKeyDown={e => onKey(e, i)}
            >
              {g ? g.icon : state === 'empty' ? '·' : state === 'mark' ? '✕' : ''}
            </button>
          )
        })}
      </div>

      <p className={`gd-msg ${msg ? msg.tone : 'idle'}`} aria-hidden="true">{msg?.text || ' '}</p>
      </div>

      <div className="gd-info">
      <ul className="gd-legend" aria-label="Realms">
        {gods.map((g, k) => (
          <li key={g.id} className={k === target ? 'wanted' : ''} style={{ '--c': g.color }}>
            <span className="gd-dot" />{g.icon} {g.name}
          </li>
        ))}
      </ul>
      <p className="gd-controls">Tap once to discard a cell (✕) · Double-tap to search it</p>
      </div>
      </div>
    </div>
  )
}

function unitName(u, gods) {
  if (!u) return ''
  if (u.kind === 'row') return ROW(u.k)
  if (u.kind === 'col') return COL(u.k)
  return `the ${gods[u.k].name} realm`
}

function explainClear(h, gods, regions, n, where) {
  const u = h.unit
  if (!u) return `No god can hide at ${where(h.cell)}.`
  if (u.kind === 'band') {
    const lines = u.from === u.to ? `${u.axis === 'row' ? ROW(u.from) : COL(u.from)}`
      : `${u.axis === 'row' ? 'rows' : 'columns'} ${u.axis === 'row' ? `${u.from + 1}–${u.to + 1}` : `${String.fromCharCode(65 + u.from)}–${String.fromCharCode(65 + u.to)}`}`
    const names = u.realms.map(k => gods[k].name).join(', ')
    return `The ${names} realm${u.realms.length > 1 ? 's' : ''} only fit${u.realms.length > 1 ? '' : 's'} in ${lines}, so they claim ${u.realms.length > 1 ? 'those lines' : 'that line'}: ${where(h.cell)} is discarded.`
  }
  return `A god at ${where(h.cell)} would leave ${unitName(u, gods)} with nowhere to hide — discarded.`
}

function explainGod(h, gods, regions) {
  const g = gods[regions[h.cell]]
  const u = h.unit
  return u
    ? `Only one place is left in ${unitName(u, gods)}: the God of ${g.name} ${g.icon} must hide in the glowing cell.`
    : `The God of ${g.name} ${g.icon} hides in the glowing cell.`
}
