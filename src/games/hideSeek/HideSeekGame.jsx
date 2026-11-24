import { useEffect, useState } from 'react'
import { readJSON, writeJSON } from '../../platform/storage'
import Arena from './Arena'
import { infoUrl } from './net'
import { useRoom } from './useRoom'
import './HideSeekGame.css'

const DURATIONS = [
  [60, '1 minute'],
  [120, '2 minutes'],
  [180, '3 minutes'],
  [300, '5 minutes'],
]
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function Menu({ rt }) {
  const [name, setName] = useState(() => {
    const saved = readJSON('hideseek:name', '')
    return typeof saved === 'string' ? saved : ''
  })
  const [code, setCode] = useState('')
  const remember = () => writeJSON('hideseek:name', name.trim())
  const ready = rt.conn === 'open'
  return (
    <div className="hs-panel">
      <h2>Mafia Hunt</h2>
      <p className="hs-sub">One player is the mafia with a gun. Everyone else hides and tries to survive until time runs out.</p>
      {rt.conn === 'connecting' && <p className="hs-note">Connecting to the game server…</p>}
      {rt.conn === 'closed' && (
        <div className="hs-note warn" role="alert">
          <b>Can’t reach a game server.</b> Mafia Hunt runs on one computer on your Wi-Fi. On that computer run <code>npm run host</code>, then
          everyone opens the address it prints.
          <div><button type="button" className="hs-btn small" onClick={rt.retry}>Try again</button></div>
        </div>
      )}
      <label className="hs-field">
        <span>Your name</span>
        <input value={name} maxLength={14} placeholder="Player" onChange={e => setName(e.target.value)} />
      </label>
      <button type="button" className="hs-btn primary" disabled={!ready} onClick={() => { remember(); rt.create(name) }}>Create a room</button>
      <div className="hs-or">or join a friend’s room</div>
      <form
        className="hs-join"
        onSubmit={e => {
          e.preventDefault()
          remember()
          rt.join(code, name)
        }}
      >
        <input
          aria-label="Room code" value={code} maxLength={4} placeholder="CODE" autoCapitalize="characters" autoComplete="off"
          onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
        />
        <button type="submit" className="hs-btn" disabled={!ready || code.length !== 4}>Join</button>
      </form>
      {rt.error && <p className="hs-note warn" role="alert">{rt.error}</p>}
    </div>
  )
}

