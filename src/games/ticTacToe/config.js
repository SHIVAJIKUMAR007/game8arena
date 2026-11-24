// Content for the landing page and the how-to-play tips. Tic Tac Toe has no solo levels, hints or undo.
export const config = {
  hints: 0,
  undos: 0,
  achievements: [],

  tutorial: [
    { icon: '🔗', title: 'Make or join a room', body: 'One player creates a room and shares the 4-letter code. The other opens the game, enters the code and joins.' },
    { icon: '⭕', title: 'Take turns', body: 'You play X or O. Tap an empty square on your turn. The player with X always goes first, and the marks swap each game.' },
    { icon: '➖', title: 'Three in a row', body: 'Get three of your marks in a row, column or diagonal to win the game. A full board with no line is a draw.' },
    { icon: '🏆', title: 'Win the match', body: 'The host picks best of 1, 3 or 5. The first player to win most of the games takes the match.' },
  ],
}
