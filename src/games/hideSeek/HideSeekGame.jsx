import LobbyShell from '../../platform/multiplayer/LobbyShell'
import RoomMenu from '../../platform/multiplayer/RoomMenu'
import '../../platform/multiplayer/multiplayer.css'
import Arena from './Arena'
import { useRoom } from './useRoom'
import './HideSeekGame.css'

const DURATIONS = [
  [60, '1 minute'],
  [120, '2 minutes'],
  [180, '3 minutes'],
  [300, '5 minutes'],
]
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function Lobby({ rt }) {
  const { room, me } = rt
  const isHost = room.hostId === me?.id
  return (
    <LobbyShell
      rt={rt}
      footer={
        <details className="mp-how">
          <summary>How to play</summary>
          <p>One random player is the <b>mafia</b>. The others get 15 seconds to hide, then the mafia is let loose.</p>
          <p>The mafia wins by shooting everyone before the time runs out. If anyone is still alive at the end, the <b>villagers</b> win.</p>
          <p>You can only see a short way around you, and walls block your view and the bullets. Move with WASD or the arrow keys, aim with the mouse, click or press Space to shoot. On a phone, use the stick and tap to shoot.</p>
        </details>
      }
    >
      <label className="mp-field">
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
      <label className="mp-field">
        <span>Round length</span>
        {isHost ? (
          <select aria-label="Round length" value={room.settings.duration} onChange={e => rt.setDuration(Number(e.target.value))}>
            {DURATIONS.map(([s, label]) => <option key={s} value={s}>{label}</option>)}
          </select>
        ) : (
          <b>{DURATIONS.find(([s]) => s === room.settings.duration)?.[1]}</b>
        )}
      </label>
    </LobbyShell>
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
          <button type="button" className="mp-btn primary" autoFocus onClick={rt.toLobby}>Play again</button>
        ) : (
          <p className="mp-note">Waiting for the host…</p>
        )}
        <button type="button" className="mp-btn ghost" onClick={rt.leave}>Leave room</button>
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
  if (!rt.room) {
    screen = (
      <RoomMenu
        rt={rt} nameKey="hideseek:name" title="Mafia Hunt"
        intro="One player is the mafia with a gun. Everyone else hides and tries to survive until time runs out."
      />
    )
  } else if (rt.room.phase === 'lobby' || !rt.game) screen = <Lobby rt={rt} />
  else screen = <Match rt={rt} />
  return <div className="mp-root">{screen}</div>
}
