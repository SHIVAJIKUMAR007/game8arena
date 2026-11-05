import { lazy } from 'react'

export default {
  id: 'memory',
  title: 'Memory Sequence',
  emoji: '🧠',
  category: 'Memory',
  color: '#9b6bff',
  description: 'Watch the pads light up and sing, then repeat the sequence. Every round adds a step!',
  controls: 'Tap the pads, or press 1–9 (pads are numbered in reading order).',
  daily: true,
  component: lazy(() => import('./MemoryGame')),
}
