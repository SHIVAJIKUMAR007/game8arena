import { Link } from 'react-router-dom'
import { games } from '../data/games'
import { dailyState } from '../platform/daily'
import { useProgress } from '../platform/progress'

function DailyRow({ game }) {
  const p = useProgress(game.id)
  const { done, streak } = dailyState(p)
  return (
    <Link to={`/play/${game.id}?mode=daily`} className="daily-row">
      <span className="daily-game">{game.emoji} <b>{game.title}</b></span>
      <span className="daily-status">{done ? '✓ Done' : 'Play now →'} {streak > 0 && <span className="daily-streak">🔥 {streak}-day streak</span>}</span>
    </Link>
  )
}

export default function DailyBanner() {
  const dailyGames = games.filter(g => g.daily)
  if (!dailyGames.length) return null
  return (
    <section className="daily" aria-label="Daily challenges">
      <h2>📅 Daily challenge</h2>
      <p className="daily-sub">A new puzzle for every game, every day.</p>
      {dailyGames.map(g => <DailyRow key={g.id} game={g} />)}
    </section>
  )
}
