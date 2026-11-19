import { lazy } from 'react'

export default {
  id: 'solitaire',
  title: 'Solitaire',
  emoji: '🃏',
  category: 'Cards',
  color: '#1f8a5b',
  description: 'Classic Klondike Solitaire. Build the four foundations from Ace to King, with draw-one or draw-three, levels that get harder slowly, and only winnable deals.',
  controls: 'Drag cards, or tap a card and then tap where it goes. Tap a picked-up card again (or double-click) to send it to the best spot. Tap the stock to draw. Keys: D draws, H hint, U or Ctrl+Z undo, P pause, Esc drops the card.',
  component: lazy(() => import('./SolitaireGame')),
}
