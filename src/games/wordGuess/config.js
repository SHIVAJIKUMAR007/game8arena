// Game-specific content: tutorial, achievements and limits. Read by the game and by its landing page.
export const config = {
  hints: 2, // per word; a hint reveals one letter in its place and caps the word at 2 stars
  undos: 0, // a scored guess can't be taken back
  daily: true,

  tutorial: [
    { icon: '🔤', title: 'Find the word', body: 'Guess the hidden five-letter word in six tries. Type a real English word and press Enter.' },
    { icon: '🟩', title: 'Green', body: 'The letter is in the word and in the right spot.' },
    { icon: '🟨', title: 'Yellow', body: 'The letter is in the word, but in a different spot.' },
    { icon: '⬜', title: 'Grey', body: 'The letter is not in the word (or not as many times as you used it).' },
    { icon: '📈', title: 'Levels', body: 'Every level is a new word. Early words are everyday ones; later words are less common but always fair.' },
    { icon: '💪', title: 'Hard mode', body: 'Turn on hard mode from the menu: every green and yellow letter you find must be used in your next guesses.' },
    { icon: '💡', title: 'Hints and stars', body: 'Solve in 3 guesses or fewer for 3 stars. A hint shows one letter in its place, but caps the word at 2 stars.' },
  ],

  // check(stats, ctx, progress): `progress.wordStats` holds the game's statistics.
  achievements: [
    { id: 'first_win', icon: '🔤', title: 'Wordsmith', description: 'Guess your first word.', check: (s, c, p) => p.wordStats?.wins >= 1 },
    { id: 'two_guesses', icon: '🎯', title: 'Sharpshooter', description: 'Guess a word in two tries or fewer.', check: (s, c) => c.guesses > 0 && c.guesses <= 2 },
    { id: 'wins_25', icon: '📚', title: 'Bookworm', description: 'Guess 25 words.', check: (s, c, p) => p.wordStats?.wins >= 25 },
    { id: 'streak_5', icon: '🔥', title: 'On a roll', description: 'Win 5 words in a row.', check: (s, c, p) => p.wordStats?.maxStreak >= 5 },
    { id: 'hard_win', icon: '💪', title: 'No shortcuts', description: 'Win a word in hard mode without a hint.', check: (s, c) => c.won && c.hard && !c.hints },
    { id: 'level_43', icon: '🏆', title: 'Lexicon master', description: 'Reach the hardest words (level 43).', check: (s, c, p) => p.level >= 43 },
    { id: 'daily_3', icon: '📅', title: 'Regular', description: 'Finish the daily challenge 3 days in a row.', check: (s, c, p) => p.daily.streak >= 3 },
  ],
}
