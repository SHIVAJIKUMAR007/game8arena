import { setAnalyticsConsent, useConsent } from '../platform/analytics'
import Seo from '../seo/Seo'

export default function Privacy() {
  const consent = useConsent()
  return (
    <article className="prose">
      <Seo
        title="Privacy"
        description="Game8Arena has no accounts and keeps your game progress in your browser. Analytics are anonymous and opt-in, and there are no ads."
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
      <p>Game8Arena doesn’t show ads.</p>
    </article>
  )
}
