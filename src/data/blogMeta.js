// Derived, display-only facts about a blog post (nothing here is stored in the post data itself).
import { games } from './games'
import { blogPosts } from './blogPosts'

const words = text => (text.match(/\S+/g) || []).length

/** Plain text of every paragraph, list item, FAQ answer in a post. */
function textOf(post) {
  const parts = []
  for (const b of post.body) {
    if (typeof b === 'string') parts.push(b)
    else if (Array.isArray(b)) parts.push(...b)
  }
  for (const f of post.faq || []) parts.push(f.q, f.a)
  return parts.join(' ')
}

/** Whole minutes at 200 words per minute, never below 1. */
export const readingMinutes = post => Math.max(1, Math.round(words(textOf(post)) / 200))

/** The game a post is about: its title or keyword names one game. Roundups and news return undefined. */
export function postGame(post) {
  const hay = `${post.title} ${post.keyword || ''}`.toLowerCase()
  return games.find(g => hay.includes(g.title.toLowerCase()))
}

/** First image of the post, used as its cover. */
export const postCover = post => post.images?.[0]

export const slugify = text =>
  text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Unique ids for the "##" and "###" headings, keyed by body index. */
export function headingIds(post) {
  const seen = new Map()
  const ids = {}
  post.body.forEach((b, i) => {
    if (typeof b !== 'string') return
    const m = /^(#{2,3}) (.+)$/.exec(b)
    if (!m) return
    const base = slugify(m[2]) || `section-${i}`
    const n = seen.get(base) || 0
    seen.set(base, n + 1)
    ids[i] = n ? `${base}-${n + 1}` : base
  })
  return ids
}

/** Posts most like `post`: same game first, then shared tags, then newest. */
export function relatedPosts(post, count = 3) {
  const game = postGame(post)
  const tags = new Set((post.tags || []).map(t => t.toLowerCase()))
  return blogPosts
    .filter(p => p.slug !== post.slug)
    .map(p => ({
      p,
      score:
        (game && postGame(p)?.id === game.id ? 10 : 0) +
        (p.tags || []).filter(t => tags.has(t.toLowerCase())).length +
        (p.category === post.category ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || b.p.date.localeCompare(a.p.date))
    .slice(0, count)
    .map(x => x.p)
}
