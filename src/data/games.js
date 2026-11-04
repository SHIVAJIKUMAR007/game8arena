// Each game lives in its own folder under src/games/<name>/ and default-exports its definition:
//   { id, title, emoji, category, color, description, controls?, daily?, component }
// `component` may be React.lazy(...) so every game ships as its own chunk.
// For level-based games, build the game on top of src/platform/LevelGameShell.jsx
// (menu, lives, hints, undo, stars, daily, achievements, saving…) — you only write the Board.
// Register a new game by importing it here.
import arrow from '../games/arrow'
import merge from '../games/merge'
import god from '../games/god'

export const games = [arrow, merge, god]
