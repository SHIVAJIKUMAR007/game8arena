import { describe, expect, it } from 'vitest'
import { games } from './games'
import { gameContent } from './gameContent'
import { gameMeta } from './gameMeta'

// The registry is the list of imports in games.js: adding a game there is all it takes for the routes, the home
// grid and the landing pages to find it. These checks keep every entry complete.
describe('game registry', () => {
  it('lists each game once, with the fields the site needs', () => {
    const ids = games.map(g => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const g of games) {
      expect(typeof g.id, g.id).toBe('string')
      expect(g.title, g.id).toBeTruthy()
      expect(g.description, g.id).toBeTruthy()
      expect(g.category, g.id).toBeTruthy()
      expect(/^#[0-9a-f]{6}$/i.test(g.color), g.id).toBe(true)
      expect(g.component, g.id).toBeTruthy()
    }
  })

  it('has landing-page content and display metadata for every game', () => {
    for (const g of games) {
      const c = gameContent[g.id]
      expect(c, `content for ${g.id}`).toBeTruthy()
      expect(c.metaTitle.length, `${g.id} title`).toBeLessThanOrEqual(60)
      expect(c.metaDescription.length, `${g.id} description`).toBeLessThanOrEqual(160)
      expect(c.faq.length).toBeGreaterThan(0)
      expect(['Easy', 'Medium', 'Hard']).toContain(gameMeta(g.id).difficulty)
    }
  })

  it('includes Family Sort, found by its id', () => {
    const family = games.find(g => g.id === 'family')
    expect(family.title).toBe('Family Sort')
    expect(gameMeta('family').isNew).toBe(true)
  })

  it('returns empty metadata for an unknown id instead of throwing', () => {
    expect(gameMeta('nope')).toEqual({})
  })
})
