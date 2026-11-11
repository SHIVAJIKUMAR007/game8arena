import { useState } from "react";
import { Link } from "react-router-dom";
import GameCard from "../components/GameCard";
import DailyBanner from "../components/DailyBanner";
import { games } from "../data/games";
import Seo from "../seo/Seo";
import { gameListSchema, organizationSchema, websiteSchema } from "../seo/schema";
import { SITE_DESCRIPTION, landingPath } from "../seo/site";

const categories = ["All", ...new Set(games.map((g) => g.category))];

export default function Home() {
  const [cat, setCat] = useState("All");
  const [query, setQuery] = useState("");

  const shown = games.filter((g) => (cat === "All" || g.category === cat) && g.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <Seo
        title="Game8Arena — Free Online Puzzle Games, No Download"
        fullTitle
        description={SITE_DESCRIPTION}
        path="/"
        jsonLd={[websiteSchema(), organizationSchema(), gameListSchema(games)]}
      />
      <section className="hero">
        <h1 className="hero-title">Free Online Puzzle Games</h1>
        <p className="hero-slogan">
          Pick a game. <span>Press start.</span>
        </p>
        <p>Logic puzzles, brain teasers and memory games. No download, no sign-up. Play on phone or desktop.</p>
      </section>

      <div className="home-layout">
        <div className="home-main">
          <h2 className="section-title">All games</h2>
          <section className="toolbar">
            <div className="chips">
              {categories.map((c) => (
                <button key={c} className={c === cat ? "chip active" : "chip"} onClick={() => setCat(c)}>
                  {c}
                </button>
              ))}
            </div>
            <input type="search" aria-label="Search games" placeholder="Search games…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </section>

          <section className="grid" aria-label="Games">
            {shown.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
            {shown.length === 0 && <p className="empty">No games found.</p>}
          </section>
        </div>

        <aside className="home-side">
          <DailyBanner />
        </aside>
      </div>

      <section className="home-about" aria-labelledby="home-about-h">
        <h2 id="home-about-h">Free puzzle games you can play in your browser</h2>
        <p>
          Game8Arena is a collection of free online puzzle, logic and memory games. Every game runs right in your browser on phone, tablet or
          desktop: no download, no account and no ads. Your levels, stars and achievements are saved on your device, and a daily challenge picks
          three games for everyone to play each day.
        </p>
        <ul className="home-links">
          {games.map((g) => (
            <li key={g.id}>
              <Link to={landingPath(g.id)}>
                {g.emoji} <b>{g.title}</b>
              </Link>{" "}
              — {g.description}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
