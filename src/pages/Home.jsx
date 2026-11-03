import { useEffect, useState } from 'react'
import GameCard from '../components/GameCard'
import DailyBanner from '../components/DailyBanner'
import { games } from '../data/games'

const categories = ['All', ...new Set(games.map(g => g.category))]

export default function Home() {
  const [cat, setCat] = useState('All')
  const [query, setQuery] = useState('')
  useEffect(() => { document.title = 'ArcadeHub — free arcade & puzzle games' }, [])

  const shown = games.filter(g =>
    (cat === 'All' || g.category === cat) &&
    g.title.toLowerCase().includes(query.toLowerCase()))

  return (
    <>
      <section className="hero">
        <h1>Pick a game. <span>Press start.</span></h1>
        <p>Classic arcade fun, right in your browser.</p>
      </section>

      <DailyBanner />

      <section className="toolbar">
        <div className="chips">
          {categories.map(c => (
            <button key={c} className={c === cat ? 'chip active' : 'chip'} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <input type="search" aria-label="Search games" placeholder="Search games…" value={query} onChange={e => setQuery(e.target.value)} />
      </section>

      <section className="grid">
        {shown.map(g => <GameCard key={g.id} game={g} />)}
        {shown.length === 0 && <p className="empty">No games found.</p>}
      </section>
    </>
  )
}
