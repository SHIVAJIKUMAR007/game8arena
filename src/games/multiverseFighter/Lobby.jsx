// Online lobby: create a room (5-character code) or join one, pick a fighter, and press Ready. The room creator is
// the host; when both players are ready the host tells the container to start the match. The network session is
// created here but handed to the container (onSession), which owns it from then on: leaving this screen never
// closes it, because it must survive into the fight. Only this screen's own tab switches and Back close it.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createRoom, joinRoom, isValidCode, normalizeCode } from './netcode'
import { Icon, Portrait, TopBar } from './ui'
import { ROSTER, fighterById } from './roster'
import { useMv } from './store'

const STATUS_TEXT = {
  idle: 'Not connected',
  creating: 'Opening a room…',
  waiting: 'Waiting for an opponent to join…',
  joining: 'Connecting…',
  connected: 'Connected',
  lost: 'Connection lost. Trying to reconnect…',
}

export default function Lobby({ onSession, onStart, onBack }) {
  const save = useMv()
  const [tab, setTab] = useState('create')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [ping, setPing] = useState(null)
  const [mine, setMine] = useState(save.selected)
  const [theirs, setTheirs] = useState('')
  const [ready, setReady] = useState({ mine: false, theirs: false })
  const [role, setRole] = useState('')
  const sessionRef = useRef(null)
  const alive = useRef(true)
  const unsubs = useRef([])
  const mineRef = useRef(mine)
  const readyRef = useRef(ready)
  const copyTimer = useRef(0)
  const startedRef = useRef(false)

  useEffect(() => {
    mineRef.current = mine
    readyRef.current = ready
  })

  const detach = useCallback(() => {
    unsubs.current.forEach(u => u())
    unsubs.current = []
  }, [])

  const teardown = useCallback(() => {
    detach()
    sessionRef.current?.close()
    sessionRef.current = null
    startedRef.current = false
  }, [detach])

  const attach = useCallback(
    session => {
      sessionRef.current = session
      setRole(session.role)
      setCode(session.code)
      onSession(session)
      unsubs.current.push(
        session.onStatus(s => {
          if (s.type === 'connected') {
            setStatus('connected')
            setTheirs(s.remote?.fighter || session.remote.fighter || 'cap')
            setError('')
          } else if (s.type === 'lost') setStatus('lost')
          else if (s.type === 'back') {
            setStatus('connected')
            session.sendControl({ t: 'select', fighter: mineRef.current })
          } else if (s.type === 'left') {
            setStatus(session.role === 'host' ? 'waiting' : 'idle')
            setReady({ mine: false, theirs: false })
            setError(session.role === 'host' ? 'Your opponent left. The room is still open.' : 'The host closed the room.')
          } else if (s.type === 'ping') setPing(s.ms)
          else if (s.type === 'error') setError(s.message)
        }),
        session.onControl(msg => {
          if (msg.t === 'select' && typeof msg.fighter === 'string') {
            setTheirs(msg.fighter)
            setReady(r => ({ ...r, theirs: false }))
          } else if (msg.t === 'ready') setReady(r => ({ ...r, theirs: Boolean(msg.v) }))
        }),
      )
    },
    [onSession],
  )

  const startCreate = useCallback(async () => {
    teardown()
    setStatus('creating')
    setError('')
    setReady({ mine: false, theirs: false })
    setTheirs('')
    try {
      const session = await createRoom({ name: 'Host', fighter: mineRef.current })
      if (!alive.current) {
        session.close()
        return
      }
      attach(session)
      setStatus('waiting')
    } catch (e) {
      setStatus('idle')
      setError(e.message)
    }
  }, [attach, teardown])

  const startJoin = async () => {
    const c = normalizeCode(input)
    if (!isValidCode(c)) {
      setError('Room codes are 5 characters: letters A to Z (no I or O) and numbers 2 to 9.')
      return
    }
    teardown()
    setStatus('joining')
    setError('')
    setReady({ mine: false, theirs: false })
    try {
      const session = await joinRoom(c, { name: 'Guest', fighter: mineRef.current })
      if (!alive.current) {
        session.close()
        return
      }
      attach(session)
      setStatus('connected')
      setTheirs(session.remote.fighter || 'cap')
    } catch (e) {
      setStatus('idle')
      setError(e.message)
    }
  }

  // Open a room as soon as the Create tab is showing. Switching tabs closes it (see the tab handler).
  useEffect(() => {
    if (tab !== 'create') return undefined
    const id = setTimeout(startCreate, 0)
    return () => clearTimeout(id)
  }, [tab, startCreate])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      clearTimeout(copyTimer.current)
      detach()
    }
  }, [detach])

  // The host starts the match once both players are ready.
  useEffect(() => {
    if (role === 'host' && status === 'connected' && ready.mine && ready.theirs && theirs && !startedRef.current) {
      startedRef.current = true
      onStart([mine, theirs])
    }
  }, [role, status, ready, mine, theirs, onStart])

  const pickFighter = id => {
    if (ready.mine) return
    setMine(id)
    sessionRef.current?.sendControl({ t: 'select', fighter: id })
  }
  const toggleReady = () => {
    const v = !ready.mine
    setReady(r => ({ ...r, mine: v }))
    sessionRef.current?.sendControl({ t: 'ready', v })
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Copy is blocked here. Read the code out or select it by hand.')
    }
  }
  const leave = () => {
    teardown()
    onBack()
  }

  const connected = status === 'connected'
  return (
    <div className="mvf-screen mvf-lobby">
      <TopBar />
      <h2 className="mvf-title">Online match</h2>
      <div className="mvf-tabs" role="tablist" aria-label="Room type">
        {[['create', 'Create room'], ['join', 'Join room']].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`mvf-tab${tab === id ? ' on' : ''}`} onClick={() => { if (tab !== id) { teardown(); setStatus('idle'); setError(''); setCode(''); setTab(id) } }}>
            {label}
          </button>
        ))}
      </div>
      <div className="mvf-lobby-main">
        <section className="mvf-lobby-card" aria-label="Room">
          {tab === 'create' ? (
            <>
              <p className="mvf-label">Room code</p>
              <div className="mvf-code" aria-live="polite">{code || '·····'}</div>
              <button type="button" className="mvf-btn blue small" onClick={copy} disabled={!code}>
                <Icon name={copied ? 'check' : 'copy'} /> {copied ? 'Copied' : 'Copy code'}
              </button>
              <p className="mvf-help">Send this code to a friend, or open this page in a second tab and join with it.</p>
            </>
          ) : (
            <>
              <label className="mvf-label" htmlFor="mvf-code-input">Enter a room code</label>
              <input
                id="mvf-code-input"
                className="mvf-codeinput"
                value={input}
                onChange={e => setInput(normalizeCode(e.target.value))}
                onKeyDown={e => e.key === 'Enter' && !connected && startJoin()}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={5}
                placeholder="K7QMX"
                disabled={connected}
              />
              <button type="button" className="mvf-btn orange small" onClick={startJoin} disabled={connected || status === 'joining' || input.length < 5}>
                {status === 'joining' ? 'Connecting…' : 'Join'}
              </button>
            </>
          )}
          <p className={`mvf-status s-${status}`} role="status">
            <i /> {STATUS_TEXT[status]}
            {connected && ping != null ? <b> · {ping} ms</b> : null}
          </p>
          {error ? <p className="mvf-error" role="alert">{error}</p> : null}
        </section>

        <section className="mvf-lobby-card wide" aria-label="Fighters">
          <div className="mvf-duel">
            <div className="mvf-seat">
              <Portrait id={mine} size={96} />
              <b>You</b>
              <span>{fighterById(mine).name}</span>
              <em className={ready.mine ? 'on' : ''}>{ready.mine ? 'Ready' : 'Not ready'}</em>
            </div>
            <span className="mvf-vsmini">VS</span>
            <div className="mvf-seat">
              {theirs ? <Portrait id={theirs} size={96} /> : <div className="mvf-seat-empty" aria-hidden="true">?</div>}
              <b>Opponent</b>
              <span>{theirs ? fighterById(theirs).name : 'Waiting…'}</span>
              <em className={ready.theirs ? 'on' : ''}>{ready.theirs ? 'Ready' : 'Not ready'}</em>
            </div>
          </div>
          <ul className="mvf-picker" aria-label="Pick your fighter">
            {ROSTER.map(f => (
              <li key={f.id}>
                <button type="button" className={`mvf-pick${mine === f.id ? ' sel' : ''}`} onClick={() => pickFighter(f.id)} disabled={ready.mine} aria-pressed={mine === f.id} aria-label={f.name}>
                  <Portrait id={f.id} size={56} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className={`mvf-btn ${ready.mine ? 'tan' : 'orange'}`} onClick={toggleReady} disabled={!connected}>
            {ready.mine ? 'Cancel ready' : 'Ready'}
          </button>
          <p className="mvf-help">Every fighter is open online, on base stats.</p>
        </section>
      </div>
      <button type="button" className="mvf-btn tan mvf-back" onClick={leave}>
        <Icon name="back" /> Back
      </button>
    </div>
  )
}
