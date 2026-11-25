// A game has one primary `category` and may list more in an optional `categories` array
// (primary first), e.g. Tambola is both Casual and Multiplayer.
export const gameCategories = (game) => {
  const list = Array.isArray(game.categories) && game.categories.length ? game.categories : [game.category]
  return [...new Set(list.filter(Boolean))]
}

export const allCategories = (games) => [...new Set(games.flatMap(gameCategories))]

export const inCategory = (game, cat) => cat === 'All' || gameCategories(game).includes(cat)
