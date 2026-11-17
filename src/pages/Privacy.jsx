import { setAnalyticsConsent, useConsent } from '../platform/analytics'
import Seo from '../seo/Seo'

export default function Privacy() {
  const consent = useConsent()
  return (
    <article className="prose">
      <Seo
        title="Privacy"
        description="Game8Arena has no accounts and keeps your game progress in your browser. Analytics are anonymous and opt-in. Ads are served by Google AdSense."
        path="/privacy"
      />
      <h1>Privacy</h1>
      <p>Game8Arena has no accounts and does not ask for your name, email or any personal information.</p>
      <h2>What is stored on your device</h2>
      <p>
        Your progress (levels, stars, scores, achievements, daily streaks) and your settings are saved in your
        browser’s local storage. It never leaves your device unless you share a result yourself. Clearing your
        browser data, or using “Reset everything” in Settings, erases it.
      </p>
      <h2>Anonymous analytics (optional)</h2>
      <p>
        If you allow it, we record anonymous gameplay events (for example “level 12 started” or “level 12 failed”)
        so we can find levels that are too hard. No personal data is included. You can change your mind at any time:
      </p>
      <label className="st-row" style={{ maxWidth: 360 }}>
        <span>Allow anonymous analytics</span>
        <input type="checkbox" checked={consent.analytics === true} onChange={e => setAnalyticsConsent(e.target.checked)} />
      </label>
      <h2>Advertising</h2>
      <p>
        Game8Arena uses Google AdSense to show ads. Google and its advertising partners may use cookies, device
        identifiers and similar technologies to serve and measure ads, including ads personalised to your interests
        based on your visits to this and other websites. Google’s use of advertising cookies lets it and its
        partners serve ads based on your visit to our site and/or other sites on the Internet.
      </p>
      <p>
        You can opt out of personalised advertising at{' '}
        <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>, or
        learn more about how Google uses data at{' '}
        <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">
          policies.google.com/technologies/partner-sites
        </a>
        . You can also block or delete cookies in your browser settings. Where required by law (for example in the
        EEA, UK and Switzerland), ads are only personalised if you give consent through Google’s consent prompt.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about this policy? Email <a href="mailto:official.shivaji007@gmail.com">official.shivaji007@gmail.com</a> or
        visit our <a href="/contact">Contact page</a>.
      </p>
    </article>
  )
}
