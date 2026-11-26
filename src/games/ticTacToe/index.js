import { lazy } from 'react'

export default {
  id: 'tictactoe',
  title: 'Tic Tac Toe Online',
  emoji: '⭕',
  category: 'Multiplayer',
  players: { min: 2, max: 2 },
  color: '#1f8fbf',
  description: 'Challenge a friend to a best-of-three Tic Tac Toe match. One of you creates a room, the other joins with the 4-letter code. No install.',
  controls: 'Tap or click a square on your turn, or move with the arrow keys and press Enter. Get three in a row to win the game.',
  daily: false,
  component: lazy(() => import('./TicTacToeGame')),
}
