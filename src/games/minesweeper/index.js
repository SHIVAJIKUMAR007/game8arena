import { lazy } from 'react'

export default {
  id: 'minesweeper',
  title: 'Minesweeper',
  emoji: '💣',
  category: 'Logic',
  color: '#e0623f',
  description: 'Open every safe square without touching a mine. Numbers tell you how many mines are next to a square. Levels, classic boards and a daily challenge.',
  controls: 'Click to open a square, right-click to flag. On touch, press and hold to flag. Click an open number to open its neighbours. Keyboard: arrows move, Space opens, F flags.',
  daily: true,
  component: lazy(() => import('./MinesweeperGame')),
}
