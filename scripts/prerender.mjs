// Static site generation for the Vite + React app (run by `npm run build`, after the client and SSR builds).
// For each route it renders the React tree to HTML, injects that route's <title>/meta/canonical/JSON-LD, and writes
//   /               -> dist/index.html
//   /games/arrow    -> dist/games/arrow.html   (served at /games/arrow by Netlify, Vercel, Cloudflare Pages, GitHub Pages…)
//   unknown routes  -> dist/404.html
// plus dist/sitemap.xml and dist/robots.txt. The browser then boots the normal React app on top.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { robotsTxt, sitemapXml } from './seo-files.mjs'

const root = resolve(import.meta.dirname, '..')
const dist = join(root, 'dist')
const { render, routes, SITE_URL } = await import(pathToFileURL(join(root, 'dist-ssr', 'entry-server.js')).href)

if (SITE_URL.includes('.example')) {
  console.warn('\n⚠  VITE_SITE_URL is not set: canonical URLs and the sitemap use the placeholder', SITE_URL, '\n   Set it in .env.production (e.g. VITE_SITE_URL=https://your-domain.com) before deploying.\n')
}

const template = await readFile(join(dist, 'index.html'), 'utf8')
const HEAD_RE = /<!--seo-head-->[\s\S]*?<!--\/seo-head-->/
const ROOT_RE = /<div id="root"><\/div>/
if (!HEAD_RE.test(template) || !ROOT_RE.test(template)) throw new Error('index.html is missing the <!--seo-head--> markers or <div id="root"></div>')

const page = url => {
  const { html, head } = render(url)
  return template.replace(HEAD_RE, head).replace(ROOT_RE, `<div id="root">${html}</div>`)
}
const fileFor = path => (path === '/' ? 'index.html' : `${path.slice(1)}.html`)

const all = routes()
for (const r of all) {
  const out = join(dist, fileFor(r.path))
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, page(r.path))
}
await writeFile(join(dist, '404.html'), page('/404-not-found'))

await writeFile(join(dist, 'sitemap.xml'), sitemapXml(all, SITE_URL))
await writeFile(join(dist, 'robots.txt'), robotsTxt(SITE_URL))

console.log(`✓ prerendered ${all.length} routes + 404.html, sitemap.xml (${all.filter(r => r.sitemap).length} URLs), robots.txt`)
