import { Link } from 'react-router-dom'
import { landingPath, playPath } from '../seo/site'
import GameArt from './GameArt'

// "Play <game>" call-to-action used inside blog posts (once mid-article, once after the last section).
export default function PlayCta({ game, inline = false }) {
  return (
    <aside className={`play-cta${inline ? ' inline' : ''}`} style={{ '--accent': game.color }} aria-label={`Play ${game.title}`}>
      <GameArt seed={game.id} color={game.color} emoji={game.emoji} className="play-cta-art" />
      <div className="play-cta-body">
        <p className="play-cta-title">Play {game.title}</p>
        <p className="play-cta-text">{game.description}</p>
        <div className="play-cta-actions">
          <Link to={playPath(game.id)} className="btn-play">
            Play {game.title}
          </Link>
          <Link to={landingPath(game.id)} className="btn-ghost">
            How to play
          </Link>
        </div>
      </div>
    </aside>
  )
}
