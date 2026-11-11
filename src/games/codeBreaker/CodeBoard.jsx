import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { playSound } from '../../platform/sound'
import {
  COLOR_NAMES, EXTRA_ATTEMPTS, brokenClue, describeCode, generateLevel, hintSpot, possibleCount, score,
} from './logic'
import './CodeGame.css'

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function Peg({ c, small }) {
  if (c == null) return <span className={`cb-peg empty${small ? ' small' : ''}`} aria-hidden="true" />
  return <span className={`cb-peg c${c}${small ? ' small' : ''}`} aria-hidden="true">{c + 1}</span>
}

function Keys({ exact, close, length }) {
  return (
    <span className="cb-keys" style={{ '--cols': Math.ceil(length / 2) }} aria-hidden="true">
      {Array.from({ length }, (_, i) => (
        <span key={i} className={`cb-key${i < exact ? ' exact' : i < exact + close ? ' close' : ''}`} />
      ))}
    </span>
  )
}

export default function CodeBoard({ level, seed, session }) {
  const puzzle = useMemo(() => generateLevel(seed, level), [seed, level])
  return <Breaker p={puzzle} session={session} />
}

function Breaker({ p, session }) {
  const blank = useCallback(rev => Array.from({ length: p.length }, (_, i) => (rev.has(i) ? rev.get(i) : null)), [p])
  const [rows, setRows] = useState([])            // { guess, exact, close, broke, refunded }
  const [revealed, setRevealed] = useState(() => new Map())
  const [draft, setDraft] = useState(() => blank(new Map()))
  const [slot, setSlot] = useState(0)
  const [allowed, setAllowed] = useState(p.attempts)
  const [won, setWon] = useState(false)
  const [msg, setMsg] = useState(null)

  const live = useRef({})
  useLayoutEffect(() => { live.current = { rows, revealed, draft, slot, allowed, won } })
  const timers = useRef([])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const currentRef = useRef(null)

  const used = rows.filter(r => !r.refunded).length
  const left = allowed - used
  const possible = useMemo(() => possibleCount(p, rows, revealed), [p, rows, revealed])

  useEffect(() => { session.setInfo({ label: 'Attempts', value: `${left}` }) }, [left, session])
  useEffect(() => { currentRef.current?.scrollIntoView?.({ block: 'nearest' }) }, [rows.length])

  const say = useCallback(text => { setMsg(text); session.announce(text) }, [session])
  const busy = () => session.locked || live.current.won

  /** The next empty, unrevealed spot after `from` (wrapping), or `from` if none. */
  const nextFree = (d, rev, from) => {
    for (let k = 1; k <= p.length; k++) {
      const i = (from + k) % p.length
      if (d[i] == null && !rev.has(i)) return i
    }
    return from
  }

  const place = useCallback(c => {
    if (busy()) return
    const { draft: d, slot: s, revealed: rev } = live.current
    const at = rev.has(s) ? nextFree(d, rev, s) : s
    if (rev.has(at)) return
    const next = d.slice()
    next[at] = c
    const ns = nextFree(next, rev, at)
    live.current.draft = next
    live.current.slot = ns
    setDraft(next)
    setSlot(ns)
    playSound('note', 330 * Math.pow(2, c / 8))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, session])

  const clearSpot = useCallback(() => {
    if (busy()) return
    const { draft: d, slot: s, revealed: rev } = live.current
    let at = s
    if (d[at] == null || rev.has(at)) {
      // Nothing here: step back to the previous filled spot.
      for (let k = 1; k < p.length; k++) {
        const i = (s - k + p.length) % p.length
        if (d[i] != null && !rev.has(i)) { at = i; break }
      }
    }
    if (d[at] == null || rev.has(at)) return
    const next = d.slice()
    next[at] = null
    live.current.draft = next
    live.current.slot = at
    setDraft(next)
    setSlot(at)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, session])

  const pickSpot = i => {
    if (busy() || live.current.revealed.has(i)) return
    live.current.slot = i
    setSlot(i)
  }

  const submit = useCallback(() => {
    if (busy()) return
    const { draft: d, rows: rs, revealed: rev, allowed: al } = live.current
    if (d.some(x => x == null)) { say(`Fill all ${p.length} spots first.`); return }
    const guess = d.slice()
    const s = score(p.code, guess)
    const broke = brokenClue(p, rs, rev, guess)
    const nextRows = [...rs, { guess, ...s, broke, refunded: false }]
    setRows(nextRows)
    live.current.rows = nextRows
    const fresh = blank(rev)
    setDraft(fresh)
    setSlot(nextFree(fresh, rev, p.length - 1))
    live.current.draft = fresh

    if (s.exact === p.length) {
      live.current.won = true
      setWon(true)
      session.noteMove(true)
      say(`Cracked it in ${plural(nextRows.length, 'guess', 'guesses')}! The code was ${describeCode(p.code)}.`)
      later(() => session.win(), 500)
      return
    }

    session.noteMove(broke === -1)
    const clue = `${plural(s.exact, 'exact')}, ${s.close} close`
    let text = broke === -1
      ? `${clue}.`
      : broke === -2
        ? `${clue}. That guess couldn’t be the code: ${p.repeats ? 'it doesn’t match a revealed spot' : 'colours don’t repeat on this level'}.`
        : `${clue}. That guess couldn’t be the code: row ${broke + 1}’s clue already ruled it out.`

    const usedNow = nextRows.filter(r => !r.refunded).length
    if (usedNow >= al) {
      const more = al + EXTRA_ATTEMPTS
      live.current.allowed = more
      setAllowed(more)
      const lives = session.loseLife()
      if (lives > 0) text += ` Out of attempts! You lost a 💧 and got ${EXTRA_ATTEMPTS} more.`
    } else {
      playSound(s.exact ? 'combo' : 'tap', s.exact * 3)
    }
    say(text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, session, say, blank])

  const onKeyDown = e => {
    const n = Number(e.key)
    if (Number.isInteger(n) && n >= 1 && n <= p.colors) { e.preventDefault(); place(n - 1) }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); clearSpot() }
    else if (e.key === 'Enter') { e.preventDefault(); submit() }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const dir = e.key === 'ArrowLeft' ? -1 : 1
      const { slot: s, revealed: rev } = live.current
      for (let k = 1; k <= p.length; k++) {
        const i = s + dir * k
        if (i < 0 || i >= p.length) break
        if (!rev.has(i)) { pickSpot(i); break }
      }
    }
  }

  useEffect(() => {
    session.bindActions({
      hint() {
        if (busy()) return false
        const { revealed: rev, draft: d } = live.current
        const i = hintSpot(p, rev)
        if (i < 0) return false
        const nextRev = new Map(rev).set(i, p.code[i])
        const nextDraft = d.slice()
        nextDraft[i] = p.code[i]
        live.current.revealed = nextRev
        live.current.draft = nextDraft
        setRevealed(nextRev)
        setDraft(nextDraft)
        if (live.current.slot === i) setSlot(nextFree(nextDraft, nextRev, i))
        say(`Hint: spot ${i + 1} is ${COLOR_NAMES[p.code[i]]} ${p.code[i] + 1}.`)
        return true
      },
      undo() {
        // Forgive a guess that broke an earlier clue: the attempt comes back; its row (and clue) stays.
        if (busy()) return false
        const rs = live.current.rows
        const last = rs.findLastIndex(r => !r.refunded)
        if (last < 0 || rs[last].broke === -1) {
          say('Undo only refunds a guess that couldn’t have been the code.')
          return false
        }
        const nextRows = rs.map((r, i) => (i === last ? { ...r, refunded: true } : r))
        live.current.rows = nextRows
        setRows(nextRows)
        say(`Row ${last + 1} refunded: you get that attempt back. Its clue still counts.`)
        return true
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, p, say])

  const full = draft.every(x => x != null)
  const pending = Math.max(0, left - (won ? 0 : 1))

  return (
    <div
      className="cb-root"
      role="group"
      tabIndex={0}
      aria-label={`Code Breaker: find a ${p.length}-spot code from ${p.colors} colours numbered 1 to ${p.colors}${p.repeats ? ', colours can repeat' : ', no repeats'}. Number keys place a colour, arrows pick a spot, Backspace clears, Enter checks.`}
      onKeyDown={onKeyDown}
    >
      <p className="cb-goal">
        Attempts left <strong>{left}</strong> · Possible codes <strong>{possible}</strong>
        {' '}· {p.repeats ? 'colours can repeat' : 'no repeats'}
      </p>

      <div className="cb-secret" aria-label={won ? `Secret code: ${describeCode(p.code)}` : `Secret code, ${plural(revealed.size, 'spot')} revealed`}>
        {p.code.map((c, i) => (
          <span key={i} className={`cb-hole${won || revealed.has(i) ? ' shown' : ''}`}>
            {won || revealed.has(i) ? <Peg c={c} /> : <span className="cb-q" aria-hidden="true">?</span>}
          </span>
        ))}
      </div>

      <ol className="cb-rows" style={{ '--len': p.length }}>
        {rows.map((r, i) => (
          <li key={i} className={`cb-row done${r.broke !== -1 ? ' broke' : ''}${r.refunded ? ' refunded' : ''}`}>
            <span className="cb-num">{i + 1}</span>
            <span className="cb-pegs">{r.guess.map((c, j) => <Peg key={j} c={c} />)}</span>
            <Keys exact={r.exact} close={r.close} length={p.length} />
            <span className="sr-only">
              Guess {i + 1}: {describeCode(r.guess)}. {plural(r.exact, 'exact')}, {r.close} close.
              {r.refunded ? ' Refunded.' : ''}
            </span>
            {r.refunded && <span className="cb-tag">refunded</span>}
          </li>
        ))}
        {!won && left > 0 && (
          <li ref={currentRef} className="cb-row current">
            <span className="cb-num">{rows.length + 1}</span>
            <span className="cb-pegs">
              {draft.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  className={`cb-slot${i === slot ? ' sel' : ''}${revealed.has(i) ? ' fixed' : ''}`}
                  aria-label={`Spot ${i + 1}: ${c == null ? 'empty' : `${COLOR_NAMES[c]} ${c + 1}`}${revealed.has(i) ? ', revealed' : ''}${i === slot ? ', selected' : ''}`}
                  aria-pressed={i === slot}
                  onClick={() => pickSpot(i)}
                >
                  <Peg c={c} />
                </button>
              ))}
            </span>
            <span className="cb-keys-gap" />
          </li>
        )}
        {Array.from({ length: pending }, (_, i) => (
          <li key={`e${i}`} className="cb-row empty" aria-hidden="true">
            <span className="cb-num">{rows.length + 2 + i}</span>
            <span className="cb-pegs">{Array.from({ length: p.length }, (_, j) => <Peg key={j} small />)}</span>
          </li>
        ))}
      </ol>

      <div className="cb-palette">
        {Array.from({ length: p.colors }, (_, c) => (
          <button key={c} type="button" className="cb-pick" aria-label={`${COLOR_NAMES[c]} ${c + 1}`} onClick={() => place(c)} disabled={won}>
            <Peg c={c} />
          </button>
        ))}
      </div>
      <div className="cb-actions">
        <button type="button" className="lg-btn small" onClick={clearSpot} disabled={won}>⌫ Clear</button>
        <button type="button" className="lg-btn small cb-check" onClick={submit} disabled={!full || won}>✓ Check</button>
      </div>
      <p className="cb-legend" aria-hidden="true">
        <span className="cb-key exact" /> right colour, right spot · <span className="cb-key close" /> right colour, wrong spot
      </p>
      <p className="cb-msg">{msg || ' '}</p>
    </div>
  )
}
