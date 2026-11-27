// @vitest-environment jsdom
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { games } from '../data/games'
import { gameContent } from '../data/gameContent'
import GameLanding from '../pages/GameLanding'
import Blogs from '../pages/Blogs'
import BlogPost from '../pages/BlogPost'
import About from '../pages/About'
import { blogPosts } from '../data/blogPosts'
import { seoBlogPosts } from '../data/seoBlogPosts'
import { seoBlogPostsMore } from '../data/seoBlogPostsMore'
import { seoBlogPostsThird } from '../data/seoBlogPostsThird'
import { seoBlogPostsNewGames } from '../data/seoBlogPostsNewGames'
import { seoBlogPostsFreshGames } from '../data/seoBlogPostsFreshGames'
import { seoBlogPostsTambolaOptions } from '../data/seoBlogPostsTambolaOptions'
import { gameCategories } from '../data/gameCategories'
import { buildHead } from './head'
import { playerRange } from './schema'
import vercelConfig from '../../vercel.json'

const landing = id =>
  render(
    <MemoryRouter initialEntries={[`/games/${id}`]}>
      <Routes><Route path="/games/:id" element={<GameLanding />} /></Routes>
    </MemoryRouter>
  )

afterEach(cleanup)

const retiredBlogSlugs = [
  'gta-6-first-day-sales',
  'marvel-rivals-season-11-18v18',
  'pubg-mobile-bentley-collaboration',
  'bilibili-gaming-worlds-2026-win',
  'steam-machine-price-availability',
  'zenless-zone-zero-version-3-4',
  'ubisoft-motherbrain-ai-games',
  'xbox-game-pass-november-additions',
  'roblox-avatar-moments',
  'cs2-blast-rivals-fall-2026',
  'brawl-stars-world-finals-navi',
  'splatoon-3-update-12-0-0',
  'pubg-mobile-flash-launch',
  'gaming-news-november-2026',
  'gta-6-release-date-platforms',
  'cosmic-arena-brawler-game-concept',
  'city-defense-browser-game-concept',
  'robot-arena-duel-game-concept',
  'skyline-rescue-strategy-game-concept',
  'team-shield-survival-game-concept',
]

