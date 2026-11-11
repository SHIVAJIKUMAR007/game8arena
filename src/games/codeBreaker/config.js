// Game-specific content for the shared LevelGameShell.
export const config = {
  maxLives: 3,
  hints: 3,
  undos: 2,
  daily: true,
  dailyLevel: 12, // 4 spots, 6 colours, repeats allowed

  tutorial: [
    { icon: '🔐', title: 'Crack the code', body: 'A secret row of coloured, numbered pegs is hidden at the top. Find it within your attempts.' },
    { icon: '🎨', title: 'Make a guess', body: 'Tap colours (or press their numbers) to fill the spots, then press Check. Tap a spot to change it.' },
    { icon: '⚫', title: 'Read the clues', body: 'A filled dot means one peg is the right colour in the right spot. A ring means right colour, wrong spot. The clue doesn’t say which pegs.' },
    { icon: '🧠', title: 'Deduce', body: '“Possible codes” counts the codes that still fit every clue. Guesses that fit all clues build your combo. A guess an earlier clue already ruled out is marked red.' },
    { icon: '💧', title: 'Attempts', body: 'Run out of attempts and you lose a 💧 but get 3 more. Fewer lost 💧 means more stars.' },
    { icon: '🔁', title: 'Repeats', body: 'From level 10 a colour can appear more than once in the code.' },
    { icon: '💡', title: 'Hints and undo', body: 'A hint reveals one spot of the code. Undo refunds the attempt for a guess that couldn’t have been the code. Its clue still counts.' },
  ],

  achievements: [
    { id: 'first_clear', icon: '🔐', title: 'Codebreaker', description: 'Crack your first code.', check: s => s.cleared >= 1 },
    { id: 'flawless_1', icon: '🕵️', title: 'Sharp mind', description: 'Crack a code without losing a life.', check: s => s.flawless >= 1 },
    { id: 'flawless_10', icon: '🧠', title: 'Mastermind of logic', description: 'Crack 10 codes without losing a life.', check: s => s.flawless >= 10 },
    { id: 'combo_8', icon: '🔥', title: 'Airtight', description: 'Make 8 guesses in a row that fit every clue.', check: s => s.bestCombo >= 8 },
    { id: 'level_10', icon: '🔁', title: 'Double trouble', description: 'Reach the codes with repeated colours (level 10).', check: (s, c, p) => p.best >= 9 },
    { id: 'level_23', icon: '🏆', title: 'Vault cracker', description: 'Reach 8-colour codes (level 23).', check: (s, c, p) => p.best >= 22 },
    { id: 'daily_3', icon: '📅', title: 'Regular', description: 'Finish the daily challenge 3 days in a row.', check: (s, c, p) => p.daily.streak >= 3 },
  ],
}
