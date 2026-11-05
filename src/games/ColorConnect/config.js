// Game-specific content for the shared LevelGameShell.
export const config = {
  maxLives: 3,
  hints: 3,
  undos: 10,
  daily: true,
  dailyLevel: 16, // 8×8

  tutorial: [
    { icon: '🔴', title: 'Join the pairs', body: 'Drag from a dot to draw a pipe to the other dot with the same colour and number.' },
    { icon: '✖️', title: 'No crossing', body: 'Pipes can’t cross or overlap. Draw over another pipe and you cut it. Back up to restore it.' },
    { icon: '🟩', title: 'Fill the grid', body: 'The level is cleared when every pair is joined AND every square is covered by a pipe.' },
    { icon: '💧', title: 'Moves', body: 'Picking up a different colour is a move. Perfect play is one move per colour. Every few moves past that cost a 💧.' },
    { icon: '⌨️', title: 'Keyboard', body: 'Arrow keys move the cursor. Space picks up a colour on a dot or pipe, arrows draw, Space puts it down.' },
    { icon: '💡', title: 'Hints and undo', body: 'A hint draws one pipe for you. Undo takes back your last stroke (moves aren’t refunded).' },
  ],

  achievements: [
    { id: 'first_clear', icon: '🔴', title: 'Connected', description: 'Clear your first level.', check: s => s.cleared >= 1 },
    { id: 'flawless_1', icon: '💎', title: 'Clean lines', description: 'Clear a level without losing a life.', check: s => s.flawless >= 1 },
    { id: 'flawless_10', icon: '🌈', title: 'Pipe dream', description: 'Clear 10 levels without losing a life.', check: s => s.flawless >= 10 },
    { id: 'combo_20', icon: '🔥', title: 'Steady hand', description: 'Make 20 moves in a row within budget.', check: s => s.bestCombo >= 20 },
    { id: 'level_9', icon: '🧩', title: 'Seven by seven', description: 'Reach level 9.', check: (s, c, p) => p.best >= 8 },
    { id: 'level_23', icon: '🏆', title: 'Master plumber', description: 'Reach the 9×9 grids (level 23).', check: (s, c, p) => p.best >= 22 },
    { id: 'daily_3', icon: '📅', title: 'Regular', description: 'Finish the daily challenge 3 days in a row.', check: (s, c, p) => p.daily.streak >= 3 },
  ],
}
