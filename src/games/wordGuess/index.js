import { lazy } from 'react'

export default {
  id: 'word',
  title: 'Word Guess',
  emoji: '🔤',
  category: 'Word',
  color: '#3aa35b',
  description: 'Guess the hidden five-letter word in six tries. Green, yellow and grey tiles tell you which letters are right.',
  controls: 'Type on your keyboard or tap the on-screen keys. Enter submits a guess, Backspace deletes a letter.',
  daily: true,
  component: lazy(() => import('./WordGame')),
}
