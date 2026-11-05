// Game-specific content for the shared LevelGameShell.
export const config = {
  maxLives: 3,
  hints: 3,
  undos: 15,
  daily: true,
  dailyLevel: 9, // 4 crates, 9×9

  tutorial: [
    { icon: '📦', title: 'Push every crate home', body: 'Walk into a crate to push it. Get every crate onto a target (◎) to clear the level.' },
    { icon: '🚫', title: 'Push, never pull', body: 'You can only push, one crate at a time. A crate in a corner, or wedged against another crate and a wall, is stuck for good.' },
    { icon: '💧', title: 'Stuck crates cost a life', body: 'Try a push that would trap a crate and it is blocked and you lose a 💧. Some traps are subtler: if a level can no longer be solved, undo or restart.' },
    { icon: '👆', title: 'Controls', body: 'Arrow keys / WASD, swipe, or the pad. Tap a floor tile to walk there, or tap a crate next to you to push it.' },
    { icon: '⭐', title: 'Par', body: 'Par is the fewest pushes the level can be solved in. Can you match it?' },
    { icon: '💡', title: 'Hints and undo', body: 'A hint shows the next push on a shortest solution. Undo takes back your last push.' },
  ],

  achievements: [
    { id: 'first_clear', icon: '📦', title: 'First delivery', description: 'Clear your first level.', check: s => s.cleared >= 1 },
    { id: 'flawless_1', icon: '💎', title: 'Careful hands', description: 'Clear a level without trapping a crate.', check: s => s.flawless >= 1 },
    { id: 'flawless_10', icon: '🏗️', title: 'Warehouse pro', description: 'Clear 10 levels without trapping a crate.', check: s => s.flawless >= 10 },
    { id: 'combo_30', icon: '🔥', title: 'Heavy lifter', description: 'Make 30 good pushes in a row.', check: s => s.bestCombo >= 30 },
    { id: 'level_8', icon: '🧱', title: 'Four crates', description: 'Reach level 8.', check: (s, c, p) => p.best >= 7 },
    { id: 'level_15', icon: '🏆', title: 'Box master', description: 'Clear level 15.', check: (s, c, p) => p.best >= 15 },
    { id: 'daily_3', icon: '📅', title: 'Regular', description: 'Finish the daily challenge 3 days in a row.', check: (s, c, p) => p.daily.streak >= 3 },
  ],
}
