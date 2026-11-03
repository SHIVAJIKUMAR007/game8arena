import { Link } from 'react-router-dom'

export default function GameCard({ game }) {
  return (
    <Link to={`/play/${game.id}`} className="card" style={{ '--accent': game.color }}>
      <div className="card-art">{game.emoji}</div>
      <div className="card-body">
        <span className="tag">{game.category}</span>
        <h3>{game.title}</h3>
        <p>{game.description}</p>
        <span className="play">▶ Play</span>
      </div>
    </Link>
  )
}
