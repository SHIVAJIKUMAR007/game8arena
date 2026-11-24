import { useState } from 'react'
import { readJSON, writeJSON } from '../storage'
import './multiplayer.css'

/** Start screen of a multiplayer game: your name, then create a room or join one by its 4-letter code. */
export default function RoomMenu({ rt, title, intro, nameKey }) {
  const [name, setName] = useState(() => {
    const saved = readJSON(nameKey, '')
    return typeof saved === 'string' ? saved : ''
  })
  const [code, setCode] = useState('')
  const remember = () => writeJSON(nameKey, name.trim())
  const ready = rt.conn === 'open'
  return (
    <div className="mp-panel">
      <h2>{title}</h2>
      <p className="mp-sub">{intro}</p>
      {rt.conn === 'connecting' && <p className="mp-note">{rt.mode === 'p2p' ? 'Getting ready…' : 'Connecting to the game server…'}</p>}
      {rt.conn === 'closed' && (
        <div className="mp-note warn" role="alert">
          {rt.mode === 'p2p' ? (
            <>
              <b>The room closed.</b> The host left or lost their connection. Start a new room, or ask the host for a new code.
            </>
          ) : (
            <>
              <b>Can’t reach a game server.</b> This game runs on one computer on your Wi-Fi. On that computer run <code>npm run host</code>, then
              everyone opens the address it prints.
            </>
          )}
          <div><button type="button" className="mp-btn small" onClick={rt.retry}>{rt.mode === 'p2p' ? 'Back to start' : 'Try again'}</button></div>
        </div>
      )}
      {rt.conn === 'open' && rt.mode === 'p2p' && (
        <p className="mp-note">One player creates a room and keeps this page open. Everyone else joins with the 4-letter code. Nothing to install.</p>
      )}
      <label className="mp-field">
        <span>Your name</span>
        <input value={name} maxLength={14} placeholder="Player" onChange={e => setName(e.target.value)} />
      </label>
      <button type="button" className="mp-btn primary" disabled={!ready} onClick={() => { remember(); rt.create(name) }}>Create a room</button>
      <div className="mp-or">or join a friend’s room</div>
      <form
        className="mp-join"
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
        <button type="submit" className="mp-btn" disabled={!ready || code.length !== 4}>Join</button>
      </form>
      {rt.error && <p className="mp-note warn" role="alert">{rt.error}</p>}
    </div>
  )
}
