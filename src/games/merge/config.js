import { isEndless } from './logic'
// Game-specific content for the shared LevelGameShell.
export const config = {
  maxLives: 3,
  hints: 3,
  undos: 5,
  daily: true,
  dailyLevel: 4,
  endless: level => isEndless(level), // level 6+: no target, play for a high score

  tutorial: [
    { icon: '👆', title: 'Slide the tiles', body: 'Swipe, use the arrow keys / WASD, or tap the pad. Every tile slides as far as it can.' },
    { icon: '➕', title: 'Merge equal tiles', body: 'Line up THREE tiles with the same number (3, 3, 3) and they merge into one worth triple (9). Reach the goal tile to clear the level. From level 6 there is no goal: play endless for a high score.' },
    { icon: '💧', title: 'Don’t get stuck', body: 'If the board fills up with no moves left you lose a 💧 and the three smallest tiles are cleared. Out of lives and you retry the level.' },
    { icon: '💡', title: 'Hints and undo', body: 'A hint shows a good direction to slide. Undo takes back your last move (and the life, if it cost one).' },
  ],

  achievements: [
    { id: 'first_clear', icon: '🎯', title: 'First merge', description: 'Clear your first level.', check: s => s.cleared >= 1 },
    { id: 'flawless_1', icon: '💎', title: 'Flawless', description: 'Clear a level without losing a life.', check: s => s.flawless >= 1 },
    { id: 'combo_50', icon: '🔥', title: 'In the flow', description: 'Make 50 moves in a row without getting stuck.', check: s => s.bestCombo >= 50 },
    { id: 'level_6', icon: '🏔️', title: 'Power of three', description: 'Clear level 5 (the 2187 tile).', check: (s, c, p) => p.best >= 5 },
    { id: 'level_endless', icon: '🚀', title: 'Merge master', description: 'Reach level 6 (endless mode).', check: (s, c, p) => p.best >= 5 },
    { id: 'daily_3', icon: '📅', title: 'Regular', description: 'Finish the daily challenge 3 days in a row.', check: (s, c, p) => p.daily.streak >= 3 },
  ],
}
