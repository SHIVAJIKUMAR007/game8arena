// schema.org structured data builders (rendered as JSON-LD).
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, absUrl, landingPath, playPath } from './site'

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

export const videoGameSchema = (game, content) => ({
  '@context': 'https://schema.org',
  '@type': 'VideoGame',
  name: game.title,
  url: absUrl(landingPath(game.id)),
  description: content.metaDescription,
  genre: [game.category, ...(content.genres || [])],
  gamePlatform: ['Web browser', 'Mobile', 'Desktop'],
  applicationCategory: 'Game',
  operatingSystem: 'Any',
  playMode: 'SinglePlayer',
  inLanguage: 'en',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
  publisher: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_URL}/` },
  potentialAction: { '@type': 'PlayAction', target: absUrl(playPath(game.id)) },
})