function Lobby({ rt }) {
  const { room, me } = rt
  const isHost = room.hostId === me?.id
  const [addresses, setAddresses] = useState([])
  useEffect(() => {
    let off = false
    fetch(infoUrl())
      .then(r => r.json())
      .then(info => !off && setAddresses((info.ips || []).map(ip => `http://${ip}:${info.port}`)))
      .catch(() => {})
    return () => { off = true }
  }, [])
  const enough = room.players.length >= 2
  return (
    <div className="hs-panel">
      <p className="hs-sub">Room code</p>
      <div className="hs-code" aria-label={`Room code ${room.code.split('').join(' ')}`}>{room.code}</div>
      {addresses.length > 0 && (
        <p className="hs-note">
          Friends on this Wi-Fi: open {addresses.map(a => <b key={a}>{a}</b>)} then choose Mafia Hunt and join with the code.
        </p>
      )}
      <ul className="hs-players" aria-label="Players">
        {room.players.map(p => (
          <li key={p.id}>
            <span>{p.name}{p.id === me?.id ? ' (you)' : ''}</span>
            {p.id === room.hostId && <em>host</em>}
          </li>
        ))}
      </ul>
      <label className="hs-field">
        <span>Map</span>
        {isHost ? (
          <select aria-label="Map" value={room.settings.map} onChange={e => rt.setMap(e.target.value)}>
            <option value="random">Random</option>
            {(room.maps || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        ) : (
          <b>{room.settings.map === 'random' ? 'Random' : (room.maps || []).find(m => m.id === room.settings.map)?.name}</b>
        )}
      </label>
      <label className="hs-field">
        <span>Round length</span>
        {isHost ? (
          <select aria-label="Round length" value={room.settings.duration} onChange={e => rt.setDuration(Number(e.target.value))}>
            {DURATIONS.map(([s, label]) => <option key={s} value={s}>{label}</option>)}
          </select>
        ) : (
          <b>{DURATIONS.find(([s]) => s === room.settings.duration)?.[1]}</b>
        )}
      </label>
      {isHost ? (
        <button type="button" className="hs-btn primary" disabled={!enough} onClick={rt.start}>
          {enough ? 'Start game' : 'Waiting for another player…'}
        </button>
      ) : (
        <p className="hs-note">Waiting for the host to start…</p>
      )}
      <button type="button" className="hs-btn ghost" onClick={rt.leave}>Leave room</button>
      {rt.error && <p className="hs-note warn" role="alert">{rt.error}</p>}
      <details className="hs-how">
        <summary>How to play</summary>
        <p>One random player is the <b>mafia</b>. The others get 15 seconds to hide, then the mafia is let loose.</p>
        <p>The mafia wins by shooting everyone before the time runs out. If anyone is still alive at the end, the <b>villagers</b> win.</p>
        <p>You can only see a short way around you, and walls block your view and the bullets. Move with WASD or the arrow keys, aim with the mouse, click or press Space to shoot. On a phone, use the stick and tap to shoot.</p>
      </details>
    </div>
  )
}

function Result({ rt }) {
  const { game, over, room, me } = rt
  const iAmMafia = game.mafiaId === game.you
  const mafiaName = game.players.find(p => p.id === game.mafiaId)?.name
  const iWon = (over.winner === 'mafia') === iAmMafia
  const isHost = room?.hostId === me?.id
  return (
    <div className="hs-overlay" role="dialog" aria-modal="true" aria-label="Game over">
      <div className={`hs-result ${iWon ? 'won' : 'lost'}`}>
        <h2>{over.winner === 'mafia' ? 'Mafia wins!' : 'Villagers win!'}</h2>
        <p>
          {over.winner === 'mafia'
            ? `${mafiaName} got everyone.`
            : `${over.survivors} ${over.survivors === 1 ? 'villager' : 'villagers'} survived.`}
          {' '}{iWon ? 'You won!' : 'Better luck next round.'}
        </p>
        {isHost ? (
          <button type="button" className="hs-btn primary" autoFocus onClick={rt.toLobby}>Play again</button>
        ) : (
          <p className="hs-note">Waiting for the host…</p>
        )}
        <button type="button" className="hs-btn ghost" onClick={rt.leave}>Leave room</button>
      </div>
    </div>
  )
}

function Match({ rt }) {
  const { game, hud } = rt
  const iAmMafia = game.mafiaId === game.you
  const mafiaName = game.players.find(p => p.id === game.mafiaId)?.name
  return (
    <div className="hs-match">
      <header className="hs-hud">
        <span className={`hs-role ${iAmMafia ? 'mafia' : ''}`}>{iAmMafia ? 'You are the MAFIA' : `Hide! Mafia: ${mafiaName}`}</span>
        <span className="hs-time" aria-label="Time left">{hud ? clock(hud.phase === 'hide' ? game.duration : hud.left) : clock(game.duration)}</span>
        <span className="hs-alive">{game.mapName} · {hud ? `${hud.alive}/${hud.total} alive` : ''}</span>
      </header>
      {hud?.phase === 'hide' && (
        <div className="hs-banner" role="status">
          {iAmMafia ? `Wait… the others are hiding (${hud.left}s)` : `Run and hide! The mafia is released in ${hud.left}s`}
        </div>
      )}
      {hud && !hud.meAlive && !rt.over && <div className="hs-banner dead" role="status">You are out. Watching the rest.</div>}
      <Arena game={game} snapRef={rt.snapRef} shotsRef={rt.shotsRef} send={rt.send} />
      {rt.over && <Result rt={rt} />}
    </div>
  )
}

/** Mafia Hunt: multiplayer hide and seek. Rooms and the game itself run on the LAN server (server/). */
export default function HideSeekGame() {
  const rt = useRoom()
  let screen
  if (!rt.room) screen = <Menu rt={rt} />
  else if (rt.room.phase === 'lobby' || !rt.game) screen = <Lobby rt={rt} />
  else screen = <Match rt={rt} />
  return <div className="hs-root">{screen}</div>
}
