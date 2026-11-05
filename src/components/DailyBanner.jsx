import { Link } from 'react-router-dom'
import { games } from '../data/games'
import { overallDaily, pickDaily, useDaily } from '../platform/daily'

export default function DailyBanner() {
  const picks = pickDaily(games.filter(g => g.daily).map(g => g.id))
  const state = useDaily() // re-render when a daily is finished (also in other tabs)
  if (!picks.length) return null
  const { done, complete, streak } = overallDaily(picks, state)
  const finished = picks.filter(id => done.includes(id)).length

  return (
    <section className="daily" aria-label="Daily challenge">
      <h2>📅 Daily challenge</h2>
      <p className="daily-sub">
        {picks.length} games, one level each. Finish all {picks.length} to keep your streak.
      </p>
      <p className="daily-summary">
        <span className={complete ? 'daily-complete' : ''}>{complete ? '✓ All done today!' : `${finished}/${picks.length} done`}</span>
        {streak > 0 && <span className="daily-streak">🔥 {streak}-day streak</span>}
      </p>
      {picks.map(id => {
        const game = games.find(g => g.id === id)
        const isDone = done.includes(id)
        return (
          <Link key={id} to={`/play/${id}?mode=daily`} className={`daily-row${isDone ? ' done' : ''}`}>
            <span className="daily-game">{game.emoji} <b>{game.title}</b></span>
            <span className="daily-status">{isDone ? '✓ Done' : 'Play now →'}</span>
          </Link>
        )
      })}
    </section>
  )
}
