// Game-specific content for the shared LevelGameShell.
export const config = {
  maxLives: 3,
  hints: 3,
  undos: 2,
  daily: true,
  dailyLevel: 10, // 9 pads, 14 steps

  tutorial: [
    { icon: '👀', title: 'Watch', body: 'The pads light up and play a note, one after another. Remember the order.' },
    { icon: '👆', title: 'Repeat', body: 'Tap the pads in the same order (or press 1–9). Each round adds one more step.' },
    { icon: '🏁', title: 'Reach the target', body: 'Repeat a sequence of the target length to clear the level. The dots show your progress through the round.' },
    { icon: '💧', title: 'Mistakes cost a life', body: 'Tap the wrong pad and you lose a 💧, then the sequence plays again. Out of lives and you retry the level.' },
    { icon: '🔀', title: 'It gets harder', body: 'More pads, longer sequences and faster playback. From level 12 the pads swap places every round!' },
    { icon: '💡', title: 'Hints and undo', body: 'A hint flashes the next pad. Undo takes back your last mistake: the life comes back and you carry on.' },
  ],

  achievements: [
    { id: 'first_clear', icon: '🧠', title: 'Good memory', description: 'Clear your first level.', check: s => s.cleared >= 1 },
    { id: 'flawless_1', icon: '💎', title: 'Flawless', description: 'Clear a level without a mistake.', check: s => s.flawless >= 1 },
    { id: 'flawless_10', icon: '🎼', title: 'Perfect pitch', description: 'Clear 10 levels without a mistake.', check: s => s.flawless >= 10 },
    { id: 'combo_15', icon: '🔥', title: 'On a roll', description: 'Get 15 rounds right in a row.', check: s => s.bestCombo >= 15 },
    { id: 'level_9', icon: '🔢', title: 'Nine pads', description: 'Reach level 9.', check: (s, c, p) => p.best >= 8 },
    { id: 'level_12', icon: '🔀', title: 'Shuffle master', description: 'Clear a shuffling level (level 12).', check: (s, c, p) => p.best >= 12 },
    { id: 'level_20', icon: '🏆', title: 'Elephant', description: 'Clear level 20: a 24-step sequence.', check: (s, c, p) => p.best >= 20 },
    { id: 'daily_3', icon: '📅', title: 'Regular', description: 'Finish the daily challenge 3 days in a row.', check: (s, c, p) => p.daily.streak >= 3 },
  ],
}
