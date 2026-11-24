import { useEffect, useRef, useState } from 'react'
import LobbyShell from '../../platform/multiplayer/LobbyShell'
import RoomMenu from '../../platform/multiplayer/RoomMenu'
import '../../platform/multiplayer/multiplayer.css'
import { ROLE_NAMES, iWon, winnerTitle } from './outcome'
import { useUndercover } from './useUndercover'
import './UndercoverGame.css'

const CLUE_LABEL = s => `${s} seconds`

/** Seconds left in the current phase, counted down locally from what the server last said. */
function useCountdown(view, receivedAt) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])
  return view ? Math.max(0, view.left - Math.floor((now - receivedAt) / 1000)) : 0
}

function Lobby({ rt }) {
  const { room, me } = rt
  const isHost = room.hostId === me?.id
  const n = room.players.length
  const max = Math.floor(n / 2)
  const { undercover: x, mrwhite: y, clueSeconds, endRule } = room.settings
  const infiltrators = x + y
  const civilians = n - infiltrators
  let problem = ''
  if (n >= 3 && infiltrators < 1) problem = 'Pick at least one Undercover or Mr. White.'
  else if (n >= 3 && infiltrators > max) problem = `With ${n} players you can have at most ${max} Undercover and Mr. White together. Lower the numbers.`
  const num = (label, key, value) => (
    <label className="mp-field">
      <span>{label}</span>
      {isHost ? (
        <input
          type="number" min="0" max={Math.max(max, 1)} value={value} aria-label={label}
          onChange={e => rt.setSettings({ [key]: Math.max(0, Math.min(20, Math.floor(Number(e.target.value)) || 0)) })}
        />
      ) : <b>{value}</b>}
    </label>
  )
  return (
    <LobbyShell
      rt={rt} minPlayers={3} canStart={!problem} startNote={problem}
      footer={
        <details className="mp-how">
          <summary>How to play</summary>
          <p>Everyone secretly gets a word. <b>Civilians</b> all get the same word. The <b>Undercover</b> get a similar one and do not know it. <b>Mr. White</b> gets no word.</p>
          <p>Each round, everyone gives a one-word clue in turn, then you vote someone out. When Mr. White is voted out, they get one guess at the civilians’ word.</p>
          <p>Civilians win by voting out every Undercover and Mr. White. Otherwise the infiltrators win when the civilians are outnumbered.</p>
        </details>
      }
    >
      <p className="mp-note">{n < 3 ? 'You need at least 3 players.' : `${civilians} civilians, ${x} Undercover, ${y} Mr. White. Up to ${max} infiltrators with ${n} players.`}</p>
      {num('Undercover', 'undercover', x)}
      {num('Mr. White', 'mrwhite', y)}
      <label className="mp-field">
        <span>Time for each clue</span>
        {isHost ? (
          <select aria-label="Time for each clue" value={clueSeconds} onChange={e => rt.setSettings({ clueSeconds: Number(e.target.value) })}>
            {(room.limits?.clueSeconds || [20, 30, 45, 60]).map(s => <option key={s} value={s}>{CLUE_LABEL(s)}</option>)}
          </select>
        ) : <b>{CLUE_LABEL(clueSeconds)}</b>}
      </label>
      <label className="mp-field">
        <span>Infiltrators win when</span>
        {isHost ? (
          <select aria-label="Infiltrators win when" value={endRule} onChange={e => rt.setSettings({ endRule: e.target.value })}>
            <option value="parity">Civilians are no more than them</option>
            <option value="last">Only 1 civilian is left</option>
          </select>
        ) : <b>{endRule === 'parity' ? 'Civilians are no more than them' : 'Only 1 civilian is left'}</b>}
      </label>
    </LobbyShell>
  )
}

function WordCard({ you }) {
  const [shown, setShown] = useState(true)
  return (
    <div className={`uc-card ${you.mrWhite ? 'white' : ''}`}>
      <div className="uc-card-label">{you.mrWhite ? 'You are' : 'Your word'}</div>
      <div className="uc-card-word" aria-live="polite">
        {shown ? (you.mrWhite ? 'Mr. White' : you.word) : '••••••'}
      </div>
      {you.mrWhite && shown && <div className="uc-card-hint">You have no word. Listen to the clues and blend in.</div>}
      <button type="button" className="uc-peek" onClick={() => setShown(s => !s)}>{shown ? 'Hide' : 'Show'}</button>
    </div>
  )
}

