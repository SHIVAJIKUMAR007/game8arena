import { lazy } from 'react'

export default {
  id: 'box',
  title: 'Box Escape',
  emoji: '📦',
  category: 'Puzzle',
  color: '#c98a3c',
  description: 'Push every crate onto a target. Crates can’t be pulled, so one careless push can trap you!',
  controls: 'Arrow keys / WASD, swipe, or the pad. Tap a tile to walk there, tap an adjacent crate to push it.',
  daily: true,
  component: lazy(() => import('./BoxGame')),
}
