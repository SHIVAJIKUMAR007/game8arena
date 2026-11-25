import { useState } from 'react'
import LevelGameShell from '../../platform/LevelGameShell'
import TambolaBoard from './TambolaBoard'
import TambolaOnline from './TambolaOnline'
import { config } from './config'
import './TambolaOnline.css'

// Tambola has two ways to play. Solo races computer players through levels (the level shell). Multiplayer is a room of
// friends who each cut their own numbers. `?mode=multi` opens multiplayer; any other `?mode=` (such as daily) is solo.
export default function TambolaGame({ initialMode, ...props }) {
  const [mode, setMode] = useState(initialMode === 'multi' ? 'multi' : initialMode ? 'solo' : null)

  if (mode === 'solo') return <LevelGameShell gameId="tambola" title="Tambola" config={config} Board={TambolaBoard} initialMode={initialMode} {...props} />
  if (mode === 'multi') return <TambolaOnline onBack={() => setMode(null)} />
  return (
    <div className="tm-modes">
      <h2>Tambola</h2>
      <p>How do you want to play?</p>
      <button type="button" className="tm-mode" onClick={() => setMode('multi')}>
        <b>👥 Play with friends</b>
        <span>Make a room and share the code. Cut every number yourself in time, or you are out of the round.</span>
      </button>
      <button type="button" className="tm-mode" onClick={() => setMode('solo')}>
        <b>🎟️ Solo levels</b>
        <span>Race computer players through levels that get faster and harder.</span>
      </button>
    </div>
  )
}
