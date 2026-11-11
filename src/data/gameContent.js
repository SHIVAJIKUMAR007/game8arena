// Landing-page copy for each game (/games/:id), keyed by game id.
// "How to play" and "Achievements" come straight from each game's config.js so they never drift from the game;
// this file holds the search-facing copy: title, description, intro, tips and FAQ.
// Keep metaTitle under ~60 characters and metaDescription under ~155 so Google doesn't truncate them.
import { config as arrow } from '../games/arrow/config'
import { config as merge } from '../games/merge/config'
import { config as god } from '../games/findGod/config'
import { config as box } from '../games/boxEscape/config'
import { config as traffic } from '../games/trafficEscape/config'
import { config as memory } from '../games/MemorySequence/config'
import { config as connect } from '../games/ColorConnect/config'
import { config as pipe } from '../games/pipeConnect/config'
import { config as code } from '../games/codeBreaker/config'

export const gameContent = {
  arrow: {
    config: arrow,
    metaTitle: 'Arrow Escape — Free Online Arrow Puzzle Game',
    metaDescription:
      'Play Arrow Escape free online: tap arrows to fire them off the board without hitting another arrow. A relaxing logic puzzle with a daily challenge. No download.',
    tagline: 'Clear the board one arrow at a time — without a single collision.',
    genres: ['Logic puzzle', 'Arrow puzzle'],
    intro: [
      'Arrow Escape is a free online logic puzzle. The board is packed with arrows, and each one can only fly in the direction its tip points. Tap an arrow to launch it: it slides along its path and flies off the edge of the board. If another arrow is in the way, it crashes and you lose a life.',
      'The trick is working out the order. Early levels take a few seconds; later boards hold dozens of tangled arrows, and from level 21 rainbow arrows launch several others at once. Long-press any arrow to preview its flight line before you commit.',
    ],
    tips: [
      'Start at the edges: arrows pointing straight out of the board with nothing in front of them are always safe.',
      'Work backwards. If an arrow is blocked, find which arrow is in its way and clear that one first.',
      'Use long-press (or “Show paths”) on crowded boards to see every flight line at once.',
      'Clear a level without losing a life to earn 3 stars and bank an extra life for harder levels.',
    ],
    faq: [
      { q: 'What are rainbow arrows?', a: 'From level 21 some arrows are rainbow-coloured. A rainbow arrow is launched like any other arrow, but when it flies out safely it sends several other arrows flying out with it, clearing big boards faster.' },
      { q: 'Can I play Arrow Escape on my phone?', a: 'Yes. It works on phones, tablets and desktop browsers. Tap to launch arrows on touch screens, or use Tab and Enter on a keyboard.' },
      { q: 'What happens if I hit another arrow?', a: 'You lose one of your three lives. Lose all three and the level restarts. Hints highlight an arrow that is safe to launch, and undo takes back a move.' },
      { q: 'Is my progress saved?', a: 'Yes. Your levels, stars and achievements are saved automatically in your browser, so you can pick up where you left off.' },
    ],
  },

  merge: {
    config: merge,
    metaTitle: 'Merge Rush — Free Number Merge Puzzle Game Online',
    metaDescription:
      'Play Merge Rush free online: slide tiles and merge three of a kind to build powers of 3. A strategic number puzzle with an endless high-score mode. No download.',
    tagline: 'Slide, line up three of a kind, and build ever-bigger powers of 3.',
    genres: ['Number puzzle', 'Merge game'],
    intro: [
      'Merge Rush is a free online number puzzle with a twist: instead of merging pairs, you merge three equal tiles. Slide the whole board in one direction and every tile moves as far as it can. Line up three 3s and they become a 9; three 9s become a 27, and so on.',
      'Each of the first five levels has a goal tile to reach, up to 2187. From level 6 there is no goal: it becomes an endless mode where you play for a high score. Hints suggest a good direction and undo takes back a move.',
    ],
    tips: [
      'Keep your biggest tiles together in one corner so they don’t get scattered.',
      'Think in threes: before sliding, check where the third matching tile will end up.',
      'Leave yourself open space. A full board with no merges costs a life.',
      'Use undo on a move that suddenly jams the board instead of losing a life.',
    ],
    faq: [
      { q: 'How is Merge Rush different from other merge games?', a: 'You merge three matching tiles instead of two, so tiles grow in powers of 3 (3, 9, 27, 81…). That makes you plan further ahead.' },
      { q: 'What happens when the board fills up?', a: 'If there are no moves left you lose a life and the three smallest tiles are cleared so you can keep going. Lose all three lives and the level restarts.' },
      { q: 'Is there an endless mode?', a: 'Yes. From level 6, and in the daily challenge, there is no target tile and you play for the highest score you can reach.' },
      { q: 'How do hints and undo work in Merge Rush?', a: 'You get 3 hints and 5 undos per level. A hint shows a good direction to slide. Undo takes back your last move, and gives back the life if that move cost one.' },
    ],
  },

  god: {
    config: god,
    metaTitle: 'Find God — Free Logic Grid Puzzle Game Online',
    metaDescription:
      'Play Find God free online: one god per row, column and coloured realm, and no two gods touch. A pure-logic grid puzzle, solvable without guessing.',
    tagline: 'One god per row, column and realm. Use pure logic to find the one you need.',
    genres: ['Logic puzzle', 'Grid puzzle'],
    intro: [
      'Find God is a free online logic grid puzzle. The board is divided into coloured realms, and exactly one god hides in every row, every column and every realm. Gods hate each other, so no two of them ever touch, not even diagonally.',
      'A villager needs one particular god. Use the rules to discard cells where no god can be, then search the cell where the god must be. Every board can be solved by deduction alone, so you never need to guess. Boards grow from small grids up to 9×9 realms.',
    ],
    tips: [
      'Start with the smallest realm: with only a few cells, it limits where its god can be.',
      'When a god is placed, discard its whole row, column, realm and the eight cells around it.',
      'If a realm’s remaining cells all sit in one row, no other realm can use that row.',
      'Stuck? A hint shows the next deduction and explains why it works.',
    ],
    faq: [
      { q: 'Do I ever have to guess in Find God?', a: 'No. Every board is built so it can be solved with logic alone. If you feel stuck, a hint explains the next logical step.' },
      { q: 'What are the rules?', a: 'There is exactly one god in every row, every column and every coloured realm, and no two gods touch, even diagonally.' },
      { q: 'What happens if I search the wrong cell?', a: 'A wrong search costs one of your three lives. Discarding cells (marking them ✕) is free, so mark everything you can rule out first.' },
      { q: 'How big do the boards get?', a: 'Boards start small and grow as you progress: you reach the 7×7 realms after level 5 and the 9×9 realms from level 15. The daily challenge is an 8×8 board.' },
    ],
  },

  box: {
    config: box,
    metaTitle: 'Box Escape — Free Box Pushing Puzzle Game Online',
    metaDescription:
      'Play Box Escape free online: push every crate onto a target in this warehouse puzzle. Crates can’t be pulled, so plan every push. Hints, undo and par scores.',
    tagline: 'Push every crate onto its target. You can push, but you can never pull.',
    genres: ['Box pushing puzzle', 'Warehouse puzzle'],
    intro: [
      'Box Escape is a free online box-pushing puzzle. You are a warehouse worker who has to push every crate onto a target. You can only push one crate at a time and you can never pull, so a crate shoved into a corner is stuck for good.',
      'Each level has a par: the fewest pushes it can be solved in. Match it for a perfect score. Levels grow from small rooms to bigger warehouses with several crates, with hints that show the next push on a shortest solution.',
    ],
    tips: [
      'Never push a crate into a corner unless that corner is a target.',
      'A crate against a wall can only move along that wall. Check there’s a target on it first.',
      'Plan where you need to stand before each push, not just where the crate goes.',
      'Undo is generous. Use it as soon as a crate looks trapped.',
    ],
    faq: [
      { q: 'Can I pull a crate in Box Escape?', a: 'No. You can only push, and only one crate at a time. That is what makes each level a puzzle.' },
      { q: 'What does “par” mean?', a: 'Par is the fewest pushes the level can be solved in. Finishing at par earns the best score.' },
      { q: 'What happens if a crate gets stuck?', a: 'A push that would obviously trap a crate is blocked and costs a life. For subtler dead ends, use undo or restart the level.' },
      { q: 'How do I play on a phone?', a: 'Swipe or use the on-screen pad to move. You can also tap a floor tile to walk there, or tap a crate next to you to push it.' },
    ],
  },

  traffic: {
    config: traffic,
    metaTitle: 'Traffic Escape — Free Sliding Block Car Puzzle',
    metaDescription:
      'Play Traffic Escape free online: slide cars and trucks to clear a path for the red car out of the parking lot. A sliding block puzzle with par scores and hints.',
    tagline: 'Slide the cars and trucks aside and get the red car out of the lot.',
    genres: ['Sliding block puzzle', 'Car parking puzzle'],
    intro: [
      'Traffic Escape is a free online sliding block puzzle. The parking lot is jammed with cars and trucks, and your job is to get the red car out through the exit. Every vehicle can only slide forwards and backwards in its own lane, never sideways.',
      'Sliding one car any distance counts as one move, and every level has a par: the fewest moves it can be solved in. Finish close to par for three stars. Later levels pack the lot with long trucks and deep chains of blockers.',
    ],
    tips: [
      'Look at what blocks the red car, then at what blocks those cars. Solve the chain from the end.',
      'Trucks are the real obstacles. Work out where each long vehicle needs to go first.',
      'Sometimes a car has to move away from the exit to free space. Don’t be afraid to back up.',
      'Hints show the next move on a shortest solution if you get stuck.',
    ],
    faq: [
      { q: 'How do I move the cars?', a: 'Drag a car to slide it along its lane. On a keyboard, press Tab to pick a car and use the arrow keys to slide it one square at a time.' },
      { q: 'What counts as a move?', a: 'Sliding one car any distance is one move. Par is the fewest moves needed to solve the level.' },
      { q: 'Can I lose a level?', a: 'Every few moves past par cost a life, shown in the line above the lot. Run out of lives and the level restarts.' },
      { q: 'Does undo give my moves back?', a: 'No. Undo puts the car back where it was, but the move still counts towards your total. Think before you slide, and use a hint if you are unsure.' },
    ],
  },

  memory: {
    config: memory,
    metaTitle: 'Memory Sequence — Free Online Memory Game',
    metaDescription:
      'Play Memory Sequence free online: watch the pads light up and play notes, then repeat the sequence. Each round adds a step. A fun brain-training memory game.',
    tagline: 'Watch, listen, repeat. Every round adds one more step.',
    genres: ['Memory game', 'Brain training'],
    intro: [
      'Memory Sequence is a free online memory game. Coloured pads light up and play a note, one after another. Repeat the sequence by tapping the pads in the same order. Get it right and the next round adds one more step.',
      'Reach the target sequence length to clear the level. As you progress you get more pads, longer sequences and faster playback, and from level 12 the pads even swap places every round. By level 20 you are remembering a 24-step sequence.',
    ],
    tips: [
      'Say the pad numbers in your head (or out loud) as they play. Words are easier to remember than colours.',
      'Group the sequence into chunks of three or four, like a phone number.',
      'Listen to the notes as well as watching: the melody is a second memory cue.',
      'On a keyboard, the pads are numbered 1–9 in reading order, which makes fast sequences easier.',
    ],
    faq: [
      { q: 'Is Memory Sequence good for brain training?', a: 'It is a classic working-memory exercise: each round asks you to hold a slightly longer sequence in mind. It is a game, not a medical tool, but it is great practice.' },
      { q: 'Can I play without sound?', a: 'Yes. The pads light up as well as play notes, and you can turn sound off in Settings.' },
      { q: 'What happens if I make a mistake?', a: 'You lose one of three lives and the sequence plays again. Undo can take back a mistake and restore the life.' },
      { q: 'Can I use the keyboard?', a: 'Yes. Press 1–9 to tap the pads, which are numbered in reading order.' },
    ],
  },

  connect: {
    config: connect,
    metaTitle: 'Color Connect — Free Connect the Dots Puzzle Online',
    metaDescription:
      'Play Color Connect free online: join each pair of matching dots with a pipe. Pipes can’t cross and every square must be filled. Relaxing levels up to 9×9.',
    tagline: 'Join every matching pair, fill every square, and never cross the pipes.',
    genres: ['Connect the dots puzzle', 'Path puzzle'],
    intro: [
      'Color Connect is a free online connect-the-dots puzzle. Draw a pipe between each pair of dots with the same colour and number. Pipes can’t cross or overlap, and the level is only cleared when every pair is joined and every square on the grid is filled.',
      'Perfect play is one stroke per colour. Grids grow from small warm-ups to 9×9 boards where the pipes have to wind around each other. Hints draw one pipe for you when you get stuck.',
    ],
    tips: [
      'Connect pairs that sit along the edge first. Their paths are usually forced.',
      'Short pairs close together are rarely the problem. Route the long ones early.',
      'If a corner square can only be reached by one colour, that pipe must go there.',
      'Leftover empty squares mean a pipe should take a longer route. Reroute instead of starting over.',
    ],
    faq: [
      { q: 'Do I have to fill every square?', a: 'Yes. The level is cleared only when every pair is connected and every square is covered by a pipe.' },
      { q: 'What happens if I draw over another pipe?', a: 'It cuts that pipe. Back up and the cut pipe is restored.' },
      { q: 'How do I play with a keyboard?', a: 'Arrow keys move the cursor. Press Space on a dot or pipe to pick up its colour, use the arrows to draw, and press Space again to put it down.' },
      { q: 'How many moves should a level take?', a: 'Picking up a different colour counts as one move, so perfect play is one move per colour. Every few moves past that cost a life, and undo doesn’t refund moves.' },
    ],
  },

  pipe: {
    config: pipe,
    metaTitle: 'Pipe Connect — Free Pipe Rotation Puzzle Game',
    metaDescription:
      'Play Pipe Connect free online: turn the pipes so water flows from the tap to every drain before the clock runs out. A timed plumbing puzzle.',
    tagline: 'Turn the pipes and get the water flowing to every drain before time runs out.',
    genres: ['Pipe puzzle', 'Plumbing puzzle'],
    intro: [
      'Pipe Connect is a free online plumbing puzzle. Water comes out of a brass tap, and you need to turn the pipe pieces so it reaches every drain. Pipes that carry water turn blue, so you can see the flow spread as you work.',
      'The clock starts on your first turn. Bolted pieces can’t be rotated, so you have to plan around them, and not every pipe has to carry water. Grids grow from small boards to 8×8 networks with more than one drain.',
    ],
    tips: [
      'Start from the tap and each drain, then work towards the middle.',
      'Bolted pieces are fixed clues. Build your route around them.',
      'Corner and edge pieces can only face a few ways. Set those first.',
      'Right-click (or Shift+Space) turns a pipe anticlockwise and saves extra clicks.',
    ],
    faq: [
      { q: 'How do I turn a pipe?', a: 'Tap or click a pipe to turn it clockwise. Right-click, or press Shift+Space, to turn it anticlockwise.' },
      { q: 'What happens when the timer runs out?', a: 'You lose a life and the clock refills halfway, so you can keep going. Fewer lives lost means more stars.' },
      { q: 'Does every pipe need water?', a: 'No. Some pieces are decoys. You only need water to reach every drain.' },
      { q: 'What are the bolted pieces?', a: 'Dark, bolted squares are fixed and can’t be turned, so plan your route around them. When you use a hint, it turns one pipe the right way and bolts it in place.' },
    ],
  },

  code: {
    config: code,
    metaTitle: 'Code Breaker — Free Colour Code Logic Game Online',
    metaDescription:
      'Play Code Breaker free online: crack the hidden colour code using clues about right and wrong positions. A classic deduction game with up to 8 colours.',
    tagline: 'Crack the hidden colour code with clues, deduction and as few guesses as possible.',
    genres: ['Code-breaking game', 'Deduction game'],
    intro: [
      'Code Breaker is a free online deduction game. A secret row of coloured pegs is hidden at the top of the board. Make a guess and you get a clue: a filled dot for each peg that is the right colour in the right spot, and a ring for each right colour in the wrong spot.',
      'The clues never say which pegs they mean, so you have to reason it out. A live counter shows how many codes still fit every clue. From level 10 colours can repeat, and later levels use up to 8 colours.',
    ],
    tips: [
      'Make every guess consistent with all the clues so far. Guesses that can’t be the code waste attempts.',
      'Watch the “possible codes” counter. A good guess cuts it sharply.',
      'Early on, use several different colours in one guess to find out which colours are in the code.',
      'From level 10 colours can repeat, so don’t rule out a colour just because it’s already placed.',
    ],
    faq: [
      { q: 'How do the clues work?', a: 'A filled dot means one peg is the right colour in the right spot. A ring means one peg is the right colour in the wrong spot. The clue doesn’t say which pegs.' },
      { q: 'What happens if I run out of attempts?', a: 'You lose a life and get three more attempts. Fewer lost lives means more stars.' },
      { q: 'Can colours repeat in the code?', a: 'From level 10 onwards, yes. A colour can appear more than once in the secret code.' },
      { q: 'What does “possible codes” mean?', a: 'It counts how many secret codes still fit every clue you have seen so far. A good guess cuts that number sharply. A guess that an earlier clue already ruled out is marked red.' },
    ],
  },
}

// Shared selling points shown on every landing page.
export const commonFeatures = [
  { icon: '🆓', title: 'Free, no sign-up', body: 'Play instantly in your browser. No download, no account, no ads.' },
  { icon: '📱', title: 'Phone & desktop', body: 'Touch, mouse and keyboard controls. Install it as an app and play offline.' },
  { icon: '📅', title: 'Daily challenge', body: 'Three games, one level each, picked fresh every day for everyone. Keep your streak alive.' },
  { icon: '💾', title: 'Progress saved', body: 'Levels, stars and achievements are saved automatically on your device.' },
]
