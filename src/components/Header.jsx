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
        <NavLink to="/about">About</NavLink>
        <button className="nav-btn" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
          ⚙️
        </button>
      </nav>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </header>
  );
}
