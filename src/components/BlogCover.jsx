import { postCover, postGame } from '../data/blogMeta'
import GameArt from './GameArt'

const FALLBACK = { News: { emoji: '📰', color: '#ff2e97' }, Guides: { emoji: '🧩', color: '#22d3ee' } }

// Decorative cover (the title sits right beside it, so alt is empty). Cover for a post: its topic photo when it has one, otherwise generated art tinted by the game it covers.
export default function BlogCover({ post, eager = false }) {
  const photo = postCover(post)
  if (photo)
    return (
      <div className="cover">
        <img src={photo.url} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" width="900" height="600" />
      </div>
    )
  const game = postGame(post)
  const fb = FALLBACK[post.category] || FALLBACK.Guides
  return (
    <div className="cover cover-art">
      <GameArt seed={post.slug} color={game?.color || fb.color} emoji={game?.emoji || fb.emoji} />
    </div>
  )
}
