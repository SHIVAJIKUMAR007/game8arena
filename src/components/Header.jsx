import { Link, NavLink } from 'react-router-dom'

export default function Header() {
  return (
    <header className="header">
      <Link to="/" className="logo">🕹️ ARCADE<span>HUB</span></Link>
      <nav>
        <NavLink to="/" end>Games</NavLink>
        <NavLink to="/about">About</NavLink>
      </nav>
    </header>
  )
}
