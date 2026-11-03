import { Link } from 'react-router-dom'
import { totalStars, useProgress } from '../platform/progress'

export default function GameCard({ game }) {
  const progress = useProgress(game.id)
  const started = progress.best > 0
  return (
    <Link to={`/play/${game.id}`} className="card" style={{ '--accent': game.color }}>
      <div className="card-art" aria-hidden="true">{game.emoji}</div>
      <div className="card-body">
        <span className="tag">{game.category}</span>
        <h3>{game.title}</h3>
        <p>{game.description}</p>
        {started && <p className="card-progress">Level {progress.best} cleared · ★ {totalStars(progress)}</p>}
        <span className="play">▶ {started ? 'Continue' : 'Play'}</span>
      </div>
    </Link>
  )
}
