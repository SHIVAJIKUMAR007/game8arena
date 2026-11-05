import { lazy } from 'react'

export default {
  id: 'traffic',
  title: 'Traffic Escape',
  emoji: '🚗',
  category: 'Puzzle',
  color: '#ef4444',
  description: 'Slide cars and trucks along their lanes to clear a path so the red car can escape the parking lot.',
  controls: 'Drag a car to slide it. Keyboard: Tab to pick a car, arrow keys to slide.',
  daily: true,
  component: lazy(() => import('./TrafficGame')),
}
