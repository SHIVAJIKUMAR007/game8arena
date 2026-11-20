import { lazy } from 'react'

export default {
  id: 'blocky',
  title: 'Blocky Blitz',
  emoji: '🧱',
  category: 'Puzzle',
  color: '#ff3fa4',
  description: 'Drag blocks onto the grid and fill rows and columns to clear them. Chain combos, save a piece in the hold slot and keep going.',
  controls: 'Drag a piece onto the board. Drop it on the hold slot to save it. Keyboard: Enter picks up a piece, arrows move it, Enter places it, H holds it.',
  daily: false,
  component: lazy(() => import('./BlockyGame')),
}
