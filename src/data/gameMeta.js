// Display-only metadata for the home grid and landing cards. Kept apart from each game's own definition
// (src/games/*/index.js) so the games themselves stay untouched.
//   difficulty: 'Easy' | 'Medium' | 'Hard'   isNew: shows a "New" badge
const meta = {
  connect: { difficulty: 'Easy' },
  memory: { difficulty: 'Easy' },
  merge: { difficulty: 'Easy' },
  arrow: { difficulty: 'Medium' },
  box: { difficulty: 'Medium' },
  traffic: { difficulty: 'Medium' },
  pipe: { difficulty: 'Medium' },
  word: { difficulty: 'Medium' },
  solitaire: { difficulty: 'Medium', isNew: true },
  god: { difficulty: 'Hard' },
  code: { difficulty: 'Hard' },
  sudoku: { difficulty: 'Hard' },
  minesweeper: { difficulty: 'Hard', isNew: true },
  blocky: { difficulty: 'Medium', isNew: true },
  bubbles: { difficulty: 'Medium', isNew: true },
  family: { difficulty: 'Easy', isNew: true },
  hideseek: { difficulty: 'Medium', isNew: true },
  undercover: { difficulty: 'Medium', isNew: true },
  tictactoe: { difficulty: 'Easy', isNew: true },
  bingo: { difficulty: 'Easy', isNew: true },
  tambola: { difficulty: 'Easy', isNew: true },
}

export const gameMeta = id => meta[id] || {}
