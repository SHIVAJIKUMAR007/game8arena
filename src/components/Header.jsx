import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import SettingsModal from '../platform/ui/SettingsModal'

export default function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <header className="header">
      <Link to="/" className="logo">🕹️ ARCADE<span>HUB</span></Link>
      <nav aria-label="Main">
        <NavLink to="/" end>Games</NavLink>
        <NavLink to="/about">About</NavLink>
        <button className="nav-btn" aria-label="Settings" onClick={() => setSettingsOpen(true)}>⚙️</button>
      </nav>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </header>
  )
}
