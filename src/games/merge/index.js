import { lazy } from 'react'

export default {
  id: 'merge',
  title: 'Merge Rush',
  emoji: '🔢',
  category: 'Puzzle',
  color: '#f59e0b',
  description: 'Slide tiles and merge three of a kind to build powers of 3. Don’t fill the board!',
  controls: 'Swipe, arrow keys / WASD, or the on-screen pad.',
  daily: true,
  component: lazy(() => import('./MergeGame')),
}
