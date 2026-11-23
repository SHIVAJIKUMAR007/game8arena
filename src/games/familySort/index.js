import { lazy } from 'react'

export default {
  id: 'family',
  title: 'Family Sort',
  emoji: '🧪',
  category: 'Puzzle',
  color: '#2bb673',
  description: 'Pour the coloured liquids between glass bottles until each bottle holds one colour. Every level is solvable, with coins, hints and new bottle styles to unlock.',
  controls: 'Tap a bottle, then tap where to pour. Keyboard: left and right arrows move between bottles, Enter or Space picks up and pours, Escape puts a bottle down, U undoes, H hints, R restarts.',
  daily: false,
  component: lazy(() => import('./FamilySortGame')),
}
