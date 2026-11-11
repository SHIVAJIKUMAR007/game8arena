// Search-friendly landing page for one game: /games/:id
// Everything here is plain content (no game code), so it prerenders to static HTML that Google can read.
import { Link, useParams } from 'react-router-dom'
import { games } from '../data/games'
import { commonFeatures, gameContent } from '../data/gameContent'
import Seo from '../seo/Seo'
import { breadcrumbSchema, faqSchema, videoGameSchema } from '../seo/schema'
import { landingPath, playPath } from '../seo/site'
import NotFound from './NotFound'

export default function GameLanding() {
  const { id } = useParams()
  const game = games.find(g => g.id === id)
  const content = gameContent[id]
  if (!game || !content) return <NotFound />

  const { config } = content
  // The next 4 games after this one (wrapping around), so every game page gets the same number of links.
  const at = games.indexOf(game)
  const related = Array.from({ length: Math.min(4, games.length - 1) }, (_, i) => games[(at + 1 + i) % games.length])
  const crumbs = [
    { name: 'Games', path: '/' },
    { name: game.title, path: landingPath(id) },
  ]

  return (
    <article className="landing" style={{ '--accent': game.color }}>
      <Seo
        title={content.metaTitle}
        fullTitle
        description={content.metaDescription}
        path={landingPath(id)}
        jsonLd={[videoGameSchema(game, content), breadcrumbSchema(crumbs), faqSchema(content.faq)]}
      />

      <nav aria-label="Breadcrumb" className="crumbs">
        <ol>
          <li><Link to="/">Games</Link></li>
          <li aria-current="page">{game.title}</li>
        </ol>
      </nav>

      <header className="landing-hero">
        <div className="landing-art" aria-hidden="true">{game.emoji}</div>
        <div className="landing-intro">
          <span className="tag">{game.category} game · free online</span>
          <h1>{game.title}</h1>
          <p className="landing-tagline">{content.tagline}</p>
          <div className="landing-cta">
            <Link to={playPath(id)} className="btn-play">▶ Play {game.title} free</Link>
            <a href="#how-to-play" className="btn-ghost">How to play</a>
          </div>
          <p className="landing-meta">No download · No sign-up · Works on phone &amp; desktop</p>
        </div>
      </header>

      <section className="landing-section" aria-labelledby="about-game">
        <h2 id="about-game">About {game.title}</h2>
        {content.intro.map((p, i) => <p key={i}>{p}</p>)}
      </section>

      <section className="landing-section" id="how-to-play" aria-labelledby="how-h">
        <h2 id="how-h">How to play {game.title}</h2>
        <ol className="steps">
          {config.tutorial.map(step => (
            <li key={step.title}>
              <span className="step-icon" aria-hidden="true">{step.icon}</span>
              <div><h3>{step.title}</h3><p>{step.body}</p></div>
            </li>
          ))}
        </ol>
        {game.controls && <p className="controls"><b>Controls:</b> {game.controls}</p>}
      </section>

      <section className="landing-section" aria-labelledby="tips-h">
        <h2 id="tips-h">Tips &amp; strategy</h2>
        <ul className="tips">{content.tips.map(t => <li key={t}>{t}</li>)}</ul>
      </section>

      <section className="landing-section" aria-labelledby="feat-h">
        <h2 id="feat-h">Features</h2>
        <ul className="features">
          {commonFeatures.map(f => (
            <li key={f.title}><span aria-hidden="true">{f.icon}</span><div><h3>{f.title}</h3><p>{f.body}</p></div></li>
          ))}
          <li><span aria-hidden="true">💡</span><div><h3>Hints &amp; undo</h3><p>{config.hints} hints and {config.undos} undos per level, so you’re never stuck for long.</p></div></li>
          <li><span aria-hidden="true">🏆</span><div><h3>{config.achievements.length} achievements</h3><p>Stars for every level and badges to unlock as you improve.</p></div></li>
        </ul>
      </section>

      <section className="landing-section" aria-labelledby="ach-h">
        <h2 id="ach-h">Achievements to unlock</h2>
        <ul className="achievements">
          {config.achievements.map(a => (
            <li key={a.id}><span aria-hidden="true">{a.icon}</span> <b>{a.title}</b> — {a.description}</li>
          ))}
        </ul>
      </section>

      <section className="landing-section" aria-labelledby="faq-h">
        <h2 id="faq-h">{game.title} FAQ</h2>
        <div className="faq">
          {content.faq.map(({ q, a }) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="landing-cta center">
        <Link to={playPath(id)} className="btn-play">▶ Play {game.title} now</Link>
      </div>

      <section className="landing-section" aria-labelledby="more-h">
        <h2 id="more-h">More free puzzle games</h2>
        <ul className="related">
          {related.map(g => (
            <li key={g.id} style={{ '--accent': g.color }}>
              <Link to={landingPath(g.id)}>
                <span className="related-art" aria-hidden="true">{g.emoji}</span>
                <span><b>{g.title}</b><small>{g.description}</small></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  )
}
