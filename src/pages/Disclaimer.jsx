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

      <h2>Articles and gaming news</h2>
      <p>
        Our blog posts are general information written in good faith. Gaming news changes quickly: release dates, prices and
        platforms in a news post may be out of date or turn out to be wrong. Check the publisher’s official announcement before
        you buy or pre-order anything.
      </p>

      <h2>Trademarks and affiliation</h2>
      <p>
        Game8Arena is an independent site. When we write about games, consoles or companies, their names and trademarks belong
        to their owners, and mentioning them doesn’t mean they endorse us or that we’re affiliated with them.
      </p>

      <h2>Ads and affiliate links</h2>
      <p>
        Ads on the site are chosen and served by Google AdSense, not by us, so an ad isn’t a recommendation from Game8Arena.
        We don’t use affiliate links and aren’t paid to mention any game or product.
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
