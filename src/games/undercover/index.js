import { lazy } from 'react'

export default {
  id: 'undercover',
  title: 'Undercover',
  emoji: '🎭',
  category: 'Multiplayer',
  players: { min: 3, max: 20 },
  color: '#7b4bd6',
  description: 'A word party game for friends on the same Wi-Fi. Give clues, spot who has a different word, and vote out the Undercover and Mr. White.',
  controls: 'Read your secret word, give a one-word clue when it is your turn, then tap Vote on the player who sounds off. Needs 3 or more players.',
  daily: false,
  component: lazy(() => import('./UndercoverGame')),
}
