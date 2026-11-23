// Content for the landing page and the first-run tips. Family Sort has its own hint, undo and coin systems.
export const config = {
  hints: 0,
  undos: 0,
  achievements: [],

  tutorial: [
    { icon: '🧪', title: 'Sort the colours', body: 'Each glass bottle holds up to four layers of liquid. Fill every bottle with a single colour, or leave it empty, to clear the level.' },
    { icon: '👆', title: 'Tap, then tap', body: 'Tap a bottle to lift it, then tap where to pour. You can pour onto the same colour or into an empty bottle, and only the matching layers on top move.' },
    { icon: '🚫', title: 'No mixing', body: 'Colours never mix. If the target bottle is full or has a different colour on top, the pour is refused and the bottle gives a little shake.' },
    { icon: '💡', title: 'Undo, hint and extra bottle', body: 'Undo is free. A hint costs coins and shows a good move. If you are stuck, an extra empty bottle costs coins too. Finish a level without hints for a bonus.' },
    { icon: '🪙', title: 'Earn coins, unlock more', body: 'Every level pays coins. Spend them in Settings on new bottle styles and garden backgrounds.' },
  ],
}
