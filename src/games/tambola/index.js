import { lazy } from 'react'

export default {
  id: 'tambola',
  title: 'Tambola',
  emoji: '🎟️',
  category: 'Casual',
  categories: ['Casual', 'Multiplayer'],
  color: '#d6336c',
  description: 'Play Tambola, also called Housie or Indian Bingo, solo against computer players or in a room with friends. Cut every number the caller announces, in time, then claim Early Five, a Line or a Full House.',
  controls: 'Tap or click a number on your ticket once it has been called. Press Claim when your pattern is complete, or press C. With friends, you must cut each called number before its timer runs out or you are out of the round. Keyboard: Tab to a number and press Enter or Space.',
  daily: false,
  component: lazy(() => import('./TambolaGame')),
}
