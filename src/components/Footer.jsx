import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      © {new Date().getFullYear()} ArcadeHub — insert coin to continue · <Link to="/privacy">Privacy</Link>
    </footer>
  )
}