describe('SEO', () => {
  it.each(games.map(g => [g.id]))('game "%s" has landing-page copy that fits Google’s limits', id => {
    const c = gameContent[id]
    expect(c, `add an entry for "${id}" to src/data/gameContent.js`).toBeTruthy()
    expect(c.metaTitle.length).toBeLessThanOrEqual(60)
    expect(c.metaDescription.length).toBeGreaterThanOrEqual(70)
    expect(c.metaDescription.length).toBeLessThanOrEqual(160)
    expect(c.faq.length).toBeGreaterThan(0)
    expect(c.config.tutorial.length).toBeGreaterThan(0)
  })

  // Pages that had under ~500 words of copy now carry a longer guide (src/data/gameGuides.js).
  const guided = ['memory', 'connect', 'pipe', 'sudoku', 'god', 'box', 'merge', 'traffic', 'tictactoe', 'code', 'arrow', 'word', 'bingo', 'multiverse']

  it.each(guided.map(id => [id]))('game "%s" landing page carries 700+ words of original copy', id => {
    const { container } = landing(id)
    const main = container.querySelector('main') || container
    const words = (main.textContent.match(/\S+/g) || []).length
    expect(words, id).toBeGreaterThanOrEqual(700)
    expect(gameContent[id].guide.length, id).toBeGreaterThanOrEqual(3)
    const prose = gameContent[id].guide.flatMap(s => [s.heading, ...s.body]).join(' ')
    expect(prose, id).not.toMatch(/[—–]/)
  })

  it('titles and descriptions are unique across games', () => {
    const titles = games.map(g => gameContent[g.id].metaTitle)
    const descs = games.map(g => gameContent[g.id].metaDescription)
    expect(new Set(titles).size).toBe(titles.length)
    expect(new Set(descs).size).toBe(descs.length)
  })

  it.each(games.map(g => [g.id]))('game "%s" publishes complete, consistent Game schema', id => {
    const game = games.find(g => g.id === id)
    landing(id)
    const ld = [...document.head.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent))
    const schema = ld.find(item => item['@type'] === 'VideoGame')
    expect(schema, `landing page for "${id}" has no VideoGame JSON-LD`).toBeTruthy()
    expect(schema['@context']).toBe('https://schema.org')
    expect(schema.name).toBe(game.title)
    expect(schema.url).toMatch(new RegExp(`/games/${id}$`))
    expect(schema['@id']).toBe(`${schema.url}#game`)
    expect(schema.description).toBe(gameContent[id].metaDescription)
    expect(schema.image).toMatch(/^https?:\/\//)
    expect(schema.genre.length).toBeGreaterThan(0)
    expect(schema.potentialAction.target).toMatch(new RegExp(`/play/${id}$`))
    expect(schema.offers.price).toBe('0')

    // The advertised player range must match the game's declared range, and agree with its category.
    const { min, max } = playerRange(game)
    expect(schema.numberOfPlayers).toEqual({ '@type': 'QuantitativeValue', minValue: min, maxValue: max })
    expect(max).toBeGreaterThanOrEqual(min)
    const multiplayer = gameCategories(game).includes('Multiplayer')
    expect(max > 1, `"${id}": a Multiplayer game needs players.max > 1 (and a solo game must not set it)`).toBe(multiplayer)
    const modes = [schema.playMode].flat()
    expect(modes.includes('MultiPlayer')).toBe(max > 1)
    expect(modes.includes('SinglePlayer')).toBe(min === 1)
  })

  it('playerRange defaults to one player and repairs bad values', () => {
    expect(playerRange({})).toEqual({ min: 1, max: 1 })
    expect(playerRange({ players: { min: 2, max: 8 } })).toEqual({ min: 2, max: 8 })
    expect(playerRange({ players: { min: 3 } })).toEqual({ min: 3, max: 3 })
    expect(playerRange({ players: { min: 0, max: 4 } })).toEqual({ min: 1, max: 4 })
    expect(playerRange({ players: { min: 5, max: 2 } })).toEqual({ min: 5, max: 5 })
    expect(playerRange({ players: { min: 'x', max: null } })).toEqual({ min: 1, max: 1 })
  })

  it('landing page renders an h1, play link, FAQ and updates <head>', () => {
    landing('arrow')
    expect(screen.getByRole('heading', { level: 1, name: 'Arrow Escape' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /Play Arrow Escape/ })[0].getAttribute('href')).toBe('/play/arrow')
    expect(screen.getByText('What are rainbow arrows?')).toBeTruthy()
    expect(document.title).toBe(gameContent.arrow.metaTitle)
    expect(document.head.querySelector('link[rel="canonical"]').getAttribute('href')).toMatch(/\/games\/arrow$/)
    const types = [...document.head.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent)['@type'])
    expect(types).toEqual(['VideoGame', 'BreadcrumbList', 'FAQPage'])
  })

  it('unknown game ids get a noindex not-found page', () => {
    landing('nope')
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeTruthy()
    expect(document.head.querySelector('meta[name="robots"]').getAttribute('content')).toMatch(/noindex/)
  })

  it('noindex pages say so; indexable pages allow indexing', () => {
    const robots = h => h.tags.find(t => t.attrs.name === 'robots').attrs.content
    expect(robots(buildHead({ title: 'x', description: 'y', path: '/play/arrow', noindex: true }))).toMatch(/^noindex/)
    expect(robots(buildHead({ title: 'x', description: 'y', path: '/' }))).toMatch(/^index/)
  })
})

