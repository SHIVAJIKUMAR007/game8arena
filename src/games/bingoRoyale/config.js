// Content for the landing page and the how-to-play tips. Bingo Royale has no solo levels, hints or undo.
export const config = {
  hints: 0,
  undos: 0,
  achievements: [],

  tutorial: [
    { icon: '🔢', title: 'Build your board', body: 'Put every number from 1 to 25 on your 5 by 5 board, in any order you like. Tap a square, then a number, or press Shuffle.' },
    { icon: '✅', title: 'Get ready', body: 'Confirm your board. When everyone is ready, the host starts the game. Boards lock once it begins.' },
    { icon: '📣', title: 'Announce in turn', body: 'Going clockwise, each player announces one number nobody has used. It is marked on every board at once.' },
    { icon: '📏', title: 'Complete lines', body: 'A row, a column or a diagonal is complete when all five of its numbers are out. There are 12 possible lines on a board.' },
    { icon: '🏆', title: 'First to 5 lines wins', body: 'Reach 5 completed lines on your own board before anyone else and you win the round.' },
  ],
}
