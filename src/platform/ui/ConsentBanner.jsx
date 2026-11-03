import { Link } from 'react-router-dom'
import { setAnalyticsConsent, useConsent } from '../analytics'

export default function ConsentBanner() {
  const { analytics } = useConsent()
  if (analytics !== null) return null
  return (
    <div className="consent" role="region" aria-label="Privacy choices">
      <p>
        We’d like to collect <b>anonymous</b> play statistics (which levels are too hard, etc.) to improve the games.
        Your progress is saved only in this browser. <Link to="/privacy">Privacy details</Link>
      </p>
      <div>
        <button className="lg-btn ghost" onClick={() => setAnalyticsConsent(false)}>No thanks</button>
        <button className="lg-btn" onClick={() => setAnalyticsConsent(true)}>Allow</button>
      </div>
    </div>
  )
}
