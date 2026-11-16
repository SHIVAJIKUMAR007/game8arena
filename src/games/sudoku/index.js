import { lazy } from 'react'

export default {
  id: 'sudoku',
  title: 'Sudoku',
  emoji: '🔢',
  category: 'Logic',
  color: '#3e7bfa',
  description: 'Fill the grid so every row, every column and every 3×3 box holds the digits 1 to 9 exactly once.',
  controls: 'Tap a cell, then a number. Keyboard: arrows move, 1–9 place a digit, Backspace clears.',
  daily: true,
  component: lazy(() => import('./SudokuGame')),
}
