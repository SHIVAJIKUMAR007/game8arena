// schema.org structured data builders (rendered as JSON-LD).
import { gameCategories } from '../data/gameCategories'
import { DEFAULT_OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_URL, absUrl, landingPath, playPath } from './site'

export const websiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  description: SITE_DESCRIPTION,
})

export const organizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: absUrl('/icon-512.png'),
})

export const breadcrumbSchema = items => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absUrl(it.path) })),
})

export const faqSchema = faq => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
})

export const gameListSchema = games => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: `Free online games on ${SITE_NAME}`,
  itemListElement: games.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: g.title, url: absUrl(landingPath(g.id)) })),
})

const blogUrl = slug => absUrl(`/blogs/${slug}`)

export const blogPostingSchema = post => ({
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: post.title,
  description: post.metaDescription,
  url: blogUrl(post.slug),
  mainEntityOfPage: blogUrl(post.slug),
  datePublished: post.date,
  dateModified: post.updated || post.date,
  image: post.images?.length ? post.images.map(image => absUrl(image.url)) : [absUrl('/icon-512.png')],
  keywords: post.tags.join(', '),
  inLanguage: 'en',
  author: {
    '@type': 'Person',
    name: 'Shivaji Kumar',
    url: absUrl('/about'),
    description: 'Creator of Game8Arena and writer of its game guides.',
  },
  publisher: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_URL}/`, logo: { '@type': 'ImageObject', url: absUrl('/icon-512.png') } },
})

export const blogListSchema = posts => ({
  '@context': 'https://schema.org',
  '@type': 'Blog',
  name: `${SITE_NAME} Blog`,
  url: absUrl('/blogs'),
  blogPost: posts.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: blogUrl(p.slug), datePublished: p.date })),
})

/**
 * Player range for a game: `game.players = { min, max }`, defaulting to a single player.
 * Set it on every game that supports more than one player; the numbers must match what the game really allows.
 */
export const playerRange = game => {
  const min = Number.isInteger(game.players?.min) && game.players.min >= 1 ? game.players.min : 1
  const max = Number.isInteger(game.players?.max) && game.players.max >= min ? game.players.max : Math.max(min, 1)
  return { min, max }
}

/** Game schema (a VideoGame, which is a schema.org Game) for one game's landing page. Built for every game in games.js. */
export const videoGameSchema = (game, content) => {
  const { min, max } = playerRange(game)
  const playMode = [min === 1 && 'SinglePlayer', max > 1 && 'MultiPlayer'].filter(Boolean)
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    '@id': `${absUrl(landingPath(game.id))}#game`,
    name: game.title,
    url: absUrl(landingPath(game.id)),
    description: content.metaDescription,
    image: absUrl(DEFAULT_OG_IMAGE || '/icon-512.png'),
    genre: [...gameCategories(game), ...(content.genres || [])],
    gamePlatform: ['Web browser', 'Mobile', 'Desktop'],
    applicationCategory: 'Game',
    operatingSystem: 'Any',
    playMode: playMode.length === 1 ? playMode[0] : playMode,
    numberOfPlayers: { '@type': 'QuantitativeValue', minValue: min, maxValue: max },
    inLanguage: 'en',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_URL}/` },
    potentialAction: { '@type': 'PlayAction', target: absUrl(playPath(game.id)) },
  }
}
