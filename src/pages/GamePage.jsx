import { Suspense } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { games } from '../data/games'
import ErrorBoundary from '../platform/ui/ErrorBoundary'
import { totalStars, useProgress } from '../platform/progress'
import { pickDaily } from '../platform/daily'
import Seo from '../seo/Seo'
import { landingPath, playPath } from '../seo/site'
import NotFound from './NotFound'

export default function GamePage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const game = games.find(g => g.id === id)
  const progress = useProgress(id)

  if (!game) return <NotFound />

  const Game = game.component // plug a real game component in via games.js

  return (
    <div className="game-page" style={{ '--accent': game.color }}>
      {/* The landing page (/games/:id) is the one we want ranked; the bare game screen stays out of the index
          so the two don't compete for the same searches. */}
      <Seo title={`Play ${game.title} free online`} description={game.description} path={playPath(id)} noindex />
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
              <p>Coming soon!</p>
            </div>
          )}
        </div>
        <aside className="side">
          <h2>{game.title}</h2>
          <span className="tag">{game.category}</span>
          <p>{game.description}</p>
          {game.controls && <><h4>Controls</h4><p>{game.controls}</p></>}
          <h4>Your progress</h4>
          <p>Best level <b>{progress.best}</b> · ★ <b>{totalStars(progress)}</b></p>
          <h4>High score</h4>
          <p className="score">{progress.highScore}</p>
          <p><Link to={landingPath(game.id)} className="side-link">How to play, tips &amp; FAQ →</Link></p>
        </aside>
      </div>
    </div>
  )
}
