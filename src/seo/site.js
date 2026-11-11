// Site-wide SEO settings. Set VITE_SITE_URL (e.g. in .env.production) to the real domain before deploying:
// canonical URLs, Open Graph URLs and the sitemap are all absolute and built from it.
export const SITE_NAME = 'Game8Arena'
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://game8arena.example').replace(/\/+$/, '')
export const SITE_DESCRIPTION =
  'Play free online puzzle and brain games in your browser. No download, no sign-up — daily challenges, levels and achievements on phone and desktop.'

// Social share image (1200×630 PNG recommended). Drop a file in public/ and point this at it, e.g. '/og-image.png'.
export const DEFAULT_OG_IMAGE = import.meta.env.VITE_OG_IMAGE || null

export const absUrl = (path = '/') => (/^https?:\/\//.test(path) ? path : SITE_URL + (path.startsWith('/') ? path : `/${path}`))

// Route helpers so every link to a game uses the same URL.
export const landingPath = id => `/games/${id}`
export const playPath = id => `/play/${id}`
