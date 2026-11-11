import { lazy } from 'react'

export default {
  id: 'pipe',
  title: 'Pipe Connect',
  emoji: '🚰',
  category: 'Puzzle',
  color: '#c8763b',
  description: 'Turn the pipes so water flows from the tap to every drain before the clock runs out!',
  controls: 'Click a pipe to turn it (right-click turns back). Keyboard: arrows move, Space turns, Shift+Space turns back.',
  daily: true,
  component: lazy(() => import('./PipeGame')),
}
