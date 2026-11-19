// Game-specific content: tutorial, achievements and limits. Read by the game and by its landing page.
import { readStats } from './store'

export const config = {
  hints: 5, // per deal; a hint shows one good move and costs the "no hints" star

  tutorial: [
    { icon: '🃏', title: 'The goal', body: 'Move all 52 cards up to the four foundations at the top right, one pile per suit, from Ace to King.' },
    { icon: '⬇️', title: 'Columns', body: 'In the seven columns, build down in alternating colours: a red 6 can go on a black 7. You can move a whole run of cards that are already in order.' },
    { icon: '👑', title: 'Empty columns', body: 'Only a King, or a run that starts with a King, can be moved into an empty column.' },
    { icon: '🂠', title: 'Face-down cards', body: 'When you move the last face-up card off a column, the card below turns over by itself. Turning over every card is the key to winning.' },
    { icon: '🔄', title: 'The stock', body: 'Tap the stock at the top left to turn cards onto the waste pile. Only the top waste card can be played. When the stock runs out, tap it again to turn the waste back over.' },
    { icon: '1️⃣', title: 'Draw one or three', body: 'Draw one turns one card at a time. Draw three turns three, and only the top one is playable, which makes the game harder. Pick the mode on the menu.' },
    { icon: '👆', title: 'Moving cards', body: 'Drag cards to where they should go. Or tap a card to pick it up and tap where it should go. Tap a picked-up card again, or double-click it, to send it to the best place.' },
    { icon: '💡', title: 'Hints, undo and stars', body: 'Undo is unlimited. A hint shows a move that leads to a win. Stars: one for winning, one for no hints, one for beating the par time.' },
  ],

  // check(stats, ctx, progress): `progress.solStats` holds this game's statistics.
  achievements: [
    { id: 'first_win', icon: '🃏', title: 'First deal', description: 'Win your first game.', check: (s, c, p) => readStats(p).won >= 1 },
    { id: 'draw3_win', icon: '3️⃣', title: 'Three at a time', description: 'Win a game in draw-three mode.', check: (s, c) => c.won && c.draw === 3 },
    { id: 'unaided', icon: '🧠', title: 'On your own', description: 'Win level 10 or higher without a hint.', check: (s, c) => c.won && c.mode === 'campaign' && c.level >= 10 && c.hints === 0 },
    { id: 'no_undo', icon: '✍️', title: 'No take-backs', description: 'Win a game without using undo.', check: (s, c) => c.won && c.undos === 0 },
    { id: 'fast_5', icon: '⚡', title: 'Quick hands', description: 'Win a game in 5 minutes or less.', check: (s, c) => c.won && c.time <= 300 },
    { id: 'streak_5', icon: '🔥', title: 'On a roll', description: 'Win 5 games in a row.', check: (s, c, p) => readStats(p).maxStreak >= 5 },
    { id: 'level_10', icon: '🥉', title: 'Getting the feel', description: 'Clear level 10.', check: (s, c, p) => p.best >= 10 },
    { id: 'level_25', icon: '🥈', title: 'Card sharp', description: 'Clear level 25.', check: (s, c, p) => p.best >= 25 },
    { id: 'level_50', icon: '🏆', title: 'Top of the deck', description: 'Clear level 50, the hardest setting.', check: (s, c, p) => p.best >= 50 },
  ],
}
