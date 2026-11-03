import { Link, useParams } from 'react-router-dom'
import { games } from '../data/games'

export default function GamePage() {
  const { id } = useParams()
  const game = games.find(g => g.id === id)
  if (!game) return <div className="notfound"><h2>Game not found</h2><Link to="/">← Back to games</Link></div>

  const Game = game.component // plug a real game component in via games.js

  return (
    <div className="game-page" style={{ '--accent': game.color }}>
      <Link to="/" className="back">← All games</Link>
      <div className="game-layout">
        <div className="screen">
          {Game ? <Game /> : (
            <div className="coming">
              <div className="big">{game.emoji}</div>
              <h2>{game.title}</h2>
              <p>Game canvas goes here — coming soon.</p>
            </div>
          )}
        </div>
        <aside className="side">
          <h2>{game.title}</h2>
          <span className="tag">{game.category}</span>
          <p>{game.description}</p>
          <h4>Controls</h4>
          <p>{game.controls ?? 'Arrow keys / WASD to move, Space to action.'}</p>
          <h4>High score</h4>
          <p className="score">0</p>
        </aside>
      </div>
    </div>
  )
}
