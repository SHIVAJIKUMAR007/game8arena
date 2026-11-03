import { lazy } from 'react'

// Game definition. `component` is lazy-loaded so each game is its own chunk.
export default {
  id: 'arrow',
  title: 'Arrow Escape',
  emoji: '➡️',
  category: 'Puzzle',
  color: '#22d3ee',
  description: 'Tap arrows to fire them off the board. Don’t hit another arrow!',
  controls: 'Tap (or Tab + Enter) to launch an arrow. Long-press to preview its path.',
  daily: true,
  component: lazy(() => import('./ArrowGame')),
}
