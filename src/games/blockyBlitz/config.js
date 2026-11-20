// Content for the landing page. Blocky Blitz is an endless score game, so it has no hints, undo or badges.
export const config = {
  hints: 0,
  undos: 0,
  achievements: [],

  tutorial: [
    { icon: '🧱', title: 'Drag pieces onto the board', body: 'Pick one of the three pieces at the bottom and drag it onto the 8×8 grid. Pieces never rotate. On a keyboard, press Enter on a piece, move with the arrow keys and press Enter again to place it.' },
    { icon: '✨', title: 'Fill a row or column to clear it', body: 'Every full row or column disappears. Clear several at once, or clear on back-to-back moves, for a bigger combo bonus.' },
    { icon: '📥', title: 'Use the hold slot and re-rolls', body: 'Drag a piece into the hold slot to save it for later, and drag it out when it fits. The swap button replaces the pieces still waiting in the tray. You start with 2 and earn one at every level.' },
    { icon: '🏁', title: 'Keep a move available', body: 'The game ends when none of your pieces, including the held one, fits anywhere. Every new set of three has at least one piece that fits.' },
  ],
}
