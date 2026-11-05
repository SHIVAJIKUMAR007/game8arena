import { Suspense, useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { games } from '../data/games'
import ErrorBoundary from '../platform/ui/ErrorBoundary'
import { totalStars, useProgress } from '../platform/progress'
import { pickDaily } from '../platform/daily'

export default function GamePage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const game = games.find(g => g.id === id)
  const progress = useProgress(id)

  useEffect(() => {
    if (game) document.title = `${game.title} — play free on ArcadeHub`
  }, [game])

  if (!game) return <div className="notfound"><h2>Game not found</h2><Link to="/">← Back to games</Link></div>

  const Game = game.component // plug a real game component in via games.js

  return (
    <div className="game-page" style={{ '--accent': game.color }}>
      <Link to="/" className="back">← All games</Link>
      <div className="game-layout">
        <div className="screen">
          {Game ? (
            <ErrorBoundary key={game.id}>
              <Suspense fallback={<div className="loading">Loading {game.title}…</div>}>
                <Game initialMode={params.get('mode')} dailyPicks={pickDaily(games.filter(g => g.daily).map(g => g.id))} />
              </Suspense>
            </ErrorBoundary>
          ) : (
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
          <h4>Your progress</h4>
          <p>Best level <b>{progress.best}</b> · ★ <b>{totalStars(progress)}</b></p>
          <h4>High score</h4>
          <p className="score">{progress.highScore}</p>
        </aside>
      </div>
    </div>
  )
}
