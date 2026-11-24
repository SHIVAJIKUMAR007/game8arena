import { useEffect, useRef, useState } from 'react'
import LobbyShell from '../../platform/multiplayer/LobbyShell'
import RoomMenu from '../../platform/multiplayer/RoomMenu'
import '../../platform/multiplayer/multiplayer.css'
import { useTicTacToe } from './useTicTacToe'
import './TicTacToeGame.css'

const BEST_OF_LABEL = n => (n === 1 ? 'Single game' : `Best of ${n}`)
const FIRST_LABEL = { random: 'Random', host: 'Host', guest: 'Guest' }

function Lobby({ rt }) {
  const { room, me } = rt
  const isHost = room.hostId === me?.id
  const { bestOf, first } = room.settings
  const limits = room.limits || { bestOf: [1, 3, 5], first: ['random', 'host', 'guest'] }
  return (
    <LobbyShell
      rt={rt} minPlayers={2}
      footer={
        <details className="mp-how">
          <summary>How to play</summary>
          <p>Two players take turns placing X and O on a 3 by 3 board. Get three in a row, column or diagonal to win the game.</p>
          <p>The match is a best-of series. The marks swap every game, so both players get to start.</p>
        </details>
      }
    >
      <label className="mp-field">
        <span>Match length</span>
        {isHost ? (
          <select aria-label="Match length" value={bestOf} onChange={e => rt.setSettings({ bestOf: Number(e.target.value) })}>
            {limits.bestOf.map(n => <option key={n} value={n}>{BEST_OF_LABEL(n)}</option>)}
          </select>
        ) : <b>{BEST_OF_LABEL(bestOf)}</b>}
      </label>
      <label className="mp-field">
        <span>Who plays X first</span>
        {isHost ? (
          <select aria-label="Who plays X first" value={first} onChange={e => rt.setSettings({ first: e.target.value })}>
            {limits.first.map(f => <option key={f} value={f}>{FIRST_LABEL[f]}</option>)}
          </select>
        ) : <b>{FIRST_LABEL[first]}</b>}
      </label>
    </LobbyShell>
  )
}

function Board({ view, rt }) {
  const [cursor, setCursor] = useState(4)
  const refs = useRef([])
  const mine = view.phase === 'play' && view.turnId === view.you.id
  const line = view.last?.line || []
  const onKey = (e, i) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[e.key]
    if (!step) return
    e.preventDefault()
    const col = i % 3
    if ((e.key === 'ArrowLeft' && col === 0) || (e.key === 'ArrowRight' && col === 2)) return
    const next = i + step
    if (next < 0 || next > 8) return
    setCursor(next)
    refs.current[next]?.focus()
  }
  return (
    <div className="ttt-board" role="group" aria-label="Tic Tac Toe board">
      {view.board.map((mark, i) => (
        <button
          key={i} ref={el => { refs.current[i] = el }} type="button" tabIndex={i === cursor ? 0 : -1}
          className={`ttt-cell ${mark ? mark.toLowerCase() : ''} ${line.includes(i) ? 'win' : ''}`}
          aria-label={`Square ${i + 1}, ${mark || 'empty'}`}
          aria-disabled={!mine || Boolean(mark)}
          onFocus={() => setCursor(i)}
          onKeyDown={e => onKey(e, i)}
          onClick={() => mine && !mark && rt.move(i)}
        >
          {mark}
        </button>
      ))}
    </div>
  )
}

function useCountdown(view, receivedAt) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (view?.phase !== 'between') return undefined
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [view?.phase])
  return view?.phase === 'between' ? Math.max(0, view.left - Math.floor((now - receivedAt) / 1000)) : 0
}

function Over({ view, rt }) {
  const isHost = rt.room?.hostId === rt.me?.id
  const won = view.seriesWinnerId === view.you.id
  const draw = !view.seriesWinnerId
  let title = won ? 'You win the match!' : `${view.them.name} wins the match`
  if (draw) title = 'The match is a draw'
  return (
    <div className="ttt-overlay" role="dialog" aria-modal="true" aria-label="Game over">
      <div className={`ttt-over ${won ? 'won' : 'lost'}`}>
        <h2>{title}</h2>
        {view.forfeit && <p>{view.them.name} left the game.</p>}
        <p className="ttt-final">{view.you.name} {view.you.score} – {view.them.score} {view.them.name}{view.draws ? ` · ${view.draws} draw${view.draws > 1 ? 's' : ''}` : ''}</p>
        {isHost ? <button type="button" className="mp-btn good" autoFocus onClick={rt.toLobby}>Play again</button> : <p className="mp-note">Waiting for the host…</p>}
        <button type="button" className="mp-btn ghost" onClick={rt.leave}>Leave room</button>
      </div>
    </div>
  )
}

function Match({ rt }) {
  const { view } = rt
  const wait = useCountdown(view, rt.receivedAt)
  const mine = view.turnId === view.you.id
  let status = ''
  if (view.phase === 'between') {
    const who = view.last?.winnerId
    status = `${who ? (who === view.you.id ? 'You win this game!' : `${view.them.name} wins this game`) : 'Draw!'} Next game in ${wait}s…`
  } else if (view.phase === 'play') status = mine ? `Your turn (${view.you.mark})` : `Waiting for ${view.them.name} (${view.them.mark})…`
  return (
    <div className="ttt-match">
      <header className="ttt-head">
        <span>Game {view.game} of {view.bestOf}</span>
        <b>{BEST_OF_LABEL(view.bestOf)}</b>
      </header>
      <div className="ttt-score" aria-label="Score">
        <div className={mine && view.phase === 'play' ? 'turn' : ''}><span>{view.you.name} (you, {view.you.mark})</span><b>{view.you.score}</b></div>
        <div className={!mine && view.phase === 'play' ? 'turn' : ''}><span>{view.them.name} ({view.them.mark})</span><b>{view.them.score}</b></div>
      </div>
      <p className="ttt-status" role="status">{status}</p>
      <Board view={view} rt={rt} />
      {view.phase === 'over' && <Over view={view} rt={rt} />}
    </div>
  )
}

/** Tic Tac Toe: a two-player match. Rooms and rules run in the host's browser (or on the LAN server). */
export default function TicTacToeGame() {
  const rt = useTicTacToe()
  let screen
  if (!rt.room) {
    screen = <RoomMenu rt={rt} nameKey="tictactoe:name" title="Tic Tac Toe" intro="Challenge a friend to a best-of-three match. Get three in a row to win." />
  } else if (rt.room.phase === 'lobby' || !rt.view) screen = <Lobby rt={rt} />
  else screen = <Match rt={rt} />
  return <div className="mp-root ttt-root">{screen}</div>
}
