// Content for the landing page and the how-to-play tips. Undercover has no solo levels, hints or undo.
export const config = {
  hints: 0,
  undos: 0,
  achievements: [],

  tutorial: [
    { icon: '🔤', title: 'Everyone gets a secret word', body: 'Civilians all get the same word. The Undercover get a similar word and do not know it. Mr. White gets no word at all.' },
    { icon: '💬', title: 'Give a clue, in turn', body: 'When it is your turn, say one word or a short phrase about your word, without saying the word itself. Be clear enough for your side and vague enough to hide.' },
    { icon: '🗳️', title: 'Vote someone out', body: 'After everyone has spoken, vote for the player who sounds off. The player with the most votes is out and their role is shown. A tie gets one revote.' },
    { icon: '🤍', title: 'Mr. White gets a guess', body: 'If Mr. White is voted out, they get one guess at the civilians’ word. A right guess wins the game on the spot.' },
    { icon: '🏁', title: 'How the game ends', body: 'Civilians win when every Undercover and Mr. White is out. The infiltrators win when the civilians are outnumbered, or when only one civilian is left, depending on the lobby setting.' },
    { icon: '⚙️', title: 'Choose your roles', body: 'The host sets how many Undercover and how many Mr. White. Together they can be at most half of the players.' },
  ],
}
