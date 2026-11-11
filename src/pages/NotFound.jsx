import { Link } from 'react-router-dom'
import { games } from '../data/games'
import Seo from '../seo/Seo'
import { landingPath } from '../seo/site'

// Real "not found" page (noindex), instead of silently showing the home page, which Google treats as a soft 404.
export default function NotFound() {
  return (
    <div className="notfound">
      <Seo title="Page not found" description="This page doesn’t exist. Pick one of our free online puzzle games instead." path="/404" noindex />
      <h1>Page not found</h1>
      <p>That page doesn’t exist, but these games do:</p>
      <ul className="notfound-links">
        {games.map(g => <li key={g.id}><Link to={landingPath(g.id)}>{g.emoji} {g.title}</Link></li>)}
      </ul>
      <Link to="/" className="back">← Back to all games</Link>
    </div>
  )
}
