// Game-specific content for the shared LevelGameShell.
export const config = {
  maxLives: 3,
  hints: 3,
  undos: 3,
  daily: true,
  dailyLevel: 8,

  tutorial: [
    { icon: '🔢', title: 'The goal', body: 'Fill every empty cell with a digit from 1 to 9.' },
    { icon: '↔️', title: 'Rows and columns', body: 'Each row and each column must contain the digits 1 to 9 exactly once.' },
    { icon: '🟦', title: 'Boxes', body: 'Each of the nine 3×3 boxes must also contain 1 to 9 exactly once.' },
    { icon: '👆', title: 'How to play', body: 'Tap an empty cell, then tap a number (or press 1–9). Press Backspace or Erase to clear a digit you placed.' },
    { icon: '💧', title: 'Mistakes cost a life', body: 'Every puzzle has exactly one solution. A wrong digit is rejected and costs a 💧. Fewer lost 💧 means more stars.' },
    { icon: '💡', title: 'Hints and undo', body: 'A hint fills in the easiest cell for you. Undo takes back your last digit.' },
    { icon: '📈', title: 'It gets harder', body: 'Each level starts with fewer given digits, so you need more logic.' },
  ],

  achievements: [
    { id: 'first_clear', icon: '🔢', title: 'First grid', description: 'Solve your first Sudoku.', check: s => s.cleared >= 1 },
    { id: 'flawless_1', icon: '💎', title: 'Flawless', description: 'Solve a grid without losing a life.', check: s => s.flawless >= 1 },
    { id: 'flawless_10', icon: '🧠', title: 'Sudoku master', description: 'Solve 10 grids without losing a life.', check: s => s.flawless >= 10 },
    { id: 'combo_20', icon: '🔥', title: 'In the zone', description: 'Place 20 correct digits in a row.', check: s => s.bestCombo >= 20 },
    { id: 'level_10', icon: '🏅', title: 'Getting serious', description: 'Reach level 10.', check: (s, c, p) => p.best >= 9 },
    { id: 'level_20', icon: '🏆', title: 'Grandmaster', description: 'Clear level 20.', check: (s, c, p) => p.best >= 20 },
    { id: 'daily_3', icon: '📅', title: 'Regular', description: 'Finish the daily challenge 3 days in a row.', check: (s, c, p) => p.daily.streak >= 3 },
  ],
}
