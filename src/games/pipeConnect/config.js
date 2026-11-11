// Game-specific content for the shared LevelGameShell.
export const config = {
  maxLives: 3,
  hints: 3,
  undos: 10,
  daily: true,
  dailyLevel: 15, // 6×6, two drains, bolted pieces

  tutorial: [
    { icon: '🚰', title: 'Get the water flowing', body: 'Water comes from the brass tap. Turn pipe pieces so it can flow all the way to every drain.' },
    { icon: '🔄', title: 'Turn the pipes', body: 'Tap or click a pipe to turn it clockwise. Right-click turns it anticlockwise.' },
    { icon: '💦', title: 'Watch the flow', body: 'Pipes that water reaches turn blue. Two pipes only connect when both open toward each other.' },
    { icon: '🔩', title: 'Bolted pieces', body: 'Dark, bolted squares can’t be turned. Plan around them. Not every pipe has to carry water.' },
    { icon: '⏱️', title: 'Beat the clock', body: 'The clock starts on your first turn. If it runs out you lose a 💧 and it refills halfway. Fewer lost 💧 means more stars.' },
    { icon: '⌨️', title: 'Keyboard', body: 'Arrow keys move the cursor. Space or Enter turns clockwise, Shift+Space anticlockwise.' },
    { icon: '💡', title: 'Hints and undo', body: 'A hint turns one pipe on the route the right way and bolts it down. Undo takes back your last turn (time isn’t refunded).' },
  ],

  achievements: [
    { id: 'first_clear', icon: '🚰', title: 'First flow', description: 'Clear your first level.', check: s => s.cleared >= 1 },
    { id: 'flawless_1', icon: '⏱️', title: 'Beat the clock', description: 'Clear a level without losing a life.', check: s => s.flawless >= 1 },
    { id: 'flawless_10', icon: '💎', title: 'No leaks', description: 'Clear 10 levels without losing a life.', check: s => s.flawless >= 10 },
    { id: 'combo_15', icon: '🔥', title: 'In the flow', description: 'Make 15 turns in a row that each spread the water.', check: s => s.bestCombo >= 15 },
    { id: 'level_10', icon: '🔧', title: 'Apprentice plumber', description: 'Reach the 6×6 grids (level 10).', check: (s, c, p) => p.best >= 9 },
    { id: 'level_21', icon: '🏆', title: 'Master plumber', description: 'Reach the 8×8 grids (level 21).', check: (s, c, p) => p.best >= 20 },
    { id: 'daily_3', icon: '📅', title: 'Regular', description: 'Finish the daily challenge 3 days in a row.', check: (s, c, p) => p.daily.streak >= 3 },
  ],
}
