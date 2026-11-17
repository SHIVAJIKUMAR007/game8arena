// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { games } from '../data/games'
import { gameContent } from '../data/gameContent'
import GameLanding from '../pages/GameLanding'
import Blogs from '../pages/Blogs'
import BlogPost from '../pages/BlogPost'
import { blogPosts } from '../data/blogPosts'
import { buildHead } from './head'

const landing = id =>
  render(
    <MemoryRouter initialEntries={[`/games/${id}`]}>
      <Routes><Route path="/games/:id" element={<GameLanding />} /></Routes>
    </MemoryRouter>
  )

afterEach(cleanup)

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

  it('titles and descriptions are unique across games', () => {
    const titles = games.map(g => gameContent[g.id].metaTitle)
    const descs = games.map(g => gameContent[g.id].metaDescription)
    expect(new Set(titles).size).toBe(titles.length)
    expect(new Set(descs).size).toBe(descs.length)
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
  it.each(blogPosts.map(p => [p.slug]))('post "%s" has meta copy that fits Google’s limits', slug => {
    const p = blogPosts.find(x => x.slug === slug)
    expect(p.metaTitle.length + ' | Game8Arena'.length).toBeLessThanOrEqual(65)
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
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Game8Arena Blog')
    for (const p of blogPosts) expect(screen.getByRole('link', { name: p.title })).toBeTruthy()
  })

  it('post page renders H1, internal links and article schema', () => {
    at('/blogs/gta-6-release-date-platforms')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/GTA 6/)
    expect(screen.getByRole('link', { name: 'Traffic Escape' }).getAttribute('href')).toBe('/games/traffic')
    const ld = [...document.head.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent)['@type'])
    expect(ld).toContain('NewsArticle')
  })

  it('unknown post is a noindex 404', () => {
    at('/blogs/nope')
    expect(document.head.querySelector('meta[name="robots"]').getAttribute('content')).toMatch(/noindex/)
  })
})
