import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { playSound } from '../../platform/sound'
import { generateLevel, getHint } from './levels'
import { GOALS, MAX_NUMBER, isGoalMet, positionsOf } from './ticket'
import { recordHint, recordWin } from './store'
import './TambolaGame.css'

const TICK_MS = 100
const FIRST_CALL_MS = 1200 // a short pause before the first number so the player can read the tickets
const HINT_MS = 3500
const RESET_MS = 2400 // how long "a rival claimed it" stays up before the round starts again
const RECENT = 5
const ALL_NUMBERS = Array.from({ length: MAX_NUMBER }, (_, i) => i + 1)

export default function TambolaBoard({ level, seed, session }) {
  const lv = useMemo(() => generateLevel(seed, { level }), [seed, level])
  return <Round lv={lv} session={session} />
}

function Round({ lv, session }) {
  const goal = GOALS[lv.goal]
  const position = useMemo(() => positionsOf(lv.calls), [lv])
  const [called, setCalled] = useState(0)
  const [marks, setMarks] = useState(() => lv.tickets.map(() => []))
  const [msg, setMsg] = useState('The caller is about to start. Mark each number you hear.')
  const [hint, setHint] = useState(null) // { ticket, number } | { claim: true }
  const [wrong, setWrong] = useState(null) // { ticket, number } flashes after a bad tap

  const live = useRef({ called: 0, marks, done: false })
  const clock = useRef({ acc: 0, active: 0 })
  const timers = useRef([])
  const later = useCallback((fn, ms) => timers.current.push(setTimeout(fn, ms)), [])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const say = useCallback(text => { setMsg(text); session.announce(text) }, [session])
  useEffect(() => { session.setInfo({ label: 'Called', value: `${called}/${MAX_NUMBER}` }) }, [called, session])

  const startOver = useCallback(() => {
    live.current = { called: 0, marks: lv.tickets.map(() => []), done: false }
    clock.current.acc = 0
    setCalled(0)
    setMarks(live.current.marks)
    setHint(null)
    say('A new round begins with the same tickets. Mark each number you hear.')
  }, [lv, say])

  const lostRace = useCallback(bot => {
    live.current.done = true
    setHint(null)
    const lives = session.loseLife()
    if (lives > 0) {
      say(`${bot.name} shouts ${goal.label} and wins the round. You lost a 💧. Starting again…`)
      later(startOver, RESET_MS)
    } else say(`${bot.name} shouts ${goal.label} first.`)
  }, [session, goal, startOver, say, later])

  // ----- the caller: one number per interval, paused while an overlay is up or the tab is hidden -----
  useEffect(() => {
    let last = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      const dt = now - last
      last = now
      const L = live.current
      if (session.locked || document.hidden || L.done) return
      clock.current.active += dt
      clock.current.acc += dt
      if (clock.current.acc < (L.called === 0 ? FIRST_CALL_MS : lv.interval)) return
      clock.current.acc = 0
      const n = L.called + 1
      L.called = n
      setCalled(n)
      playSound('tap')
      say(`Number ${lv.calls[n - 1]}.`)
      const bot = lv.bots.find(b => b.claimAt === n)
      if (bot) lostRace(bot)
    }, TICK_MS)
    return () => clearInterval(id)
  }, [lv, session, say, lostRace])

  const mark = useCallback((t, n) => {
    const L = live.current
    if (session.locked || L.done || L.marks[t].includes(n)) return
    if (!(position[n] <= L.called)) {
      setWrong({ ticket: t, number: n })
      later(() => setWrong(null), 600)
      session.noteMove(false)
      const lives = session.loseLife()
      if (lives > 0) say(`${n} has not been called yet. You lost a 💧.`)
      return
    }
    const next = L.marks.map((m, i) => (i === t ? [...m, n] : m))
    L.marks = next
    setMarks(next)
    setHint(h => (h && h.number === n ? null : h))
    session.noteMove(true)
    say(`Marked ${n}.`)
  }, [session, position, say, later])

  const claim = useCallback(() => {
    const L = live.current
    if (session.locked || L.done) return
    if (lv.tickets.some((t, i) => isGoalMet(lv.goal, t, new Set(L.marks[i])))) {
      L.done = true
      setHint(null)
      say(`${goal.label}! You claimed it first.`)
      recordWin(lv.level, clock.current.active / 1000)
      session.win()
      return
    }
    session.noteMove(false)
    const lives = session.loseLife()
    if (lives > 0) say(`That is not a ${goal.label} yet. You lost a 💧.`)
  }, [lv, goal, session, say])

  // ----- hint: a called number you still need, or a nudge to claim -----
  useEffect(() => {
    session.bindActions({
      hint() {
        const L = live.current
        if (L.done) return false
        const h = getHint(lv, { called: L.called, marked: L.marks[lv.winTicket] })
        if (!h) { say('Nothing to mark right now. Wait for the next number.'); return false }
        if (h.type === 'claim') { setHint({ claim: true }); say(`Your ${goal.label} is complete. Press Claim!`) } else {
          setHint({ ticket: h.ticket, number: h.number })
          say(`Number ${h.number} has been called and is on ticket ${h.ticket + 1}.`)
        }
        recordHint()
        later(() => setHint(null), HINT_MS)
        return true
      },
    })
  }, [lv, goal, session, say, later])

  const onKeyDown = e => {
    if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); claim() }
  }

  const recent = lv.calls.slice(Math.max(0, called - RECENT), called).reverse()
  const calledSet = useMemo(() => new Set(lv.calls.slice(0, called)), [lv, called])
  const latest = called ? lv.calls[called - 1] : null

  return (
    <div className="tb-root" onKeyDown={onKeyDown}>
      <section className="tb-caller" aria-label="Caller">
        <div className="tb-ball" aria-hidden="true">{latest ?? '·'}</div>
        <div className="tb-caller-info">
          <p className="tb-goal"><b>{goal.label}</b> <span>{goal.how}</span></p>
          <ol className="tb-recent" aria-label="Recent numbers">
            {recent.map((n, i) => <li key={n} className={i === 0 ? 'now' : ''}>{n}</li>)}
          </ol>
          {/* Keyed by call so the bar restarts with each number; its length is the time until the next call. */}
          <div className="tb-bar" aria-hidden="true"><span key={called} style={{ animationDuration: `${lv.interval}ms` }} /></div>
          <p className="tb-rivals">{lv.bots.length ? `Racing: ${lv.bots.map(b => b.name).join(', ')}` : 'No rivals on this level.'}</p>
        </div>
      </section>

      <p className="tb-msg" role="status">{msg}</p>

      <div className="tb-tickets">
        {lv.tickets.map((ticket, t) => (
          <div key={t} className="tb-ticket" role="group" aria-label={`Ticket ${t + 1}`}>
            {ticket.map((row, r) => row.map((n, c) => {
              if (n === null) return <span key={`${r}-${c}`} className="tb-blank" aria-hidden="true" />
              const on = marks[t].includes(n)
              const cls = ['tb-cell', on && 'on', hint?.ticket === t && hint.number === n && 'hint', wrong?.ticket === t && wrong.number === n && 'wrong']
              return (
                <button
                  key={`${r}-${c}`} type="button" className={cls.filter(Boolean).join(' ')} aria-pressed={on}
                  aria-label={`Ticket ${t + 1}, number ${n}${on ? ', marked' : ''}`} onClick={() => mark(t, n)}
                >
                  {n}
                </button>
              )
            }))}
          </div>
        ))}
      </div>

      <button type="button" className={`lg-btn big tb-claim ${hint?.claim ? 'hint' : ''}`} onClick={claim}>
        Claim {goal.label} <kbd>C</kbd>
      </button>

      <div className="tb-numbers" role="group" aria-label="Numbers called so far">
        {ALL_NUMBERS.map(n => (
          <span key={n} className={`tb-num ${calledSet.has(n) ? 'out' : ''} ${n === latest ? 'now' : ''}`} aria-label={`${n}${calledSet.has(n) ? ', called' : ''}`}>{n}</span>
        ))}
      </div>
    </div>
  )
}
