import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary from './platform/ui/ErrorBoundary'
import './platform/settings' // applies saved theme / motion preference before first paint
import './platform/platform.css'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter><App /></BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
)

// Offline support / installable app (production only, so dev hot-reload isn't cached).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // updateViaCache 'none': always check for a new sw.js, whatever cache headers the host sends.
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {}))
}
