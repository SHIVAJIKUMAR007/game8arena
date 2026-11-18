import { Link } from 'react-router-dom'
import Seo from '../seo/Seo'

const EMAIL = 'official.shivaji007@gmail.com'

export default function Terms() {
  return (
    <article className="prose">
      <Seo
        title="Terms and Conditions"
        description="The terms for using Game8Arena: free browser games with no account, fair use of the site, ads, ownership of content and limits of liability."
        path="/terms"
      />
      <h1>Terms and conditions</h1>
      <p><em>Last updated: 18 November 2026</em></p>
      <p>
        These terms apply to your use of Game8Arena and its games and articles. By using the site you agree to them. If you
        don’t agree, please don’t use the site.
      </p>

      <h2>The games</h2>
      <p>
        All games on Game8Arena are free and need no account. We may add, change or remove games, levels and features at any
        time. Your progress is saved only in your own browser, so we can’t recover it if your browser data is cleared or you
        switch devices.
      </p>

      <h2>Using the site fairly</h2>
      <p>When you use Game8Arena, please don’t:</p>
      <ul>
        <li>try to break into, overload or disrupt the site or the servers it runs on;</li>
        <li>copy, republish or sell our games, levels, articles or graphics as your own;</li>
        <li>click ads you aren’t interested in, or use bots or scripts to create fake visits or ad clicks.</li>
      </ul>
      <p>We may block access for anyone who does.</p>

      <h2>Who owns the content</h2>
      <p>
        The games, levels, articles, graphics and the Game8Arena name and logo belong to Game8Arena. You’re welcome to share
        links, screenshots and your own results. Other games, companies and trademarks mentioned on the site belong to their
        owners.
      </p>

      <h2>Ads and links to other sites</h2>
      <p>
        Game8Arena shows ads served by Google AdSense, and some articles link to other websites. We don’t control those ads or
        sites and aren’t responsible for their content or their privacy practices. Our <Link to="/privacy">Privacy page</Link>{' '}
        explains how ads use cookies.
      </p>

      <h2>No guarantees</h2>
      <p>
        We provide the site “as is”. We work to keep it running and bug-free, but we can’t promise it will always be
        available, error-free or suitable for a particular purpose.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        As far as the law allows, Game8Arena is not liable for any loss or damage that comes from using the site or being
        unable to use it, including lost game progress.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms from time to time. The date at the top of this page shows when they last changed. If you
        keep using the site after a change, you accept the updated terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email <a href={`mailto:${EMAIL}`}>{EMAIL}</a> or visit our{' '}
        <Link to="/contact">Contact page</Link>.
      </p>
    </article>
  )
}