function Clues({ view }) {
  const name = id => view.players.find(p => p.id === id)?.name ?? '?'
  if (!view.rounds.some(r => r.items.length)) return null
  return (
    <section className="uc-clues" aria-label="Clues so far">
      {view.rounds.filter(r => r.items.length).map(r => (
        <div key={r.round}>
          <h3>Round {r.round}</h3>
          <ul>
            {r.items.map((c, i) => <li key={i}><b>{name(c.id)}</b> {c.text}</li>)}
          </ul>
        </div>
      ))}
    </section>
  )
}

function ClueForm({ rt }) {
  const [text, setText] = useState('')
  const ref = useRef(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <form
      className="uc-form"
      onSubmit={e => {
        e.preventDefault()
        if (!text.trim()) return
        rt.clue(text)
        setText('')
      }}
    >
      <input ref={ref} className="mp-text" aria-label="Your clue" value={text} maxLength={30} placeholder="One word or a short phrase" onChange={e => setText(e.target.value)} />
      <button type="submit" className="mp-btn good" disabled={!text.trim()}>Send clue</button>
    </form>
  )
}

function GuessForm({ rt }) {
  const [text, setText] = useState('')
  return (
    <form className="uc-form" onSubmit={e => { e.preventDefault(); if (text.trim()) rt.guess(text) }}>
      <input className="mp-text" aria-label="Your guess" value={text} maxLength={40} placeholder="The civilians’ word" autoFocus onChange={e => setText(e.target.value)} />
      <button type="submit" className="mp-btn good" disabled={!text.trim()}>Guess</button>
    </form>
  )
}

