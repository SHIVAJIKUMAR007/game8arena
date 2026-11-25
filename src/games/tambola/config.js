// Game-specific content: tutorial, achievements and limits. Read by the game and by its landing page.
import { readStats } from './store'

export const config = {
  hints: 3, // per level; a hint points at a called number you still need, or tells you to claim
  undos: 0, // a mark can't be taken back
  maxLives: 3, // a wrong mark, a false claim, or losing the race costs a life
  daily: false,

  tutorial: [
    { icon: '🎟️', title: 'Your ticket', body: 'A ticket has 3 rows and 9 columns. Each row holds 5 numbers and 4 blanks, 15 numbers in all, from 1 to 90.' },
    { icon: '📣', title: 'The caller', body: 'A number from 1 to 90 is announced every few seconds. Every number is called only once. The board at the bottom shows what has come out.' },
    { icon: '👆', title: 'Mark your numbers', body: 'If the number you hear is on your ticket, tap it. Tapping a number that has not been called costs a life, so watch the caller.' },
    { icon: '🏁', title: 'Claim the pattern', body: 'Early Five is any 5 numbers on one ticket. A Line is a full row. A Full House is all 15. Press Claim as soon as your pattern is complete.' },
    { icon: '🤖', title: 'Beat the other players', body: 'From level 8 or so, computer players race you for the same pattern. If one claims first you lose a life, so mark every number as it is called.' },
    { icon: '💡', title: 'Hints and levels', body: 'A hint points at a number you can mark right now. Each level adds tickets, a faster caller and more rivals, and the pattern grows from Early Five to Full House.' },
  ],

  // check(stats, ctx, progress): `progress.tbStats` holds this game's statistics.
  achievements: [
    { id: 'first_claim', icon: '🎟️', title: 'Housie!', description: 'Win your first level.', check: (s, c, p) => readStats(p).won >= 1 },
    { id: 'flawless', icon: '💧', title: 'Clean ticket', description: 'Win a level without losing a life.', check: (s, c) => Boolean(c.flawless) },
    { id: 'level_10', icon: '🔢', title: 'Number cruncher', description: 'Clear level 10.', check: (s, c, p) => p.best >= 10 },
    { id: 'level_30', icon: '🏠', title: 'Full house', description: 'Clear level 30, where the Full House pattern is in play.', check: (s, c, p) => p.best >= 30 },
    { id: 'level_40', icon: '🏆', title: 'Top of the ramp', description: 'Clear level 40, the hardest setting.', check: (s, c, p) => p.best >= 40 },
  ],
}
