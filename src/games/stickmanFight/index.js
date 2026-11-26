import { lazy } from 'react'

export default {
  id: 'stickman',
  title: 'Stickman Fight',
  emoji: '🥊',
  category: 'Action',
  categories: ['Action', 'Multiplayer'],
  players: { min: 1, max: 2 },
  color: '#2f78d3',
  description: 'A fast 2D stickman brawler. Fight computer opponents through 30 levels and beyond, or take on a friend on the same keyboard. Eight weapons, six arenas, special attacks and unlockable looks.',
  controls: 'Player 1: A and D move, W jumps (press again to double jump), S blocks, F attacks, G uses your special. Player 2: arrow keys, K attacks, L special. In single player the arrow keys and Space work too. Phones get on-screen buttons. P or Esc pauses.',
  daily: false,
  component: lazy(() => import('./StickmanGame')),
}
