import { describe, expect, it } from 'vitest'
import { allCategories, gameCategories, inCategory } from './gameCategories'
import { games } from './games'

describe('game categories', () => {
  it('falls back to the single category', () => {
    expect(gameCategories({ category: 'Puzzle' })).toEqual(['Puzzle'])
  })
  it('lists several categories, primary first, without duplicates', () => {
    expect(gameCategories({ category: 'Casual', categories: ['Casual', 'Multiplayer', 'Casual'] })).toEqual(['Casual', 'Multiplayer'])
  })
  it('puts Tambola and Stickman Fight in Multiplayer too', () => {
    for (const id of ['tambola', 'stickman']) {
      const g = games.find(x => x.id === id)
      expect(inCategory(g, 'Multiplayer'), id).toBe(true)
      expect(inCategory(g, g.category), id).toBe(true)
    }
    expect(allCategories(games)).toContain('Multiplayer')
  })
})
