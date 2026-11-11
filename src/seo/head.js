// Turns page SEO props into a list of <head> tags. Shared by the browser (<Seo> updates the live <head>)
// and the build-time prerenderer (scripts/prerender.mjs writes the same tags into each static HTML file).
import { DEFAULT_OG_IMAGE, SITE_NAME, absUrl } from './site'

/**
 * @param {object} p
 * @param {string} p.title        page title (the site name is appended unless `fullTitle` is set)
 * @param {boolean} [p.fullTitle] use `title` as-is
 * @param {string} p.description  meta description (~150 characters)
 * @param {string} p.path         route path, used for the canonical URL
 * @param {string} [p.image]      share image path or URL
 * @param {boolean} [p.noindex]   keep the page out of search results (links are still followed)
 * @param {string} [p.type]       og:type, default "website"
 * @param {object|object[]} [p.jsonLd] schema.org structured data
 */
export function buildHead({ title, fullTitle, description, path = '/', image = DEFAULT_OG_IMAGE, noindex, type = 'website', jsonLd }) {
  const docTitle = fullTitle ? title : `${title} | ${SITE_NAME}`
  const url = absUrl(path)
  const tags = [
    { tag: 'meta', attrs: { name: 'description', content: description } },
    { tag: 'meta', attrs: { name: 'robots', content: noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large' } },
    { tag: 'link', attrs: { rel: 'canonical', href: url } },
    { tag: 'meta', attrs: { property: 'og:site_name', content: SITE_NAME } },
    { tag: 'meta', attrs: { property: 'og:type', content: type } },
    { tag: 'meta', attrs: { property: 'og:title', content: docTitle } },
    { tag: 'meta', attrs: { property: 'og:description', content: description } },
    { tag: 'meta', attrs: { property: 'og:url', content: url } },
    { tag: 'meta', attrs: { property: 'og:locale', content: 'en_US' } },
    { tag: 'meta', attrs: { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' } },
    { tag: 'meta', attrs: { name: 'twitter:title', content: docTitle } },
    { tag: 'meta', attrs: { name: 'twitter:description', content: description } },
  ]
  if (image) {
    tags.push({ tag: 'meta', attrs: { property: 'og:image', content: absUrl(image) } })
    tags.push({ tag: 'meta', attrs: { name: 'twitter:image', content: absUrl(image) } })
  }
  const ld = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : []
  return { title: docTitle, tags, jsonLd: ld }
}

const escapeAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeText = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// JSON inside <script> must not be able to close the tag.
const safeJson = obj => JSON.stringify(obj).replace(/</g, '\\u003c')

/** Serialise a buildHead() result to HTML for the static files. */
export function headToHtml(head) {
  const lines = [`<title>${escapeText(head.title)}</title>`]
  for (const { tag, attrs } of head.tags) {
    const a = Object.entries(attrs).map(([k, v]) => `${k}="${escapeAttr(v)}"`).join(' ')
    lines.push(`<${tag} ${a} data-seo />`)
  }
  for (const item of head.jsonLd) lines.push(`<script type="application/ld+json" data-seo>${safeJson(item)}</script>`)
  return lines.join('\n    ')
}

/** Update the live document <head> after client-side navigation. */
export function applyHead(head) {
  if (typeof document === 'undefined') return
  document.title = head.title
  const keep = new Set()
  for (const { tag, attrs } of head.tags) {
    const key = attrs.name ? 'name' : attrs.property ? 'property' : 'rel'
    let el = document.head.querySelector(`${tag}[${key}="${attrs[key]}"]`)
    if (!el) {
      el = document.createElement(tag)
      document.head.appendChild(el)
    }
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    el.setAttribute('data-seo', '')
    keep.add(el)
  }
  // Drop tags the previous page set but this one doesn't (e.g. og:image), plus the old structured data.
  document.head.querySelectorAll('[data-seo]').forEach(el => {
    if (!keep.has(el)) el.remove()
  })
  for (const item of head.jsonLd) {
    const s = document.createElement('script')
    s.type = 'application/ld+json'
    s.setAttribute('data-seo', '')
    s.textContent = JSON.stringify(item)
    document.head.appendChild(s)
  }
}
