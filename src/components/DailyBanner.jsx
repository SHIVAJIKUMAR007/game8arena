import { Link } from 'react-router-dom'
import { games } from '../data/games'
import { dailyState } from '../platform/daily'
import { useProgress } from '../platform/progress'

function DailyRow({ game }) {
  const p = useProgress(game.id)
  const { done, streak } = dailyState(p)
  return (
    <Link to={`/play/${game.id}?mode=daily`} className="daily-row">
      <span>{game.emoji} <b>{game.title}</b> — today’s puzzle</span>
      <span>{done ? '✓ Done' : 'Play now'} {streak > 0 && `· 🔥 ${streak}-day streak`}</span>
    </Link>
  )
}

export default function DailyBanner() {
  const dailyGames = games.filter(g => g.daily)
  if (!dailyGames.length) return null
  return (
    <section className="daily" aria-label="Daily challenges">
      <h2>📅 Daily challenge</h2>
      {dailyGames.map(g => <DailyRow key={g.id} game={g} />)}
    </section>
  )
}
