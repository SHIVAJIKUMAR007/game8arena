import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { playSound } from '../../platform/sound'
import { PEERS, colOf, conflicts, digitCounts, generateLevel, hintCell, rowOf } from './logic'
import './SudokuGame.css'

export default function SudokuBoard({ level, seed, session }) {
  const p = useMemo(() => generateLevel(seed, level), [seed, level])
  return <Grid p={p} session={session} />
}

function Grid({ p, session }) {
  const [grid, setGrid] = useState(() => p.puzzle.slice())
  const [sel, setSel] = useState(() => p.puzzle.findIndex(n => n === 0))
  const [shake, setShake] = useState(-1)
  const [history, setHistory] = useState([]) // cells the player filled, oldest first
  const [msg, setMsg] = useState(null)

  const live = useRef({})
  useLayoutEffect(() => { live.current = { grid, sel, history } })
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const empties = grid.filter(n => n === 0).length
  useEffect(() => { session.setInfo({ label: 'Empty', value: `${empties}` }) }, [empties, session])

  const say = useCallback(text => { setMsg(text); session.announce(text) }, [session])
  const busy = () => session.locked

  const finishIfDone = next => {
    if (next.some(n => n === 0)) return
    say('Solved! Every row, column and box holds 1 to 9.')
    timers.current.push(setTimeout(() => session.win(), 400))
  }

  const place = useCallback(n => {
    if (busy()) return
    const { grid: g, sel: i } = live.current
    if (i < 0 || p.given[i]) { say('Pick an empty cell first.'); return }
    if (g[i] === n) return
    if (p.solution[i] !== n) {
      session.noteMove(false)
      setShake(i)
      timers.current.push(setTimeout(() => setShake(-1), 400))
      session.loseLife()
      say(`${n} doesn’t belong in row ${rowOf(i) + 1}, column ${colOf(i) + 1}.`)
      return
    }
    const next = g.slice()
    next[i] = n
    live.current.grid = next
    setGrid(next)
    setHistory(h => [...h.filter(x => x !== i), i])
    session.noteMove(true)
    playSound('tap', 1)
    say(`Placed ${n} in row ${rowOf(i) + 1}, column ${colOf(i) + 1}.`)
    finishIfDone(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, session, say])

  const erase = useCallback(() => {
    if (busy()) return
    const { grid: g, sel: i } = live.current
    if (i < 0 || p.given[i] || !g[i]) return
    const next = g.slice()
    next[i] = 0
    live.current.grid = next
    setGrid(next)
    setHistory(h => h.filter(x => x !== i))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p])

  const move = (dr, dc) => {
    const i = live.current.sel < 0 ? 0 : live.current.sel
    const r = Math.min(8, Math.max(0, rowOf(i) + dr))
    const c = Math.min(8, Math.max(0, colOf(i) + dc))
    live.current.sel = r * 9 + c
    setSel(r * 9 + c)
  }

  const onKeyDown = e => {
    if (e.key >= '1' && e.key <= '9') { e.preventDefault(); place(Number(e.key)) }
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { e.preventDefault(); erase() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1, 0) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(1, 0) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); move(0, -1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); move(0, 1) }
  }

  useEffect(() => {
    session.bindActions({
      hint() {
        if (busy()) return false
        const i = hintCell(live.current.grid)
        if (i < 0) return false
        const next = live.current.grid.slice()
        next[i] = p.solution[i]
        live.current.grid = next
        setGrid(next)
        setSel(i)
        say(`Hint: row ${rowOf(i) + 1}, column ${colOf(i) + 1} is ${p.solution[i]}.`)
        finishIfDone(next)
        return true
      },
      undo() {
        if (busy()) return false
        const h = live.current.history
        if (!h.length) return false
        const i = h[h.length - 1]
        const next = live.current.grid.slice()
        next[i] = 0
        live.current.grid = next
        setGrid(next)
        setHistory(h.slice(0, -1))
        setSel(i)
        say(`Removed the digit from row ${rowOf(i) + 1}, column ${colOf(i) + 1}.`)
        return true
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, p, say])

  const clash = useMemo(() => conflicts(grid), [grid])
  const counts = useMemo(() => digitCounts(grid), [grid])
  const selVal = sel >= 0 ? grid[sel] : 0
  const peers = useMemo(() => new Set(sel >= 0 ? PEERS[sel] : []), [sel])

  return (
    <div
      className="sd-root"
      role="group"
      tabIndex={0}
      aria-label="Sudoku: fill every row, column and 3 by 3 box with the digits 1 to 9. Arrow keys move, 1 to 9 place a digit, Backspace clears."
      onKeyDown={onKeyDown}
    >
      <div className="sd-grid" role="grid">
        {grid.map((n, i) => {
          const cls = [
            'sd-cell',
            p.given[i] ? 'given' : n ? 'mine' : '',
            i === sel ? 'sel' : peers.has(i) ? 'peer' : '',
            selVal && n === selVal && i !== sel ? 'same' : '',
            clash.has(i) ? 'clash' : '',
            shake === i ? 'shake' : '',
            colOf(i) % 3 === 2 && colOf(i) < 8 ? 'rb' : '',
            rowOf(i) % 3 === 2 && rowOf(i) < 8 ? 'bb' : '',
          ].filter(Boolean).join(' ')
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              className={cls}
              aria-label={`Row ${rowOf(i) + 1}, column ${colOf(i) + 1}: ${n || 'empty'}${p.given[i] ? ', given' : ''}`}
              aria-selected={i === sel}
              onClick={() => { live.current.sel = i; setSel(i) }}
            >
              {n || ''}
            </button>
          )
        })}
      </div>

      <div className="sd-pad">
        {Array.from({ length: 9 }, (_, k) => k + 1).map(n => (
          <button key={n} type="button" className="sd-key" onClick={() => place(n)} disabled={counts[n] >= 9} aria-label={`Place ${n}`}>
            {n}
          </button>
        ))}
        <button type="button" className="sd-key erase" onClick={erase} aria-label="Erase">⌫</button>
      </div>
      <p className="sd-msg">{msg || ' '}</p>
    </div>
  )
}
