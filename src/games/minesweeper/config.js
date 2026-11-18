// Game-specific content: tutorial, achievements and limits. Read by the game and by its landing page.
import { readStats } from './store'

export const config = {
  hints: 3, // per board; a hint points at one square you can be sure about and costs a star
  undos: 0, // there is no undo: opening a mine ends the round
  daily: true,

  tutorial: [
    { icon: '💣', title: 'The goal', body: 'Some squares hide mines. Open every square that is safe. If you open a mine, the round ends.' },
    { icon: '🔢', title: 'Numbers', body: 'A number tells you how many of the eight squares around it hold a mine. A 1 has one mine next to it, a 3 has three.' },
    { icon: '⬜', title: 'Empty squares', body: 'A square with no number has no mines around it, so the game opens all its neighbours for you.' },
    { icon: '🚩', title: 'Flags', body: 'Right-click a square to mark a mine. On a phone or tablet, press and hold it, or turn on flag mode under the board. Tap the flag again to remove it.' },
    { icon: '👆', title: 'Opening neighbours', body: 'Click an open number once you have flagged as many mines as it shows. The game opens its other neighbours at once. A wrong flag makes this open a mine.' },
    { icon: '🍀', title: 'Your first click', body: 'The first square you open and the ones around it never hold a mine. The glowing square is a good place to start.' },
    { icon: '🧠', title: 'No guessing', body: 'Every level and every daily board can be finished by logic alone. The mine counter at the top shows mines minus flags.' },
    { icon: '💡', title: 'Hints and stars', body: 'A hint points at a square you can be sure about. Stars depend on how few hints you use and how fast you finish.' },
  ],

  // check(stats, ctx, progress): `progress.msStats` holds this game's statistics.
  achievements: [
    { id: 'first_win', icon: '🚩', title: 'First sweep', description: 'Clear your first board.', check: (s, c, p) => readStats(p).won >= 1 },
    { id: 'beginner_30', icon: '⚡', title: 'Quick hands', description: 'Clear a Beginner board in 30 seconds or less.', check: (s, c) => c.won && c.mode === 'beginner' && c.time <= 30 },
    { id: 'intermediate_win', icon: '🧭', title: 'Getting somewhere', description: 'Clear an Intermediate board.', check: (s, c) => c.won && c.mode === 'intermediate' },
    { id: 'expert_win', icon: '🏆', title: 'Expert sweeper', description: 'Clear an Expert board.', check: (s, c) => c.won && c.mode === 'expert' },
    { id: 'unaided_10', icon: '🧠', title: 'Unaided', description: 'Clear a level of 10 or higher without a hint.', check: (s, c) => c.won && c.mode === 'campaign' && c.level >= 10 && c.hints === 0 },
    { id: 'wins_5', icon: '🔥', title: 'On a roll', description: 'Win 5 boards in a row.', check: (s, c, p) => readStats(p).maxStreak >= 5 },
    { id: 'level_30', icon: '🔬', title: 'Pattern spotter', description: 'Clear level 30, where longer chains of reasoning begin.', check: (s, c, p) => p.best >= 30 },
    { id: 'level_60', icon: '🎖️', title: 'Top of the ramp', description: 'Clear level 60, the hardest setting.', check: (s, c, p) => p.best >= 60 },
    { id: 'daily_3', icon: '📅', title: 'Regular', description: 'Finish the daily challenge 3 days in a row.', check: (s, c, p) => p.daily.streak >= 3 },
  ],
}
