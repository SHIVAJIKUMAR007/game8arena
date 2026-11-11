// sitemap.xml and robots.txt builders, shared by the build (scripts/prerender.mjs) and the dev server (vite.config.js).

/** @param {{path:string, sitemap?:boolean, changefreq?:string, priority?:string}[]} routes */
// No <lastmod>: a build date would change on every deploy, and Google ignores lastmod values that aren't reliable.
export function sitemapXml(routes, siteUrl) {
  const urls = routes
    .filter(r => r.sitemap)
    .map(r => `  <url><loc>${siteUrl}${r.path}</loc><changefreq>${r.changefreq}</changefreq><priority>${r.priority}</priority></url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export const robotsTxt = siteUrl => `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`
