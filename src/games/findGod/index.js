import { lazy } from 'react'

export default {
  id: 'god',
  title: 'Find God',
  emoji: '🔱',
  category: 'Puzzle',
  color: '#a68bff',
  description: 'Each god hides in its own coloured realm. Use logic to find the one a villager needs. Wrong searches cost lives!',
  controls: 'Tap to discard a cell, double-tap to search. Keyboard: arrows, Space/X discard, Enter search.',
  daily: true,
  component: lazy(() => import('./GodGame')),
}
