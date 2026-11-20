import { lazy } from 'react'

export default {
  id: 'bubbles',
  title: 'Bubble Surge',
  emoji: '🫧',
  category: 'Puzzle',
  color: '#ff6b4a',
  description: 'A shooter in the middle of a huge bubble field. Aim in any direction, match three or more to pop them and clear the field before it creeps in.',
  controls: 'Move the mouse or drag a finger to aim, click or release to fire. Click the ring or press Space to swap bubbles. Keyboard: left and right arrows aim, Enter fires, P pauses.',
  daily: false,
  component: lazy(() => import('./BubbleGame')),
}
