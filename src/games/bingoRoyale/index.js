import { lazy } from 'react'

export default {
  id: 'bingo',
  title: 'Bingo Royale',
  emoji: '🎱',
  category: 'Multiplayer',
  color: '#8b3fe0',
  description: 'A multiplayer Bingo twist for 2 to 8 friends. Arrange 1 to 25 on your own board, take turns announcing numbers, and be first to complete 5 lines.',
  controls: 'Place the numbers 1 to 25 on your board, then on your turn pick an unused number and press Announce. Tap or click, or use the keyboard.',
  daily: false,
  component: lazy(() => import('./BingoGame')),
}
