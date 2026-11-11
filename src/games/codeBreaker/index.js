import { lazy } from 'react'

export default {
  id: 'code',
  title: 'Code Breaker',
  emoji: '🔐',
  category: 'Logic',
  color: '#8e4ad6',
  description: 'Crack the hidden colour code. Each guess tells you how many pegs are in the right spot and how many are the right colour in the wrong spot.',
  controls: 'Tap colours to fill the spots, then Check. Keyboard: number keys place a colour, arrows pick a spot, Backspace clears, Enter checks.',
  daily: true,
  component: lazy(() => import('./CodeGame')),
}
