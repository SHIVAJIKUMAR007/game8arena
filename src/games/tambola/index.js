import { lazy } from 'react'

export default {
  id: 'tambola',
  title: 'Tambola',
  emoji: '🎟️',
  category: 'Casual',
  color: '#d6336c',
  description: 'Play Tambola, also called Housie or Indian Bingo. Mark the numbers the caller announces on your tickets and claim Early Five, a Line or a Full House before the computer players do.',
  controls: 'Tap or click a number on your ticket once it has been called. Press Claim when your pattern is complete, or press C. Keyboard: Tab to a number and press Enter or Space.',
  daily: false,
  component: lazy(() => import('./TambolaGame')),
}
