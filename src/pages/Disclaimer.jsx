import { Link } from 'react-router-dom'
import Seo from '../seo/Seo'

const EMAIL = 'official.shivaji007@gmail.com'

export default function Disclaimer() {
  return (
    <article className="prose">
      <Seo
        title="Disclaimer"
        description="Game8Arena games are for entertainment and our articles are general information. We are not affiliated with the games and companies we write about."
        path="/disclaimer"
      />
      <h1>Disclaimer</h1>
      <p><em>Last updated: 18 November 2026</em></p>

      <h2>Games are for fun</h2>
      <p>
        Game8Arena’s puzzle and brain games are made for entertainment. We don’t claim they improve memory, intelligence or
        health, and nothing on this site is medical advice.
      </p>

      <h2>Articles and game information</h2>
      <p>
        Our blog posts offer general information about games and playing them. Game rules, platform availability and other details can change.
        Check a publisher’s official information before making a purchase or relying on a time-sensitive claim.
      </p>

      <h2>Trademarks and affiliation</h2>
      <p>
        Game8Arena is an independent site. When we write about games, consoles or companies, their names and trademarks belong
        to their owners, and mentioning them doesn’t mean they endorse us or that we’re affiliated with them.
      </p>

      <h2>Ads and affiliate links</h2>
      <p>
        If ads appear on the site, Google AdSense provides them. An ad is not a recommendation from Game8Arena.
      </p>

      <h2>Links to other websites</h2>
      <p>
        Some articles link to other sites as sources. We don’t control those sites and aren’t responsible for what they publish.
      </p>

      <h2>Spotted a mistake?</h2>
      <p>
        Email <a href={`mailto:${EMAIL}`}>{EMAIL}</a> and we’ll fix it. See also our <Link to="/terms">Terms</Link> and{' '}
        <Link to="/privacy">Privacy</Link> pages.
      </p>
    </article>
  )
}
