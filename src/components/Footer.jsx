import { Link } from 'react-router-dom'
import { games } from '../data/games'
import { landingPath } from '../seo/site'

export default function Footer() {
  return (
    <footer className="footer">
      {/* Crawlable links to every game's landing page from every page of the site. */}
      <nav aria-label="All games" className="footer-games">
        {games.map(g => <Link key={g.id} to={landingPath(g.id)}>{g.title}</Link>)}
      </nav>
      <p>
        © {new Date().getFullYear()} Game8Arena — insert coin to continue · <Link to="/about">About</Link> · <Link to="/privacy">Privacy</Link>
      </p>
    </footer>
  )
}
