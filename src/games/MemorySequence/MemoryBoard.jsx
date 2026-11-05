import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { playSound } from '../../platform/sound'
import { vibrate } from '../../platform/haptics'
import { PADS, columnsFor, layoutFor, paramsFor, sequenceFor } from './logic'
import './MemoryGame.css'

const TAP_MS = 200       // how long a tapped pad stays lit
const FIRST_DELAY = 700  // pause before the first playback
const NEXT_DELAY = 750   // pause between a finished round and the next playback
const RETRY_DELAY = 1100 // pause after a mistake before the replay

export default function MemoryBoard({ level, seed, session }) {
  const prm = useMemo(() => paramsFor(level), [level])
  const seq = useMemo(() => sequenceFor(seed, prm.target, prm.pads), [seed, prm])

  const [len, setLen] = useState(prm.start)       // current round's sequence length
  const [idx, setIdx] = useState(0)               // how many steps the player has repeated this round
  const [phase, setPhase] = useState('pause')     // 'watch' | 'input' | 'pause' | 'done'
  const [lit, setLit] = useState(null)            // pad currently lit (playback or tap)
  const [hintPad, setHintPad] = useState(null)
  const [wrongPad, setWrongPad] = useState(null)
  const [msg, setMsg] = useState('Watch closely…')

  const st = useRef({ len, idx, phase })
  useLayoutEffect(() => { st.current = { len, idx, phase } }, [len, idx, phase])
  const lastMistake = useRef(null)                // { len, idx } for undo
  const timers = useRef([])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  const cancel = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  useEffect(() => () => cancel(), [])

  const layout = useMemo(() => layoutFor(seed, len - prm.start, prm.pads, prm.shuffle), [seed, len, prm])

  useEffect(() => { session.setInfo({ label: 'Length', value: `${len}/${prm.target}` }) }, [len, prm.target, session])

  const say = useCallback(text => { setMsg(text); session.announce(text) }, [session])

  /** Flash the first `n` steps, then hand over to the player. */
  const playback = useCallback(n => {
    cancel()
    setPhase('watch')
    setIdx(0)
    setHintPad(null)
    say(n === 1 ? 'Watch the light…' : `Watch ${n} lights…`)
    const stepMs = prm.flash + prm.gap
    for (let i = 0; i < n; i++) {
      later(() => { setLit(seq[i]); playSound('note', PADS[seq[i]].freq) }, i * stepMs)
      later(() => setLit(null), i * stepMs + prm.flash)
    }
    later(() => { setPhase('input'); say(`Your turn: repeat ${n} step${n === 1 ? '' : 's'}.`) }, n * stepMs)
  }, [prm, seq, say])

  useEffect(() => {
    const t = setTimeout(() => playback(prm.start), FIRST_DELAY)
    return () => clearTimeout(t)
  }, [playback, prm.start])

  const press = useCallback(pad => {
    const s = st.current
    if (session.locked || s.phase !== 'input') return
    setLit(pad)
    setHintPad(null)
    later(() => setLit(cur => (cur === pad ? null : cur)), TAP_MS)
    lastMistake.current = null // undo only covers a mistake you haven't played past

    if (pad === seq[s.idx]) {
      playSound('note', PADS[pad].freq)
      const next = s.idx + 1
      setIdx(next)
      if (next < s.len) return
      // Round complete.
      session.noteMove(true)
      if (s.len >= prm.target) {
        setPhase('done')
        say('Perfect memory!')
        later(() => session.win(), 400)
        return
      }
      setPhase('pause')
      say(prm.shuffle ? 'Correct! The pads are moving…' : 'Correct!')
      later(() => { setLen(s.len + 1); playback(s.len + 1) }, NEXT_DELAY)
      return
    }

    // Wrong pad.
    vibrate(60)
    setWrongPad(pad)
    later(() => setWrongPad(null), 600)
    setPhase('pause')
    lastMistake.current = { len: s.len, idx: s.idx }
    session.noteMove(false)
    const left = session.loseLife()
    if (left <= 0) return
    say(`Not that one — it was ${PADS[seq[s.idx]].name}. Watch again.`)
    later(() => playback(s.len), RETRY_DELAY)
  }, [session, seq, prm, playback, say])

  useEffect(() => {
    session.bindActions({
      hint() {
        const s = st.current
        if (session.locked || s.phase !== 'input') return false
        const pad = seq[s.idx]
        setHintPad(pad)
        later(() => setHintPad(cur => (cur === pad ? null : cur)), 1200)
        session.announce(`Hint: next is ${PADS[pad].name} ${PADS[pad].symbol}.`)
        return true
      },
      undo() {
        // Take back the last mistake: the life returns and you carry on from where you slipped.
        const m = lastMistake.current
        if (session.locked || !m) return false
        lastMistake.current = null
        cancel()
        setLit(null)
        session.restoreLife()
        setLen(m.len)
        setIdx(m.idx)
        setPhase('input')
        say(`Mistake undone. Carry on from step ${m.idx + 1} of ${m.len}.`)
        return true
      },
    })
  }, [session, seq, say])

  // Keyboard: 1–9 press the pads in screen order.
  useEffect(() => {
    const onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return
      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1 || n > layout.length) return
      e.preventDefault()
      press(layout[n - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, layout])

  const cols = columnsFor(prm.pads)
  const steps = Array.from({ length: len }, (_, i) => (phase === 'input' || phase === 'done' ? i < idx : false))

  return (
    <div className="ms-root">
      <p className={`ms-status ${phase}`}>{msg}</p>
      <div className="ms-steps" aria-hidden="true">
        {steps.map((done, i) => <span key={i} className={done ? 'on' : ''} />)}
      </div>
      <div
        className={`ms-pads n${prm.pads}${phase === 'input' ? ' ready' : ''}`}
        style={{ '--cols': cols, '--rows': Math.ceil(prm.pads / cols) }}
        role="group"
        aria-label={`${prm.pads} pads. ${phase === 'input' ? `Your turn, step ${idx + 1} of ${len}.` : 'Watch the sequence.'} Keys 1 to ${prm.pads} press the pads in order.`}
      >
        {layout.map((pad, pos) => (
          <button
            key={pad}
            className={`ms-pad${lit === pad ? ' lit' : ''}${hintPad === pad ? ' hint' : ''}${wrongPad === pad ? ' wrong' : ''}`}
            data-pad={PADS[pad].name}
            style={{ order: pos }}
            aria-label={`${PADS[pad].name} ${PADS[pad].symbol}, key ${pos + 1}`}
            aria-disabled={phase !== 'input'}
            onPointerDown={e => { e.preventDefault(); press(pad) }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); press(pad) } }}
          >
            <span className="ms-symbol" aria-hidden="true">{PADS[pad].symbol}</span>
            <span className="ms-key" aria-hidden="true">{pos + 1}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
