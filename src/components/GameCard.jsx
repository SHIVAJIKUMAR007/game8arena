import { Link } from 'react-router-dom'
import { gameCategories } from '../data/gameCategories'
import { gameMeta } from '../data/gameMeta'
import { usePlays } from '../platform/plays'
import { totalStars, useProgress } from '../platform/progress'
import { landingPath, playPath } from '../seo/site'
import GameArt from './GameArt'

// The card links to the game's landing page (what we want Google to find); "Play" jumps straight into the game.
export default function GameCard({ game, index = 0 }) {
  const progress = useProgress(game.id)
  const plays = usePlays(game.id)
  const { difficulty, isNew } = gameMeta(game.id)
  const started = progress.best > 0
  return (
    <article className="card" style={{ '--accent': game.color, '--i': Math.min(index, 12) }}>
      <Link to={landingPath(game.id)} className="card-link">
        <div className="card-art">
          <GameArt seed={game.id} color={game.color} emoji={game.emoji} />
          {isNew && <span className="badge-new">New</span>}
        </div>
        <div className="card-body">
          <div className="tags">
            {gameCategories(game).map(c => <span className="tag" key={c}>{c}</span>)}
            {difficulty && (
              <span className={`diff diff-${difficulty.toLowerCase()}`}>
                <span className="diff-dots" aria-hidden="true"><i /><i /><i /></span>
                {difficulty}
              </span>
            )}
          </div>
          <h3>{game.title}</h3>
          <p>{game.description}</p>
          {started && <p className="card-progress">Level {progress.best} cleared · ★ {totalStars(progress)}</p>}
        </div>
      </Link>
      <div className="card-actions">
        <Link to={playPath(game.id)} className="play" aria-label={`${started ? 'Continue' : 'Play'} ${game.title}`}>
          ▶ {started ? 'Continue' : 'Play'}
        </Link>
        {plays > 0 ? <span className="card-plays">Played {plays}×</span> : <Link to={landingPath(game.id)} className="card-more">How to play</Link>}
      </div>
    </article>
  )
}
