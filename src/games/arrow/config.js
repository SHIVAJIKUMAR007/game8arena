// Game-specific content for the shared LevelGameShell: tutorial text + achievements.
export const config = {
  maxLives: 3,
  hints: 3,
  undos: 3,
  daily: true,
  dailyLevel: 15,

  tutorial: [
    { icon: '👆', title: 'Tap an arrow to launch it', body: 'It slides along its own path and then flies straight out of the board in the direction its tip points.' },
    { icon: '💥', title: 'Don’t hit another arrow', body: 'If anything is in the way, you lose a 💧. You get 3 per level — run out and you retry the level.' },
    { icon: '🔍', title: 'Long-press to see the path', body: 'Hold an arrow to see its flight line. “Show paths” shows every line at once.' },
    { icon: '💡', title: 'Stuck? Use a hint or undo', body: 'Hints highlight an arrow that is safe to launch. Clear a level without losing a life for 3 ★ and a banked extra life.' },
    { icon: '🌈', title: 'Special arrows (level 21+)', body: 'A rainbow arrow is a normal arrow — launch it safely and it sends several other free arrows flying out with it.' },
    { icon: '⌨️', title: 'Keyboard friendly', body: 'Use Tab to move between arrows and Enter or Space to launch. Pinch or use + / − to zoom big boards.' },
  ],

  achievements: [
    { id: 'first_clear', icon: '🎯', title: 'First flight', description: 'Clear your first level.', check: s => s.cleared >= 1 },
    { id: 'flawless_1', icon: '💎', title: 'Flawless', description: 'Clear a level without losing a life.', check: s => s.flawless >= 1 },
    { id: 'flawless_10', icon: '👑', title: 'Perfectionist', description: 'Clear 10 levels flawlessly.', check: s => s.flawless >= 10 },
    { id: 'combo_10', icon: '🔥', title: 'On fire', description: 'Launch 10 arrows in a row without a mistake.', check: s => s.bestCombo >= 10 },
    { id: 'combo_30', icon: '🌋', title: 'Unstoppable', description: 'Launch 30 arrows in a row without a mistake.', check: s => s.bestCombo >= 30 },
    { id: 'level_10', icon: '🏔️', title: 'Getting serious', description: 'Reach level 10.', check: (s, c, p) => p.best >= 10 },
    { id: 'level_28', icon: '🧗', title: 'The 60-arrow wall', description: 'Clear level 28 (60 arrows).', check: (s, c, p) => p.best >= 28 },
    { id: 'level_50', icon: '🚀', title: 'Arrow master', description: 'Clear level 50.', check: (s, c, p) => p.best >= 50 },
    { id: 'daily_3', icon: '📅', title: 'Regular', description: 'Finish the daily challenge 3 days in a row.', check: (s, c, p) => p.daily.streak >= 3 },
    { id: 'daily_7', icon: '🗓️', title: 'Week warrior', description: 'Finish the daily challenge 7 days in a row.', check: (s, c, p) => p.daily.streak >= 7 },
  ],
}
