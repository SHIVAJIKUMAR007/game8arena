import { lazy } from 'react'

export default {
  id: 'connect',
  title: 'Color Connect',
  emoji: '🔴',
  category: 'Puzzle',
  color: '#3e7bfa',
  description: 'Join each pair of matching dots with a pipe. Pipes can’t cross, and every square must be filled!',
  controls: 'Drag from a dot to draw. Keyboard: arrows move, Space picks up / puts down a colour.',
  daily: true,
  component: lazy(() => import('./ConnectGame')),
}
