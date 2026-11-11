import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { robotsTxt, sitemapXml } from './scripts/seo-files.mjs'

// In `npm run dev`, serve /sitemap.xml and /robots.txt live from the route list in src/entry-server.jsx.
// (`npm run build` writes the same files into dist/ via scripts/prerender.mjs.)
function seoFilesDev() {
  return {
    name: 'seo-files-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0]
        if (path !== '/sitemap.xml' && path !== '/robots.txt') return next()
        try {
          const { routes, SITE_URL } = await server.ssrLoadModule('/src/entry-server.jsx')
          const xml = path === '/sitemap.xml'
          res.setHeader('Content-Type', xml ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8')
          res.end(xml ? sitemapXml(routes(), SITE_URL) : robotsTxt(SITE_URL))
        } catch (e) {
          next(e)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), seoFilesDev()],
})
