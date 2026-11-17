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

const blogUrl = slug => absUrl(`/blogs/${slug}`)

export const blogPostingSchema = post => ({
  '@context': 'https://schema.org',
  '@type': post.category === 'News' ? 'NewsArticle' : 'BlogPosting',
  headline: post.title,
  description: post.metaDescription,
  url: blogUrl(post.slug),
  mainEntityOfPage: blogUrl(post.slug),
  datePublished: post.date,
  dateModified: post.updated || post.date,
  image: [absUrl('/icon-512.png')],
  keywords: post.tags.join(', '),
  inLanguage: 'en',
  author: { '@type': 'Organization', name: `${SITE_NAME} team`, url: absUrl('/about') },
  publisher: { '@type': 'Organization', name: SITE_NAME, url: `${SITE_URL}/`, logo: { '@type': 'ImageObject', url: absUrl('/icon-512.png') } },
})

export const blogListSchema = posts => ({
  '@context': 'https://schema.org',
  '@type': 'Blog',
  name: `${SITE_NAME} Blog`,
  url: absUrl('/blogs'),
  blogPost: posts.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: blogUrl(p.slug), datePublished: p.date })),
})

export const videoGameSchema =(game, content) => ({
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