describe('Blog SEO', () => {
  it('new Game8Arena guides meet the long-form content requirements', () => {
    expect(seoBlogPosts).toHaveLength(20)
    for (const post of seoBlogPosts) {
      const bodyText = post.body
        .flatMap(block => Array.isArray(block) ? block : typeof block === 'string' ? [block] : [])
        .join(' ')
      const faqText = post.faq.map(({ q, a }) => `${q} ${a}`).join(' ')
      expect(`${bodyText} ${faqText}`.trim().split(/\s+/).length, post.slug).toBeGreaterThanOrEqual(900)
      expect(post.images.length, post.slug).toBeGreaterThanOrEqual(2)
      expect(post.images.every(image => /^(https:\/\/|\/)/.test(image.url) && image.alt && image.filename), post.slug).toBe(true)
      expect(post.secondaryKeywords.length, post.slug).toBeGreaterThanOrEqual(5)
      expect(post.longTailKeywords.length, post.slug).toBeGreaterThanOrEqual(3)
      expect(post.internalLinkOpportunities.length, post.slug).toBeGreaterThanOrEqual(2)
      expect(post.metaDescription.length, post.slug).toBeGreaterThanOrEqual(140)
      expect(post.metaDescription.length, post.slug).toBeLessThanOrEqual(160)
      expect((post.metaTitle + ' | Game8Arena').length, post.slug).toBeGreaterThanOrEqual(50)
      expect((post.metaTitle + ' | Game8Arena').length, post.slug).toBeLessThanOrEqual(60)
      expect(post.body.some(block => typeof block === 'string' && block.startsWith('### ')), post.slug).toBe(true)
    }
  })

  it('the additional 20 guides meet long-form and metadata requirements', () => {
    expect(seoBlogPostsMore).toHaveLength(20)
    for (const post of seoBlogPostsMore) {
      const bodyText = post.body
        .flatMap(block => Array.isArray(block) ? block : typeof block === 'string' ? [block] : [])
        .join(' ')
      const faqText = post.faq.map(({ q, a }) => `${q} ${a}`).join(' ')
      expect(`${bodyText} ${faqText}`.trim().split(/\s+/).length, post.slug).toBeGreaterThan(900)
      expect(post.images.length, post.slug).toBeGreaterThanOrEqual(2)
      expect(post.images.every(image => /^\/Game8ArenaGamesImages\/.+/.test(image.url) && image.alt && image.filename), post.slug).toBe(true)
      expect(post.secondaryKeywords.length, post.slug).toBeGreaterThanOrEqual(5)
      expect(post.longTailKeywords.length, post.slug).toBeGreaterThanOrEqual(3)
      expect(post.internalLinkOpportunities.length, post.slug).toBeGreaterThanOrEqual(2)
      expect(post.faq.length, post.slug).toBeGreaterThanOrEqual(3)
      expect(post.metaDescription.length, post.slug).toBeGreaterThanOrEqual(140)
      expect(post.metaDescription.length, post.slug).toBeLessThanOrEqual(160)
      expect((post.metaTitle + ' | Game8Arena').length, post.slug).toBeGreaterThanOrEqual(50)
      expect((post.metaTitle + ' | Game8Arena').length, post.slug).toBeLessThanOrEqual(60)
      expect(post.body.some(block => typeof block === 'string' && block.startsWith('### ')), post.slug).toBe(true)
      expect(blogPosts.filter(article => article.slug === post.slug), post.slug).toHaveLength(1)
      for (const link of post.suggestedRelatedArticles) {
        expect(blogPosts.some(article => `/blogs/${article.slug}` === link), `${post.slug}: ${link}`).toBe(true)
      }
    }
  })

  it('the puzzle guides meet long-form and metadata requirements', () => {
    expect(seoBlogPostsThird).toHaveLength(20)
    expect(new Set(seoBlogPostsThird.map(post => post.keyword.toLowerCase())).size).toBe(20)
    for (const post of seoBlogPostsThird) {
      const bodyText = post.body
        .flatMap(block => Array.isArray(block) ? block : typeof block === 'string' ? [block] : [])
        .join(' ')
      const faqText = post.faq.map(({ q, a }) => `${q} ${a}`).join(' ')
      expect(`${bodyText} ${faqText}`.trim().split(/\s+/).length, post.slug).toBeGreaterThan(900)
      expect(post.images.length, post.slug).toBeGreaterThanOrEqual(2)
      expect(post.images.every(image => /^\/Game8ArenaGamesImages\/.+/.test(image.url) && image.alt && image.filename), post.slug).toBe(true)
      expect(post.secondaryKeywords.length, post.slug).toBeGreaterThanOrEqual(5)
      expect(post.longTailKeywords.length, post.slug).toBeGreaterThanOrEqual(3)
      expect(post.internalLinkOpportunities.length, post.slug).toBeGreaterThanOrEqual(2)
      expect(post.faq.length, post.slug).toBeGreaterThanOrEqual(3)
      expect(post.metaDescription.length, post.slug).toBeGreaterThanOrEqual(140)
      expect(post.metaDescription.length, post.slug).toBeLessThanOrEqual(160)
      expect((post.metaTitle + ' | Game8Arena').length, post.slug).toBeGreaterThanOrEqual(50)
      expect((post.metaTitle + ' | Game8Arena').length, post.slug).toBeLessThanOrEqual(60)
      expect(post.body.some(block => typeof block === 'string' && block.startsWith('### ')), post.slug).toBe(true)
      expect(blogPosts.filter(article => article.slug === post.slug), post.slug).toHaveLength(1)
      for (const link of post.internalLinkOpportunities) {
        if (link.startsWith('/games/')) expect(games.some(game => `/games/${game.id}` === link), `${post.slug}: ${link}`).toBe(true)
        if (link.startsWith('/play/')) expect(games.some(game => `/play/${game.id}` === link), `${post.slug}: ${link}`).toBe(true)
      }
      for (const link of post.suggestedRelatedArticles) {
        expect(blogPosts.some(article => `/blogs/${article.slug}` === link), `${post.slug}: ${link}`).toBe(true)
      }
    }
  })

  it('retired news and concept posts are absent from retained content', () => {
    expect(blogPosts.some(post => post.category === 'News' || post.category === 'Gaming News')).toBe(false)
    const retainedContent = JSON.stringify(blogPosts)
    for (const slug of retiredBlogSlugs) {
      expect(blogPosts.some(post => post.slug === slug), slug).toBe(false)
      expect(retainedContent, slug).not.toContain(slug)
    }
  })

  it('permanently redirects retired article URLs to the blog index', () => {
    for (const slug of retiredBlogSlugs) {
      expect(vercelConfig.redirects).toContainEqual({
        source: `/blogs/${slug}`,
        destination: '/blogs',
        statusCode: 301,
      })
    }
    expect(vercelConfig.redirects).toContainEqual({ source: '/blog', destination: '/blogs', statusCode: 301 })
    expect(vercelConfig.redirects).toContainEqual({ source: '/blog/:path*', destination: '/blogs/:path*', statusCode: 301 })
  })

  it('about page identifies the operator and explains the site in at least 400 words', () => {
    render(<MemoryRouter><About /></MemoryRouter>)
    const article = document.querySelector('article')
    expect(article.textContent.trim().split(/\s+/).length).toBeGreaterThanOrEqual(400)
    expect(article.textContent).toContain('Shivaji Kumar')
    expect(screen.getByRole('link', { name: 'game catalogue' })).toBeTruthy()
  })

  it('new multiplayer and Family Sort games meet 1,000-word SEO requirements', () => {
    expect(seoBlogPostsNewGames).toHaveLength(5)
    expect(new Set(seoBlogPostsNewGames.map(post => post.keyword.toLowerCase())).size).toBe(5)

    for (const post of seoBlogPostsNewGames) {
      const bodyText = post.body
        .flatMap(block => Array.isArray(block) ? block : typeof block === 'string' ? [block] : [])
        .join(' ')
      const faqText = post.faq.map(({ q, a }) => `${q} ${a}`).join(' ')
      expect(`${bodyText} ${faqText}`.trim().split(/\s+/).length, post.slug).toBeGreaterThanOrEqual(1000)
      expect(post.images.length, post.slug).toBeGreaterThanOrEqual(2)
      expect(post.images.every(image => /^\/Game8ArenaGamesImages\/.+/.test(image.url) && image.alt && image.filename), post.slug).toBe(true)
      expect(post.secondaryKeywords.length, post.slug).toBeGreaterThanOrEqual(5)
      expect(post.longTailKeywords.length, post.slug).toBeGreaterThanOrEqual(3)
      expect(post.internalLinkOpportunities.length, post.slug).toBeGreaterThanOrEqual(2)
      expect(post.faq.length, post.slug).toBeGreaterThanOrEqual(3)
      expect(post.metaDescription.length, post.slug).toBeGreaterThanOrEqual(140)
      expect(post.metaDescription.length, post.slug).toBeLessThanOrEqual(160)
      expect((post.metaTitle + ' | Game8Arena').length, post.slug).toBeGreaterThanOrEqual(50)
      expect((post.metaTitle + ' | Game8Arena').length, post.slug).toBeLessThanOrEqual(60)
      expect(post.body.some(block => typeof block === 'string' && block.startsWith('## ')), post.slug).toBe(true)
      expect(blogPosts.filter(article => article.slug === post.slug), post.slug).toHaveLength(1)
      for (const link of post.internalLinkOpportunities) {
        if (link.startsWith('/games/')) expect(games.some(game => `/games/${game.id}` === link), `${post.slug}: ${link}`).toBe(true)
        if (link.startsWith('/play/')) expect(games.some(game => `/play/${game.id}` === link), `${post.slug}: ${link}`).toBe(true)
      }
      for (const link of post.suggestedRelatedArticles) {
        expect(blogPosts.some(article => `/blogs/${article.slug}` === link), `${post.slug}: ${link}`).toBe(true)
      }
    }
  })

  it('fresh game guides meet long-form SEO requirements', () => {
    expect(seoBlogPostsFreshGames).toHaveLength(5)
    expect(seoBlogPostsFreshGames.find(post => post.slug === 'original-browser-fighting-games').title)
      .toBe('Stickman Fight vs Multiverse Fighter: Browser Fighting Games')

    for (const post of seoBlogPostsFreshGames) {
      const bodyText = post.body
        .flatMap(block => Array.isArray(block) ? block : typeof block === 'string' ? [block] : [])
        .join(' ')
      const faqText = post.faq.map(({ q, a }) => `${q} ${a}`).join(' ')
      expect(`${bodyText} ${faqText}`.trim().split(/\s+/).length, post.slug).toBeGreaterThanOrEqual(1000)
      expect(post.images.length, post.slug).toBeGreaterThanOrEqual(2)
      expect(post.images.every(image => /^\/Game8ArenaGamesImages\/.+/.test(image.url) && image.alt && image.filename), post.slug).toBe(true)
      expect(post.secondaryKeywords.length, post.slug).toBeGreaterThanOrEqual(5)
      expect(post.longTailKeywords.length, post.slug).toBeGreaterThanOrEqual(3)
      expect(post.internalLinkOpportunities.length, post.slug).toBeGreaterThanOrEqual(2)
      expect(post.faq.length, post.slug).toBeGreaterThanOrEqual(3)
      expect(post.metaDescription.length, post.slug).toBeGreaterThanOrEqual(140)
      expect(post.metaDescription.length, post.slug).toBeLessThanOrEqual(160)
      expect((post.metaTitle + ' | Game8Arena').length, post.slug).toBeGreaterThanOrEqual(50)
      expect((post.metaTitle + ' | Game8Arena').length, post.slug).toBeLessThanOrEqual(60)
      expect(post.body.some(block => typeof block === 'string' && block.startsWith('## ')), post.slug).toBe(true)
      expect(blogPosts.filter(article => article.slug === post.slug), post.slug).toHaveLength(1)
      for (const link of post.suggestedRelatedArticles) {
        expect(blogPosts.some(article => `/blogs/${article.slug}` === link), `${post.slug}: ${link}`).toBe(true)
      }
    }
  })

  it('Tambola game options meets its word-count target and renders the play CTA first', () => {
    const post = seoBlogPostsTambolaOptions[0]
    const bodyText = post.body.filter(block => typeof block === 'string').join(' ')
    const faqText = post.faq.map(({ q, a }) => `${q} ${a}`).join(' ')
    expect(post.title).toBe('Tambola game options')
    expect(`${bodyText} ${faqText}`.trim().split(/\s+/).length).toBeGreaterThanOrEqual(800)
    expect(post.targetKeywordDifficulty).toBe(19)

    at(`/blogs/${post.slug}`)
    const playLink = screen.getByRole('link', { name: 'Play Tambola' })
    expect(playLink.getAttribute('href')).toBe('/play/tambola')
    expect(screen.getAllByRole('link', { name: 'Play Tambola' })).toHaveLength(1)
    const intro = screen.getByText(/Tambola game options on Game8Arena give you two ways to play/)
    expect(playLink.compareDocumentPosition(intro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it.each(blogPosts.map(p => [p.slug]))('post "%s" has meta copy that fits Google’s limits', slug => {
    const p = blogPosts.find(x => x.slug === slug)
    expect(buildHead({ title: p.metaTitle, description: p.metaDescription, path: '/' }).title.length).toBeLessThanOrEqual(60)
    const kw = p.keyword.toLowerCase()
    expect(p.metaTitle.toLowerCase(), 'keyword in <title>').toContain(kw)
    expect(p.title.toLowerCase(), 'keyword in H1').toContain(kw)
    expect(p.body[0].toLowerCase(), 'keyword in first paragraph').toContain(kw)
    expect(p.metaDescription.toLowerCase(), 'keyword in description').toContain(kw)
    expect(p.faq?.length, 'add an FAQ').toBeGreaterThanOrEqual(3)
    expect(p.metaDescription.length).toBeGreaterThanOrEqual(70)
    expect(p.metaDescription.length).toBeLessThanOrEqual(160)
    expect(p.slug).toMatch(/^[a-z0-9-]+$/)
    expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('slugs and titles are unique', () => {
    expect(new Set(blogPosts.map(p => p.slug)).size).toBe(blogPosts.length)
    expect(new Set(blogPosts.map(p => p.metaTitle)).size).toBe(blogPosts.length)
  })

  const at = url =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/blogs" element={<Blogs />} />
          <Route path="/blogs/:slug" element={<BlogPost />} />
        </Routes>
      </MemoryRouter>
    )

  it('blog index lists every post', () => {
    at('/blogs')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Browser Game Guides and Tips')
    for (const p of blogPosts) expect(screen.getByRole('link', { name: p.title })).toBeTruthy()
  }, 15000)

  it('post page renders H1, internal links and article schema', () => {
    at('/blogs/original-browser-fighting-games')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Stickman Fight vs Multiverse Fighter: Browser Fighting Games')
    expect(screen.getByRole('link', { name: 'play Stickman Fight' }).getAttribute('href')).toBe('/play/stickman')
    const ld = [...document.head.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent))
    const article = ld.find(item => item['@type'] === 'BlogPosting')
    expect(article.author).toEqual({
      '@type': 'Person',
      name: 'Shivaji Kumar',
      url: expect.stringMatching(/\/about$/),
      description: 'Creator of Game8Arena and writer of its game guides.',
    })
    expect(ld.map(item => item['@type'])).toContain('FAQPage')
    expect(screen.getByRole('link', { name: 'Shivaji Kumar' }).parentElement.textContent).toContain('creator of Game8Arena')
  })

  it('new guide renders its images and nested headings', () => {
    at('/blogs/how-to-play-arrow-escape')
    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(1)
    expect(images[0].getAttribute('src')).toBe('/Game8ArenaGamesImages/Arrow%20Escape.webp')
    expect(screen.getByRole('heading', { level: 3, name: 'Trace each arrow’s full flight line' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Photo source' })).toBeNull()
  })

  it('additional guide renders its images and nested headings', () => {
    at('/blogs/pipe-connect-bolted-pipes')
    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(1)
    expect(images[0].getAttribute('src')).toBe('/Game8ArenaGamesImages/Pipe%20Connect.webp')
    expect(screen.getByRole('heading', { level: 3, name: 'Fixed pieces narrow the route' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Photo source' })).toBeNull()
  })

  it('every blog image is a Game8Arena screenshot, never repeated in a post', () => {
    for (const post of blogPosts) {
      expect(post.images.length, post.slug).toBeGreaterThanOrEqual(1)
      expect(post.images.every(image => image.url.startsWith('/Game8ArenaGamesImages/') && image.alt && image.filename && !image.sourceUrl), post.slug).toBe(true)
      expect(new Set(post.images.map(image => image.url)).size, post.slug).toBe(post.images.length)
      const inBody = post.body.filter(block => block?.type === 'image').map(block => block.url)
      expect(new Set(inBody).size, post.slug).toBe(inBody.length)
      expect(post.body.every(block => block != null), post.slug).toBe(true)
    }
  })

  it('every file in public/Game8ArenaGamesImages is used by at least one post, and every referenced file exists', () => {
    const dir = join(process.cwd(), 'public', 'Game8ArenaGamesImages')
    const files = readdirSync(dir).filter(name => name.endsWith('.webp'))
    const used = new Set(blogPosts.flatMap(post => post.images.map(image => image.filename)))
    expect(files.filter(name => !used.has(name))).toEqual([])
    expect([...used].filter(name => !files.includes(name))).toEqual([])
  })

  it('unknown post is a noindex 404', () => {
    at('/blogs/nope')
    expect(document.head.querySelector('meta[name="robots"]').getAttribute('content')).toMatch(/noindex/)
  })
})
