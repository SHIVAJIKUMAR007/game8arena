import { useEffect, useState } from 'react'
import { infoUrl } from './net'
import './multiplayer.css'

/**
 * The waiting room: room code, the Wi-Fi address to share, who is here, the game's own settings (children, only
 * the host can change them), and Start / Leave. `minPlayers` is how many are needed before the host can start.
 */
export default function LobbyShell({ rt, minPlayers = 2, startNote, canStart = true, children, footer }) {
  const { room, me } = rt
  const isHost = room.hostId === me?.id
  const [addresses, setAddresses] = useState([])
  const online = rt.mode === 'p2p'
  useEffect(() => {
    if (online) return undefined
    let off = false
    fetch(infoUrl())
      .then(r => r.json())
      .then(info => !off && setAddresses((info.ips || []).map(ip => `http://${ip}:${info.port}`)))
      .catch(() => {})
    return () => { off = true }
  }, [online])
  const enough = room.players.length >= minPlayers
  return (
    <div className="mp-panel">
      <p className="mp-sub">Room code</p>
      <div className="mp-code" aria-label={`Room code ${room.code.split('').join(' ')}`}>{room.code}</div>
      {online && (
        <p className="mp-note">
          {isHost
            ? 'Friends open game8arena.com, choose this game and join with this code. Keep this page open and visible while you play: you are the host.'
            : 'You are connected straight to the host. If the host closes their page, the room ends.'}
        </p>
      )}
      {addresses.length > 0 && (
        <p className="mp-note">
          Friends on this Wi-Fi: open {addresses.map(a => <b key={a}>{a}</b>)} then choose this game and join with the code.
        </p>
      )}
      <ul className="mp-players" aria-label="Players">
        {room.players.map(p => (
          <li key={p.id}>
            <span>{p.name}{p.id === me?.id ? ' (you)' : ''}</span>
            {p.id === room.hostId && <em>host</em>}
          </li>
        ))}
      </ul>
      {children}
      {isHost ? (
        <>
          <button type="button" className="mp-btn primary" disabled={!enough || !canStart} onClick={rt.start}>
            {enough ? 'Start game' : `Waiting for ${minPlayers - room.players.length} more…`}
          </button>
          {startNote && <p className="mp-note warn">{startNote}</p>}
        </>
      ) : (
        <p className="mp-note">Waiting for the host to start…</p>
      )}
      <button type="button" className="mp-btn ghost" onClick={rt.leave}>Leave room</button>
      {rt.error && <p className="mp-note warn" role="alert">{rt.error}</p>}
      {footer}
    </div>
  )
}
