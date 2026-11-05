// Game-specific content for the shared LevelGameShell.
export const config = {
  maxLives: 3,
  hints: 3,
  undos: 10,
  daily: true,

  tutorial: [
    { icon: '🚗', title: 'Get the red car out', body: 'Slide the red car through the EXIT on the right side of the lot to clear the level.' },
    { icon: '↔️', title: 'Cars stay in their lane', body: 'Drag a car to slide it. Cars only move forwards and backwards (never sideways), and they can’t pass through each other.' },
    { icon: '🔢', title: 'Moves and par', body: 'Sliding one car any distance is one move. Par is the fewest moves the level can be solved in.' },
    { icon: '💧', title: 'Mind your moves', body: 'Every few moves past par cost a 💧, and the line above the lot shows when the next one goes. Finish near par for 3 stars.' },
    { icon: '⌨️', title: 'Keyboard', body: 'Tab to pick a car, arrow keys to slide it one square at a time.' },
    { icon: '💡', title: 'Hints and undo', body: 'A hint shows the next move on a shortest solution. Undo puts back your last move but doesn’t refund it.' },
  ],

  achievements: [
    { id: 'first_clear', icon: '🚗', title: 'Out of the lot', description: 'Clear your first level.', check: s => s.cleared >= 1 },
    { id: 'flawless_1', icon: '💎', title: 'Smooth driver', description: 'Clear a level without losing a life.', check: s => s.flawless >= 1 },
    { id: 'flawless_10', icon: '🏁', title: 'Valet', description: 'Clear 10 levels without losing a life.', check: s => s.flawless >= 10 },
    { id: 'combo_25', icon: '🔥', title: 'In the flow', description: 'Make 25 moves in a row within budget.', check: s => s.bestCombo >= 25 },
    { id: 'level_20', icon: '🚦', title: 'Rush hour', description: 'Clear level 20.', check: (s, c, p) => p.best >= 20 },
    { id: 'level_50', icon: '🏆', title: 'Gridlock breaker', description: 'Clear level 50.', check: (s, c, p) => p.best >= 50 },
    { id: 'daily_3', icon: '📅', title: 'Regular', description: 'Finish the daily challenge 3 days in a row.', check: (s, c, p) => p.daily.streak >= 3 },
  ],
}