function Players({ view, rt }) {
  const { phase, you } = view
  const voting = phase === 'vote' && you.alive
  const clueOf = id => view.rounds[view.rounds.length - 1]?.items.find(c => c.id === id)?.text
  return (
    <ul className="uc-players" aria-label="Players">
      {view.players.map(p => {
        const canVote = voting && p.alive && p.id !== you.id && (!view.candidates || view.candidates.includes(p.id))
        const mine = you.vote === p.id
        return (
          <li key={p.id} className={`${p.alive ? '' : 'out'} ${view.turnId === p.id ? 'turn' : ''}`}>
            <span className="uc-name">
              {p.name}{p.id === you.id ? ' (you)' : ''}
              {view.turnId === p.id && <em className="uc-tag turn">speaking</em>}
              {!p.alive && p.role && <em className={`uc-tag ${p.role}`}>{p.left ? 'left · ' : ''}{ROLE_NAMES[p.role]}</em>}
              {phase === 'vote' && p.alive && <em className="uc-tag">{p.voted ? 'voted' : 'thinking'}</em>}
              {phase === 'reveal' && <em className="uc-tag">{p.ready ? 'ready' : 'reading'}</em>}
            </span>
            {phase !== 'reveal' && p.alive && clueOf(p.id) && <span className="uc-clue">“{clueOf(p.id)}”</span>}
            {voting && p.alive && p.id !== you.id && (
              <button type="button" className={`mp-btn small ${mine ? 'primary' : ''}`} disabled={!canVote} aria-pressed={mine} onClick={() => rt.vote(p.id)}>
                {mine ? 'Voted' : 'Vote'}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function ResultBox({ view }) {
  const { result } = view
  if (!result || (view.phase !== 'result' && view.phase !== 'guess')) return null
  const name = id => view.players.find(p => p.id === id)?.name ?? '?'
  return (
    <div className="uc-result" role="status">
      {result.eliminated ? (
        <p><b>{result.eliminated.name}</b> was voted out. They were <b>{ROLE_NAMES[result.eliminated.role]}</b>.</p>
      ) : (
        <p>It was a tie, so nobody is out.</p>
      )}
      {result.guess && !result.guess.correct && <p>{name(result.guess.id)} guessed “{result.guess.text || '…'}” and was wrong.</p>}
      <details>
        <summary>Who voted for whom</summary>
        <ul>{result.votes.map((v, i) => <li key={i}>{name(v.from)} → {name(v.to)}</li>)}</ul>
      </details>
    </div>
  )
}

function Over({ view, rt }) {
  const won = iWon(view)
  const isHost = rt.room?.hostId === rt.me?.id
  return (
    <div className="uc-overlay" role="dialog" aria-modal="true" aria-label="Game over">
      <div className={`uc-over ${won ? 'won' : 'lost'}`}>
        <h2>{winnerTitle(view)}</h2>
        <p>{won ? 'You are on the winning side!' : 'Not this time.'}</p>
        {view.words && (
          <p className="uc-words">Civilians: <b>{view.words.civilian}</b> · Undercover: <b>{view.words.undercover}</b></p>
        )}
        <ul className="uc-roles">
          {view.players.map(p => <li key={p.id}><span>{p.name}</span><em className={`uc-tag ${p.role}`}>{ROLE_NAMES[p.role]}</em></li>)}
        </ul>
        {view.result?.guess?.correct && <p>{view.players.find(p => p.id === view.result.guess.id)?.name} guessed the word: “{view.result.guess.text}”.</p>}
        {isHost ? <button type="button" className="mp-btn good" autoFocus onClick={rt.toLobby}>Play again</button> : <p className="mp-note">Waiting for the host…</p>}
        <button type="button" className="mp-btn ghost" onClick={rt.leave}>Leave room</button>
      </div>
    </div>
  )
}

const PHASE_TITLE = { reveal: 'Read your word', clue: 'Give a clue', vote: 'Vote someone out', guess: 'Mr. White’s guess', result: 'Result', over: 'Game over' }

function Match({ rt }) {
  const { view } = rt
  const left = useCountdown(view, rt.receivedAt)
  const { phase, you } = view
  const speaker = view.players.find(p => p.id === view.turnId)
  const waiting = view.players.filter(p => p.alive && (phase === 'vote' ? !p.voted : phase === 'reveal' ? !p.ready : false)).length
  return (
    <div className="uc-match">
      <header className="uc-head">
        <span>Round {view.round}</span>
        <b>{PHASE_TITLE[phase]}</b>
        <span className="uc-timer" aria-label="Time left">{phase === 'over' ? '' : `${left}s`}</span>
      </header>
      <p className="uc-counts">{view.counts.civilian} civilians · {view.counts.undercover} Undercover · {view.counts.mrwhite} Mr. White</p>
      <WordCard you={you} />
      {!you.alive && phase !== 'over' && <p className="mp-note">You are out. You can still watch.</p>}

      {phase === 'reveal' && (
        <div className="uc-action">
          <p>Remember your word, but do not say it. Everyone is ready soon.</p>
          <button type="button" className="mp-btn good" disabled={you.ready} onClick={rt.ready}>{you.ready ? `Waiting for ${waiting} more…` : 'I’m ready'}</button>
        </div>
      )}
      {phase === 'clue' && (
        <div className="uc-action" role="status">
          {view.turnId === you.id ? (
            <>
              <p><b>Your turn.</b> Say something about your word without saying it.</p>
              <ClueForm rt={rt} />
            </>
          ) : <p>Waiting for <b>{speaker?.name}</b> to give a clue…</p>}
        </div>
      )}
      {phase === 'vote' && (
        <div className="uc-action" role="status">
          <p>
            {view.candidates ? 'It was a tie. Vote again between the tied players. ' : ''}
            {you.alive ? (you.vote ? 'You can change your vote until time runs out.' : 'Who sounds off? Tap Vote.') : 'The others are voting.'} {waiting > 0 && `Waiting for ${waiting}.`}
          </p>
        </div>
      )}
      {phase === 'guess' && (
        <div className="uc-action" role="status">
          {view.guessFor === you.id ? (
            <>
              <p><b>You were voted out!</b> Guess the civilians’ word to win.</p>
              <GuessForm rt={rt} />
            </>
          ) : <p>Mr. White is guessing the civilians’ word…</p>}
        </div>
      )}
      <ResultBox view={view} />
      <Players view={view} rt={rt} />
      <Clues view={view} />
      {rt.error && <p className="mp-note warn" role="alert">{rt.error}</p>}
      {phase === 'over' && <Over view={view} rt={rt} />}
    </div>
  )
}

/** Undercover: a multiplayer word-deduction game. Rooms and rules run on the LAN server (server/). */
export default function UndercoverGame() {
  const rt = useUndercover()
  let screen
  if (!rt.room) {
    screen = (
      <RoomMenu
        rt={rt} nameKey="undercover:name" title="Undercover"
        intro="Everyone gets a secret word. Give clues, spot who has a different word, and vote them out."
      />
    )
  } else if (rt.room.phase === 'lobby' || !rt.view) screen = <Lobby rt={rt} />
  else screen = <Match rt={rt} />
  return <div className="mp-root uc-root">{screen}</div>
}
