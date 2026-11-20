import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import SettingsModal from "../platform/ui/SettingsModal";
// Optimised 241×112 copy of src/assets/Game8ArenaLogo.png (the 1.3 MB original is far too heavy for every page load).
import logo from "../assets/game8arena-logo.webp";

export default function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <header className="header">
      <Link to="/" className="logo" aria-label="Game8Arena home">
        <img src={logo} alt="Game8Arena" />
      </Link>
      <nav aria-label="Main">
        <NavLink to="/" end>
          Games
        </NavLink>
        <NavLink to="/blogs">Blog</NavLink>
        <NavLink to="/about">About</NavLink>
        <button className="nav-btn" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </button>
      </nav>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </header>
  );
}
