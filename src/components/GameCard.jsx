import { Link } from 'react-router-dom'
import { totalStars, useProgress } from '../platform/progress'
import { landingPath, playPath } from '../seo/site'

// The card links to the game's landing page (what we want Google to find); "Play" jumps straight into the game.
export default function GameCard({ game }) {
  const progress = useProgress(game.id)
  const started = progress.best > 0
  return (
    <article className="card" style={{ '--accent': game.color }}>
      <Link to={landingPath(game.id)} className="card-link">
        <div className="card-art" aria-hidden="true">{game.emoji}</div>
        <div className="card-body">
          <span className="tag">{game.category}</span>
          <h3>{game.title}</h3>
          <p>{game.description}</p>
          {started && <p className="card-progress">Level {progress.best} cleared · ★ {totalStars(progress)}</p>}
        </div>
      </Link>
      <div className="card-actions">
        <Link to={playPath(game.id)} className="play" aria-label={`${started ? 'Continue' : 'Play'} ${game.title}`}>
          ▶ {started ? 'Continue' : 'Play'}
        </Link>
        <Link to={landingPath(game.id)} className="card-more">How to play</Link>
      </div>
    </article>
  )
}
