// Platform-independent caching. This runs in the visitor's browser, so it behaves the same on any host
// (Netlify, Vercel, Cloudflare, GitHub Pages, nginx, S3…) with no server cache headers required.
//
//   /assets/*   JS, CSS, images built by Vite. Filenames contain a content hash, so a URL never changes.
//               → cache-first: downloaded once, then served from the device with no network request at all.
//   icons, manifest, other root files
//               → cache-first per deploy: refreshed once when a new version of the site is deployed.
//   pages (HTML)
//               → network-first: always up to date, with the cached copy used when offline.
//
// BUILD is replaced by scripts/prerender.mjs with a hash of the build. A new deploy therefore changes this file,
// the browser installs the new worker, and the per-deploy caches below are swapped out automatically.
const BUILD = '__BUILD_ID__'
const ASSETS = 'game8arena-assets' // shared across deploys: hashed files stay valid, old ones are trimmed
const STATIC = `game8arena-static-${BUILD}`
const PAGES = `game8arena-pages-${BUILD}`
const KEEP = [ASSETS, STATIC, PAGES]
const MAX_ASSETS = 150 // keeps the device cache from growing forever with files from old deploys

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('game8arena') && !KEEP.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys() // oldest first
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(k)
}

async function cacheFirst(req, cacheName, e) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok && res.type === 'basic') {
    e.waitUntil(cache.put(req, res.clone()).then(() => (cacheName === ASSETS ? trim(ASSETS, MAX_ASSETS) : undefined)))
  }
  return res
}

async function networkFirst(req, e) {
  const cache = await caches.open(PAGES)
  try {
    const res = await fetch(req)
    if (res.ok && res.type === 'basic') e.waitUntil(cache.put(req, res.clone()))
    return res
  } catch {
    return (await cache.match(req)) || (await caches.match('/', { ignoreSearch: true })) || Response.error()
  }
}

self.addEventListener('fetch', e => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname === '/sw.js' || url.pathname === '/sitemap.xml' || url.pathname === '/robots.txt') return

  if (url.pathname.startsWith('/assets/')) e.respondWith(cacheFirst(req, ASSETS, e))
  else if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) e.respondWith(networkFirst(req, e))
  else e.respondWith(cacheFirst(req, STATIC, e))
})
