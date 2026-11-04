// Game-specific content for the shared LevelGameShell.
export const config = {
  maxLives: 3,
  hints: 3,
  undos: 10,
  daily: true,
  dailyLevel: 10, // 8×8

  tutorial: [
    { icon: '🙏', title: 'Answer a prayer', body: 'A villager has a problem only one god can fix. Find that god on the board and you win.' },
    { icon: '🎨', title: 'Realms', body: 'The board is split into coloured realms, one per god. A god only ever hides under its own colour.' },
    { icon: '📏', title: 'One per line', body: 'There is exactly one god in every row, every column and every realm.' },
    { icon: '😠', title: 'Gods hate each other', body: 'No two gods touch: not side by side, and not diagonally.' },
    { icon: '✕', title: 'Discard and search', body: 'Tap a cell once to discard it (✕) when the rules say no god can be there. Double-tap to search it. A wrong search costs a 💧.' },
    { icon: '💡', title: 'Never guess', body: 'Every board can be solved with logic alone. Stuck? A hint shows the next deduction and explains it.' },
  ],

  achievements: [
    { id: 'first_clear', icon: '🙏', title: 'Prayer answered', description: 'Find your first god.', check: s => s.cleared >= 1 },
    { id: 'flawless_1', icon: '💎', title: 'Divine insight', description: 'Find a god without a wrong search.', check: s => s.flawless >= 1 },
    { id: 'flawless_10', icon: '🔮', title: 'Oracle', description: 'Clear 10 levels without a wrong search.', check: s => s.flawless >= 10 },
    { id: 'level_6', icon: '🗺️', title: 'Explorer', description: 'Reach the 7×7 realms (clear level 5).', check: (s, c, p) => p.best >= 5 },
    { id: 'level_15', icon: '🔱', title: 'Pantheon', description: 'Reach the 9×9 realms (clear level 14).', check: (s, c, p) => p.best >= 14 },
    { id: 'daily_3', icon: '📅', title: 'Devoted', description: 'Finish the daily challenge 3 days in a row.', check: (s, c, p) => p.daily.streak >= 3 },
  ],
}
