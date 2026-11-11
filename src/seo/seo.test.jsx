// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { games } from '../data/games'
import { gameContent } from '../data/gameContent'
import GameLanding from '../pages/GameLanding'
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
