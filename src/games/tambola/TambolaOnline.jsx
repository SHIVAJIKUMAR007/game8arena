// Tambola with friends: a room with a 4-letter code, tickets for everyone, one caller (the room host's page).
// You must cut every called number yourself, on each ticket that has it, before the mark window closes.
// Miss one and you are out of the round: you can watch, but not mark or claim.
import { useEffect, useMemo, useState } from 'react'
import LobbyShell from '../../platform/multiplayer/LobbyShell'
import RoomMenu from '../../platform/multiplayer/RoomMenu'
import '../../platform/multiplayer/multiplayer.css'
import { GOALS, MAX_NUMBER } from './ticket'
import { useTambolaRoom } from './useTambolaRoom'
import './TambolaOnline.css'

const ALL_NUMBERS = Array.from({ length: MAX_NUMBER }, (_, i) => i + 1)
const SECONDS = s => `${s} seconds`

/** A clock that re-renders every 100ms while `on`, for countdowns that run between server updates. */
function useNow(on) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return undefined
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [on])
  return now
}

const seconds = ms => Math.max(0, Math.ceil(ms / 1000))

// ---- lobby ----

function Lobby({ rt }) {
  const { room, me } = rt
  const isHost = room.hostId === me?.id
  const s = room.settings
  const lim = room.limits || { callSeconds: [6, 8, 10, 15], markSeconds: [3, 5, 8, 10], tickets: [1, 2, 3] }
  const marks = lim.markSeconds.filter(m => m <= s.callSeconds)
  return (
    <LobbyShell
      rt={rt}
      minPlayers={2}
      footer={
        <details className="mp-how">
          <summary>How to play</summary>
          <p>Everyone gets their own ticket. A caller announces one number at a time, the same for everybody.</p>
          <p><b>Cut each number yourself.</b> When a number on your ticket is called, tap it before the timer runs out. If you miss one, you are out of the round.</p>
          <p>Prizes are claimed in order: Early Five, then Line, then Full House. Press Claim as soon as your ticket completes the current prize. A false claim locks the button for a few seconds.</p>
        </details>
      }
    >
      <p className="mp-note">Up to 10 players. Miss a number on your ticket and you are out of the round, so keep your eyes on it.</p>
      <label className="mp-field">
        <span>A new number every</span>
        {isHost ? (
          <select aria-label="Time between numbers" value={s.callSeconds} onChange={e => rt.setSettings({ callSeconds: Number(e.target.value) })}>
            {lim.callSeconds.map(v => <option key={v} value={v}>{SECONDS(v)}</option>)}
          </select>
        ) : <b>{SECONDS(s.callSeconds)}</b>}
      </label>
      <label className="mp-field">
        <span>Time to cut a number</span>
        {isHost ? (
          <select aria-label="Time to cut a number" value={s.markSeconds} onChange={e => rt.setSettings({ markSeconds: Number(e.target.value) })}>
            {marks.map(v => <option key={v} value={v}>{SECONDS(v)}</option>)}
          </select>
        ) : <b>{SECONDS(s.markSeconds)}</b>}
      </label>
      <label className="mp-field">
        <span>Tickets each</span>
        {isHost ? (
          <select aria-label="Tickets each" value={s.tickets} onChange={e => rt.setSettings({ tickets: Number(e.target.value) })}>
            {lim.tickets.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        ) : <b>{s.tickets}</b>}
      </label>
    </LobbyShell>
  )
}

// ---- the round ----

function feedText(e, name) {
  if (e.k === 'call') return `Number ${e.n} called`
  if (e.k === 'evict') return `${name(e.id)} is out: missed ${e.n}`
  if (e.k === 'prize') return `${name(e.id)} claimed ${GOALS[e.goal].label}`
  if (e.k === 'left') return `${name(e.id)} left`
  return ''
}

function Ticket({ ticket, index, marks, called, due, active, onCut }) {
  const dueSet = new Set(due.filter(d => d.ticket === index).map(d => d.n))
  return (
    <div className={`tm-ticket ${active ? '' : 'out'}`} role="group" aria-label={`Ticket ${index + 1}`}>
      {ticket.map((row, r) =>
        row.map((n, c) => {
          if (n === null) return <span key={`${r}-${c}`} className="tm-blank" aria-hidden="true" />
          const on = marks.includes(n)
          const need = dueSet.has(n)
          const cls = ['tm-cell', on && 'on', need && 'due', !on && !need && called.has(n) && 'missed']
          return (
            <button
              key={`${r}-${c}`}
              type="button"
              className={cls.filter(Boolean).join(' ')}
              aria-pressed={on}
              disabled={!active}
              aria-label={`Ticket ${index + 1}, number ${n}${on ? ', marked' : need ? ', cut it now' : ''}`}
              onClick={() => onCut(n, index)}
            >
              {n}
            </button>
          )
        }),
      )}
    </div>
  )
}

function Over({ view, rt }) {
  const isHost = rt.room?.hostId === rt.me?.id
  const name = id => view.players.find(p => p.id === id)?.name ?? '?'
  const iWon = view.winners.includes(view.you)
  const ranked = [...view.players].sort((a, b) => b.prizes.length - a.prizes.length || Number(b.active) - Number(a.active))
  let title = 'No winner this round'
  if (view.winners.length === 1) title = iWon ? 'You win! 🎉' : `${name(view.winners[0])} wins!`
  const why = {
    fullhouse: 'The Full House has been claimed.',
    last: 'Everyone else is out or has left. The last player standing wins.',
    exhausted: 'Every number has been called.',
    out: 'The round ended with nobody left.',
  }[view.reason]
  return (
    <div className="tm-overlay" role="dialog" aria-modal="true" aria-label="Round over">
      <div className={`tm-over ${iWon ? 'won' : ''}`}>
        <h2>{title}</h2>
        <p className="mp-note">{why}</p>
        <ul className="tm-prizes done" aria-label="Prizes won">
          {view.prizes.map(p => (
            <li key={p.goal}>
              <b>{GOALS[p.goal].label}</b>
              <span>{p.winner ? name(p.winner) : 'not claimed'}</span>
            </li>
          ))}
        </ul>
        <ol className="tm-standings" aria-label="Final standings">
          {ranked.map(p => (
            <li key={p.id} className={view.winners.includes(p.id) ? 'top' : ''}>
              <span>{p.name}{p.id === view.you ? ' (you)' : ''}</span>
              <em>{p.active ? 'in' : p.reason === 'left' ? 'left' : `out at ${p.outAt}`}</em>
              <b>{p.prizes.length} {p.prizes.length === 1 ? 'prize' : 'prizes'}</b>
            </li>
          ))}
        </ol>
        {isHost ? (
          <div className="tm-row">
            <button type="button" className="mp-btn good" autoFocus onClick={rt.playAgain}>Play again</button>
            <button type="button" className="mp-btn" onClick={rt.toLobby}>Return to lobby</button>
          </div>
        ) : <p className="mp-note">Waiting for the host…</p>}
        <button type="button" className="mp-btn ghost" onClick={rt.leave}>Leave room</button>
      </div>
    </div>
  )
}

function Match({ rt }) {
  const { view } = rt
  const now = useNow(view.phase === 'play')
  const elapsed = now - rt.receivedAt
  const calledSet = useMemo(() => new Set(view.called), [view.called])
  const me = view.players.find(p => p.id === view.you)
  const active = Boolean(me?.active) && view.phase === 'play'
  const name = id => view.players.find(p => p.id === id)?.name ?? '?'
  const goal = view.goal ? GOALS[view.goal] : null

  // numbers still to be cut, with live countdowns, soonest first
  const due = view.due.map(d => ({ ...d, left: Math.max(0, d.left - elapsed) })).sort((a, b) => a.left - b.left)
  const urgent = due[0]
  const lockedMs = Math.max(0, view.locked - elapsed)
  const nextIn = Math.max(0, view.nextCallIn - elapsed)

  const cut = (n, ticket) => {
    if (!calledSet.has(n)) return // not called yet: nothing to cut, and nothing to lose
    if (!view.marks[ticket].includes(n)) rt.mark(n, ticket)
  }
  const onKeyDown = e => {
    if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      if (active && goal && !lockedMs) rt.claim()
    }
  }

  let status = null
  if (view.phase === 'play') {
    if (!me?.active) status = me?.reason === 'left' ? 'You left the round.' : `You are out: you missed ${me.outAt}. You can keep watching until the round ends.`
    else if (urgent) {
      const more = due.length > 1 ? ` (+${due.length - 1} more)` : ''
      status = `Cut ${urgent.n} on ticket ${urgent.ticket + 1} now! ${seconds(urgent.left)}s${more}`
    } else if (!view.called.length) status = 'Get ready. The first number is coming. Cut each number on your ticket when it is called.'
    else status = 'You are all caught up. Wait for the next number.'
  }

  return (
    <div className="tm-match" onKeyDown={onKeyDown}>
      <section className="tm-caller" aria-label="Caller">
        <div className={`tm-ball ${urgent ? 'hot' : ''}`} aria-live="polite" aria-label={view.latest ? `Number ${view.latest}` : 'No number yet'}>{view.latest ?? '·'}</div>
        <div className="tm-caller-info">
          <p className="tm-count">{view.called.length}/{MAX_NUMBER} called</p>
          <div className="tm-bar" aria-hidden="true">
            <span key={view.called.length} style={{ animationDuration: `${view.callMs}ms`, animationDelay: `-${Math.max(0, view.callMs - nextIn)}ms` }} />
          </div>
          <p className="tm-count">{view.phase === 'play' ? `Next number in ${seconds(nextIn)}s` : 'Round over'}</p>
        </div>
      </section>

      {status && <p className={`tm-status ${!me?.active ? 'out' : urgent ? (urgent.left < 2000 ? 'low' : 'hot') : ''}`} role="status">{status}</p>}

      <ul className="tm-prizes" aria-label="Prizes">
        {view.prizes.map(p => (
          <li key={p.goal} className={`${p.goal === view.goal ? 'now' : ''} ${p.winner ? 'taken' : ''}`}>
            <b>{GOALS[p.goal].label}</b>
            <span>{p.winner ? name(p.winner) : p.goal === view.goal ? GOALS[p.goal].how : 'open'}</span>
          </li>
        ))}
      </ul>

      <div className="tm-tickets">
        {view.tickets.map((ticket, i) => (
          <Ticket key={i} ticket={ticket} index={i} marks={view.marks[i]} called={calledSet} due={due} active={active} onCut={cut} />
        ))}
      </div>

      <button type="button" className="mp-btn good tm-claim" disabled={!active || !goal || lockedMs > 0} onClick={rt.claim}>
        {goal ? `Claim ${goal.label}` : 'All prizes taken'} {lockedMs > 0 ? `(${seconds(lockedMs)}s)` : <kbd>C</kbd>}
      </button>
      {rt.error && <p className="mp-note warn" role="alert">{rt.error}</p>}

      <ol className="tm-players" aria-label="Players">
        {view.players.map(p => (
          <li key={p.id} className={p.active ? '' : 'gone'}>
            <span>{p.name}{p.id === view.you ? ' (you)' : ''}</span>
            <em>{p.active ? 'in' : p.reason === 'left' ? 'left' : 'out'}</em>
            <b>{p.prizes.length ? p.prizes.map(g => GOALS[g].label).join(', ') : `${p.marked} cut`}</b>
          </li>
        ))}
      </ol>

      <ul className="tm-feed" aria-label="What just happened" aria-live="polite">
        {view.feed.slice(-4).reverse().map((e, i) => <li key={`${view.feed.length}-${i}`}>{feedText(e, name)}</li>)}
      </ul>

      <div className="tm-numbers" role="group" aria-label="Numbers called so far">
        {ALL_NUMBERS.map(n => (
          <span key={n} className={`tm-num ${calledSet.has(n) ? 'out' : ''} ${n === view.latest ? 'now' : ''}`} aria-label={`${n}${calledSet.has(n) ? ', called' : ''}`}>{n}</span>
        ))}
      </div>

      {view.phase === 'over' && <Over view={view} rt={rt} />}
    </div>
  )
}

/** Multiplayer Tambola. */
export default function TambolaOnline({ onBack }) {
  const rt = useTambolaRoom()
  let screen
  if (!rt.room) {
    screen = (
      <>
        <RoomMenu
          rt={rt}
          nameKey="tambola:name"
          title="Tambola with friends"
          intro="Everyone gets a ticket. Cut each number the caller announces before the timer ends, or you are out of the round."
        />
        {onBack && <button type="button" className="mp-btn ghost tm-back" onClick={onBack}>← Back to modes</button>}
      </>
    )
  } else if (rt.room.phase === 'lobby' || !rt.view) screen = <Lobby rt={rt} />
  else screen = <Match rt={rt} />
  return <div className="mp-root tm-root">{screen}</div>
}
