// Build-time renderer used by scripts/prerender.mjs (never shipped to the browser).
// Renders a route to HTML and returns the <head> tags its <Seo> component asked for.
/* oxlint-disable react/only-export-components -- server entry, not a hot-reloaded component module */
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import App from './App'
import { games } from './data/games'
import { headToHtml } from './seo/head'
import { HeadContext } from './seo/headContext'
import { SITE_URL, landingPath, playPath } from './seo/site'

export function render(url) {
  let head = null
  const html = renderToString(
    <HeadContext.Provider value={h => { head = h }}>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </HeadContext.Provider>
  )
  return { html, head: head ? headToHtml(head) : '' }
}

/** Every route to prerender. `sitemap: true` routes are listed in sitemap.xml. */
export function routes() {
  return [
    { path: '/', sitemap: true, priority: '1.0', changefreq: 'daily' },
    ...games.map(g => ({ path: landingPath(g.id), sitemap: true, priority: '0.9', changefreq: 'weekly' })),
    { path: '/about', sitemap: true, priority: '0.5', changefreq: 'monthly' },
    { path: '/privacy', sitemap: true, priority: '0.3', changefreq: 'yearly' },
    // Play screens are prerendered so direct links work on any static host, but they're noindex and not in the sitemap.
    ...games.map(g => ({ path: playPath(g.id) })),
  ]
}

export { SITE_URL }
