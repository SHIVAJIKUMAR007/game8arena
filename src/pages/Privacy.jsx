import { useEffect } from 'react'
import { setAnalyticsConsent, useConsent } from '../platform/analytics'

export default function Privacy() {
  const consent = useConsent()
  useEffect(() => { document.title = 'Privacy — ArcadeHub' }, [])
  return (
    <article className="prose">
      <h2>Privacy</h2>
      <p>ArcadeHub has no accounts and does not ask for your name, email or any personal information.</p>
      <h3>What is stored on your device</h3>
      <p>
        Your progress (levels, stars, scores, achievements, daily streaks) and your settings are saved in your
        browser’s local storage. It never leaves your device unless you share a result yourself. Clearing your
        browser data, or using “Reset everything” in Settings, erases it.
      </p>
      <h3>Anonymous analytics (optional)</h3>
      <p>
        If you allow it, we record anonymous gameplay events (for example “level 12 started” or “level 12 failed”)
        so we can find levels that are too hard. No personal data is included. You can change your mind at any time:
      </p>
      <label className="st-row" style={{ maxWidth: 360 }}>
        <span>Allow anonymous analytics</span>
        <input type="checkbox" checked={consent.analytics === true} onChange={e => setAnalyticsConsent(e.target.checked)} />
      </label>
      <h3>Advertising</h3>
      <p>ArcadeHub doesn’t show ads.</p>
    </article>
  )
}
