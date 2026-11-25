import { useEffect, useMemo, useState } from 'react'
import LobbyShell from '../../platform/multiplayer/LobbyShell'
import RoomMenu from '../../platform/multiplayer/RoomMenu'
import '../../platform/multiplayer/multiplayer.css'
import { shareResult } from '../../platform/share'
import {
  avatarAt, cellsInLines, clearCell, isComplete, lineNames, nextEmpty, placeNumber, shuffledBoard, unusedNumbers,
} from './boardSetup'
import { useBingo } from './useBingo'
import './BingoGame.css'

const TURN_LABEL = s => (s === 0 ? 'No limit' : `${s} seconds`)
const NEED = 5

function Avatar({ index, size = 28 }) {
  const a = avatarAt(index)
  return <span className="br-avatar" style={{ background: a.color, width: size, height: size, fontSize: size * 0.58 }} aria-hidden="true">{a.emoji}</span>
}

/** Falling paper pieces. Positions come from the piece number, so it renders the same every time. */
function Confetti() {
  return (
    <div className="br-confetti" aria-hidden="true">
      {Array.from({ length: 48 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`, background: ['#ffd23f', '#ff5d8f', '#2ec4b6', '#8b5cf6', '#ff7a45', '#3b82f6'][i % 6],
            animationDelay: `${(i % 8) * 0.18}s`, animationDuration: `${2.6 + (i % 5) * 0.4}s`, transform: `rotate(${i * 29}deg)`,
          }}
        />
      ))}
    </div>
  )
}

// ---- setting up a board ----

function BoardSetup({ rt, ready }) {
  const { draft, setDraft } = rt
  const [cell, setCell] = useState(-1) // the square waiting for a number
  const [num, setNum] = useState(0) // the number waiting for a square
  const tray = useMemo(() => unusedNumbers(draft), [draft])
  const complete = isComplete(draft)

  // Square first, then number: move on to the next empty square, so a board fills with a tap per number.
  const put = (index, n, advance) => {
    const next = placeNumber(draft, index, n)
    setDraft(next)
    setNum(0)
    setCell(advance ? nextEmpty(next, index) : -1)
  }
  const tapCell = i => {
    if (ready) return
    if (num) put(i, num, false)
    else if (cell === i && draft[i]) {
      setDraft(clearCell(draft, i))
    } else setCell(i)
  }
  const tapNumber = n => {
    if (ready) return
    if (cell >= 0) put(cell, n, true)
    else setNum(num === n ? 0 : n)
  }

  return (
    <section className="br-setup" aria-label="Arrange your board">
      <p className="mp-note">
        {ready
          ? 'Your board is locked in. Waiting for the others.'
          : 'Tap a square, then a number. Or pick a number first, then a square. Tap a filled square twice to empty it.'}
      </p>
      <div className="br-grid" role="group" aria-label="Your board">
        {draft.map((n, i) => (
          <button
            key={i} type="button" className={`br-cell ${n ? '' : 'empty'} ${cell === i ? 'picked' : ''}`}
            aria-label={`Square ${i + 1}, ${n ? n : 'empty'}`} aria-disabled={ready} onClick={() => tapCell(i)}
          >
            {n || ''}
          </button>
        ))}
      </div>
      {!ready && (
        <>
          <div className="br-tray" role="group" aria-label="Numbers left to place">
            {tray.length === 0 ? <span className="br-tray-done">All 25 numbers placed</span> : tray.map(n => (
              <button key={n} type="button" className={`br-chip ${num === n ? 'picked' : ''}`} aria-label={`Number ${n}`} onClick={() => tapNumber(n)}>{n}</button>
            ))}
          </div>
          <div className="br-row">
            <button type="button" className="mp-btn" onClick={() => { setDraft(shuffledBoard(Math.random)); setCell(-1); setNum(0) }}>🔀 Shuffle</button>
            <button type="button" className="mp-btn ghost" onClick={() => { setDraft(Array(25).fill(null)); setCell(0); setNum(0) }}>Clear</button>
          </div>
        </>
      )}
      {ready ? (
        <button type="button" className="mp-btn" onClick={rt.editBoard}>Edit my board</button>
      ) : (
        <button type="button" className="mp-btn good" disabled={!complete} onClick={() => rt.confirmBoard(draft)}>
          {complete ? 'Confirm my board' : `Place ${tray.length} more number${tray.length === 1 ? '' : 's'}`}
        </button>
      )}
    </section>
  )
}

function Lobby({ rt }) {
  const { room, me } = rt
  const isHost = room.hostId === me?.id
  const mine = room.players.find(p => p.id === me?.id)
  const everyone = room.players.length >= 2 && room.players.every(p => p.ready)
  const turnSeconds = room.settings.turnSeconds
  const invite = () => shareResult({
    title: 'Bingo Royale',
    text: `Join my Bingo Royale game on Game8Arena! Room code: ${room.code}`,
    url: window.location.href,
  })
  return (
    <LobbyShell
      rt={rt} minPlayers={2} canStart={everyone}
      startNote={room.players.length >= 2 && !everyone ? 'Everyone must confirm their board before the game can start.' : ''}
      prefix={(p, i) => <><b className="br-order">{i + 1}</b><Avatar index={i} size={26} /></>}
      footer={
        <details className="mp-how">
          <summary>How to play</summary>
          <p>Fill your 5 by 5 board with the numbers 1 to 25, in any order. Players take turns, clockwise, to announce one number nobody has used.</p>
          <p>Each announced number is marked on every board. Complete 5 lines (rows, columns or the two diagonals) before anyone else to win.</p>
        </details>
      }
    >
      <button type="button" className="mp-btn" onClick={invite}>📨 Copy invite</button>
      <p className="mp-note">Players go clockwise in the order shown above (1 first). Up to 8 players.</p>
      <label className="mp-field">
        <span>Time for each turn</span>
        {isHost ? (
          <select aria-label="Time for each turn" value={turnSeconds} onChange={e => rt.setSettings({ turnSeconds: Number(e.target.value) })}>
            {(room.limits?.turnSeconds || [0, 15, 30, 60]).map(s => <option key={s} value={s}>{TURN_LABEL(s)}</option>)}
          </select>
        ) : <b>{TURN_LABEL(turnSeconds)}</b>}
      </label>
      <BoardSetup rt={rt} ready={Boolean(mine?.ready)} />
    </LobbyShell>
  )
}

// ---- the match ----

function useCountdown(view, receivedAt) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!view?.left) return undefined
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [view?.left, view?.turnId])
  return view?.left ? Math.max(0, view.left - Math.floor((now - receivedAt) / 1000)) : 0
}

/** One player's board, with announced numbers marked and completed lines lit up. */
function BoardView({ player, called, lastCalled, small = false }) {
  const inLines = cellsInLines(player.lines)
  return (
    <div className={`br-grid ${small ? 'small' : ''}`} role="group" aria-label={`${player.name}'s board`}>
      {player.board.map((n, i) => {
        const marked = called.has(n)
        return (
          <div
            key={i} className={`br-cell static ${marked ? 'marked' : ''} ${inLines.has(i) ? 'line' : ''} ${n === lastCalled ? 'fresh' : ''}`}
            aria-label={`${n}${marked ? ', announced' : ''}${inLines.has(i) ? ', in a completed line' : ''}`}
          >
            {n}
          </div>
        )
      })}
    </div>
  )
}

function Progress({ count }) {
  return (
    <div className="br-progress" aria-label={`${Math.min(count, NEED)} of ${NEED} lines`}>
      <div className="br-bar"><i style={{ width: `${Math.min(100, (count / NEED) * 100)}%` }} /></div>
      <b>{count}/{NEED} lines</b>
    </div>
  )
}

function Picker({ rt, view }) {
  const [pick, setPick] = useState(0)
  const calledSet = new Set(view.called.map(c => c.n))
  const left = Array.from({ length: 25 }, (_, i) => i + 1).filter(n => !calledSet.has(n))
  const chosen = left.includes(pick) ? pick : 0
  return (
    <section className="br-picker" aria-label="Choose a number to announce">
      <div className="br-numbers">
        {left.map(n => (
          <button key={n} type="button" className={`br-chip ${chosen === n ? 'picked' : ''}`} aria-label={`Number ${n}`} onClick={() => setPick(n)}>{n}</button>
        ))}
      </div>
      <button type="button" className="br-announce" disabled={!chosen} onClick={() => { rt.call(chosen); setPick(0) }}>
        {chosen ? `📣 Announce ${chosen}` : 'Pick a number'}
      </button>
    </section>
  )
}

function Over({ view, rt }) {
  const isHost = rt.room?.hostId === rt.me?.id
  const winners = view.players.filter(p => view.winners.includes(p.id))
  const iWon = view.winners.includes(view.you)
  const calledSet = new Set(view.called.map(c => c.n))
  const standings = [...view.players].sort((a, b) => b.count - a.count)
  const place = id => view.players.findIndex(p => p.id === id)
  let title = 'No winner this time'
  if (winners.length === 1) title = iWon ? 'You win! 🎉' : `${winners[0].name} wins!`
  else if (winners.length > 1) title = `It’s a tie: ${winners.map(w => w.name).join(' & ')}`
  const first = winners[0]
  return (
    <div className="br-overlay" role="dialog" aria-modal="true" aria-label="Game over">
      <Confetti />
      <div className={`br-over ${iWon ? 'won' : ''}`}>
        {first && <Avatar index={place(first.id)} size={64} />}
        <h2>{title}</h2>
        {view.forfeit && <p className="mp-note">Everyone else left the game.</p>}
        {first && (
          <>
            <p className="br-lines-won">{lineNames(first.lines).join(' · ')}</p>
            {first.id === view.you && <BoardView player={first} called={calledSet} lastCalled={view.called.at(-1)?.n} small />}
          </>
        )}
        <ol className="br-standings" aria-label="Final scores">
          {standings.map(p => (
            <li key={p.id} className={view.winners.includes(p.id) ? 'top' : ''}>
              <Avatar index={place(p.id)} size={24} />
              <span>{p.name}{p.id === view.you ? ' (you)' : ''}{p.active ? '' : ' (left)'}</span>
              <b>{Math.min(p.count, 12)} {p.count === 1 ? 'line' : 'lines'}</b>
            </li>
          ))}
        </ol>
        {isHost ? (
          <div className="br-row">
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
  const left = useCountdown(view, rt.receivedAt)
  const calledSet = useMemo(() => new Set(view.called.map(c => c.n)), [view.called])
  const last = view.called.at(-1)
  const meIndex = view.players.findIndex(p => p.id === view.you)
  const me = view.players[meIndex]
  const nameOf = id => view.players.find(p => p.id === id)?.name ?? '?'
  const myTurn = view.turnId === view.you && view.phase === 'play'
  return (
    <div className="br-match">
      <div className={`br-turn ${myTurn ? 'mine' : ''}`} role="status">
        {view.phase === 'play' && (
          <>
            <Avatar index={view.players.findIndex(p => p.id === view.turnId)} size={34} />
            <span>{myTurn ? 'Your turn! Pick a number to announce.' : `${nameOf(view.turnId)} is choosing a number…`}</span>
            {view.turnSeconds > 0 && <b className={`br-clock ${left <= 5 ? 'low' : ''}`} aria-label="Seconds left">⏱ {left}s</b>}
          </>
        )}
      </div>

      <ol className="br-order-strip" aria-label="Playing order, clockwise">
        {view.players.map((p, i) => (
          <li key={p.id} className={`${p.id === view.turnId ? 'turn' : ''} ${p.active ? '' : 'gone'}`}>
            <Avatar index={i} size={30} />
            <span>{p.name}{p.id === view.you ? ' (you)' : ''}</span>
            <b>{p.count}/{NEED}</b>
          </li>
        ))}
      </ol>

      <div className="br-called" aria-live="polite">
        {last ? (
          <div className="br-ball" key={view.called.length}>
            <span className="br-ball-n">{last.n}</span>
            <span className="br-ball-by">{last.auto ? `${nameOf(last.by)} ran out of time` : `${nameOf(last.by)} announced`}</span>
          </div>
        ) : <p className="mp-note">Nothing announced yet. {myTurn ? 'You go first!' : `${nameOf(view.turnId)} goes first.`}</p>}
        {view.called.length > 0 && (
          <ul className="br-history" aria-label="Announced numbers">
            {view.called.map(c => <li key={c.n}>{c.n}</li>)}
          </ul>
        )}
      </div>

      {me && (
        <section className="br-mine" aria-label="Your board">
          <Progress count={me.count} />
          <BoardView player={me} called={calledSet} lastCalled={last?.n} />
          {me.lines.length > 0 && <p className="br-lines-won">{lineNames(me.lines).join(' · ')}</p>}
        </section>
      )}

      {myTurn ? <Picker rt={rt} view={view} /> : view.phase === 'play' && <p className="mp-note br-wait">Wait for your turn. Numbers are marked on your board as they are announced.</p>}

      {view.phase === 'over' && <Over view={view} rt={rt} />}
    </div>
  )
}

/** Bingo Royale: a multiplayer Bingo where players arrange their own boards and take turns announcing numbers. */
export default function BingoGame() {
  const rt = useBingo()
  let screen
  if (!rt.room) {
    screen = (
      <RoomMenu
        rt={rt} nameKey="bingo:name" title="Bingo Royale"
        intro="Arrange 1 to 25 on your own board, then take turns announcing numbers. First to complete 5 lines wins."
      />
    )
  } else if (rt.room.phase === 'lobby' || !rt.view) screen = <Lobby rt={rt} />
  else screen = <Match rt={rt} />
  return <div className="mp-root br-root">{screen}</div>
}
