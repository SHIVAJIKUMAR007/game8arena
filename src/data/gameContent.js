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
import { config as sudoku } from '../games/sudoku/config'
import { config as word } from '../games/wordGuess/config'
import { config as minesweeper } from '../games/minesweeper/config'
import { config as solitaire } from '../games/solitaire/config'
import { config as blocky } from '../games/blockyBlitz/config'
import { config as bubbles } from '../games/bubbleSurge/config'
import { config as family } from '../games/familySort/config'
import { config as hideseek } from '../games/hideSeek/config'
import { config as undercover } from '../games/undercover/config'
import { config as tictactoe } from '../games/ticTacToe/config'
import { config as tambola } from '../games/tambola/config'
import { config as bingo } from '../games/bingoRoyale/config'
import { config as stickman } from '../games/stickmanFight/config'
import { config as multiverse } from '../games/multiverseFighter/config'

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

  sudoku: {
    config: sudoku,
    metaTitle: 'Sudoku — Free Online Sudoku Puzzle Game with Levels',
    metaDescription:
      'Play Sudoku free online: fill the 9×9 grid so every row, column and 3×3 box holds 1 to 9. Every puzzle has one solution, with hints, undo and a daily challenge.',
    tagline: 'Fill the grid so every row, column and 3×3 box holds 1 to 9 exactly once.',
    genres: ['Sudoku', 'Number puzzle', 'Logic puzzle'],
    intro: [
      'Sudoku is the classic number-placement puzzle. The 9×9 grid is split into nine 3×3 boxes. Fill every empty cell with a digit from 1 to 9 so that each row, each column and each box contains every digit exactly once.',
      'Every puzzle here is generated to have exactly one solution, so you never have to guess. Early levels give you plenty of starting digits; later levels give you fewer, so you need more logic. A wrong digit costs a life.',
    ],
    tips: [
      'Select a cell and look at its row, column and box: the digits already there are ruled out.',
      'Tap a placed digit to highlight every matching number on the board and spot where it can still go.',
      'Look for a digit that fits in only one cell of a row, column or box.',
      'Use the number pad: a key dims once all nine copies of that digit are on the board.',
    ],
    faq: [
      { q: 'What are the rules of Sudoku?', a: 'Put the digits 1 to 9 in every row, every column and every 3×3 box, each exactly once. The digits already shown cannot be changed.' },
      { q: 'Does every puzzle have a single solution?', a: 'Yes. Each puzzle is checked so that only one grid fits, which means you can always find the next digit by logic, without guessing.' },
      { q: 'What happens if I place a wrong digit?', a: 'The digit is rejected and you lose a life. Lose all three and the level restarts. Hints fill in the easiest cell, and undo removes your last digit.' },
      { q: 'How does the difficulty change?', a: 'Each level starts with fewer given digits than the one before, so the puzzles need more logic as you go.' },
    ],
  },

  word: {
    config: word,
    metaTitle: 'Word Guess — Free Five-Letter Word Game Online',
    metaDescription:
      'Play Word Guess free online: find the hidden five-letter word in six tries with green, yellow and grey clues. Unlimited levels, a daily word and hard mode.',
    tagline: 'Six tries to find the hidden five-letter word, with a new word on every level.',
    genres: ['Word game', 'Word puzzle', 'Vocabulary game'],
    intro: [
      'Word Guess is a free online word puzzle. You get six tries to find a hidden five-letter English word. After each guess, every letter changes colour: green means it’s in the right spot, yellow means it’s in the word but somewhere else, and grey means it isn’t in the word.',
      'You can play as many words as you like. Level 1 uses everyday words, and the words get harder as you go: rarer letters, repeated letters, and words with lots of near look-alikes. Every answer is a real word that can be found in six guesses. There’s also a daily word, the same for everyone.',
    ],
    tips: [
      'Start with a word full of common letters such as E, A, R, T, O and S.',
      'Grey letters aren’t in the word, so leave them out of later guesses.',
      'Letters can repeat. If nothing seems to fit, try a double letter.',
      'Word families like -IGHT or -ATCH can eat up guesses. In normal mode, spend one guess on a word that tests several possible first letters at once.',
    ],
    faq: [
      { q: 'What do the colours mean?', a: 'Green: the letter is in the word and in the right spot. Yellow: the letter is in the word but in another spot. Grey: the letter is not in the word, or you used it more times than it appears.' },
      { q: 'How do repeated letters work?', a: 'Each letter in the hidden word can only light up one tile. If the word has one E and you guess two, only one E is coloured; the other is grey.' },
      { q: 'What is hard mode?', a: 'In hard mode every green and yellow letter you have found must be used in your next guesses. Greens stay in their spot; yellows must appear somewhere. Turn it on from the menu before you start a word.' },
      { q: 'Can I play more than one word a day?', a: 'Yes. There’s no limit on levels, and words don’t repeat until you’ve used up every word at your difficulty. The daily word is separate and the same for everyone.' },
      { q: 'Is my progress saved?', a: 'Yes. Your level, statistics, streak and any word you are halfway through are saved in your browser, so you can close the tab and come back later.' },
    ],
  },

  minesweeper: {
    config: minesweeper,
    metaTitle: 'Minesweeper: Free Online Game with Levels and Daily Board',
    metaDescription:
      'Play Minesweeper free online. Use the numbers to find the mines and open every safe square. Levels, classic boards, a daily board and best times.',
    tagline: 'Open every safe square and use the numbers to work out where the mines are.',
    genres: ['Minesweeper', 'Logic puzzle', 'Puzzle game'],
    intro: [
      'Minesweeper is played on a grid of closed squares, and some of them hide mines. Click a square to open it. If it holds a mine, the round is over. If it is safe, it shows a number: how many of the eight squares around it have a mine. You use those numbers to decide which closed squares are safe and which are mines, and you win when every safe square is open.',
      'Levels start on a 6×6 grid with four mines and grow slowly, up to a 16×20 board with 61 mines at level 60. Each board is checked by a solver before you play it, so you can always finish it by reasoning from the numbers. Your first click is always safe. You can also play the classic Beginner, Intermediate and Expert boards, and there is a daily board that is the same for everyone.',
    ],
    tips: [
      'Open the glowing square first, or any square you like. The first click and the squares around it never hold a mine.',
      'A 1 with exactly one closed square next to it means that square is a mine. Flag it.',
      'When a number already has as many flags around it as it shows, every other closed square next to it is safe. Click the number to open them all at once.',
      'Compare neighbouring numbers. If a 1 touches squares A and B, and a 2 touches A, B and C, then C is a mine.',
      'Check your flags before you open squares next to them. A wrong flag makes the click on a number open a mine.',
    ],
    faq: [
      { q: 'Is the first click always safe?', a: 'Yes. The square you open first and the squares around it never hold a mine, so your first click always opens a patch of the board. The board is built when you make that click.' },
      { q: 'Do I ever have to guess?', a: 'Not on levels or the daily board. A solver that uses only the numbers you can see has to finish each of them before it is offered to you. The classic boards are checked the same way where it is possible. Expert is the hardest to find a guess-free layout for, and a board that could not be verified is marked “May need a guess”.' },
      { q: 'How do I place a flag?', a: 'On a computer, right-click a closed square. On a phone or tablet, press and hold it, or switch to flag mode with the button under the board and tap. Do the same again to remove the flag.' },
      { q: 'What does clicking a number do?', a: 'If you have flagged as many squares around it as the number shows, clicking it opens all the other closed squares around it. This is called chording and it saves a lot of clicks.' },
      { q: 'How does the difficulty grow?', a: 'Boards get a little bigger and a little denser with each level, and the mine density never goes above 20%. From level 7 some moves need you to compare two numbers. From level 30 a few need a longer chain of reasoning. After level 60 you keep getting new boards at that same difficulty.' },
      { q: 'How are stars and the score worked out?', a: 'A cleared level gives one star, a second if you used no hints, and a third if you finished within the par time shown on the result screen. Your score also goes up with the difficulty of the board and how fast you finish.' },
      { q: 'What do the hints do?', a: 'You get three hints per board. A hint points at one square you can be sure about, safe or a mine, and tells you which kind of reasoning finds it. It only uses the numbers on the board.' },
      { q: 'Is my progress saved?', a: 'Yes. Your level, statistics, best times and the board you are halfway through are saved in your browser, so you can close the tab and come back to the same position and time.' },
    ],
  },
  solitaire: {
    config: solitaire,
    metaTitle: 'Solitaire: Free Klondike Card Game with Levels',
    metaDescription:
      'Play Klondike Solitaire free online. Draw one or draw three, unlimited undo, hints and levels that grow harder slowly. Every deal can be won.',
    tagline: 'Build all four foundations from Ace to King, one suit at a time.',
    genres: ['Card game', 'Solitaire', 'Patience'],
    intro: [
      'Klondike is the solitaire most people know. Seven columns of cards are dealt with only the top card of each face up, and the rest of the deck sits in the stock. Your goal is to move all 52 cards up to four foundation piles, one per suit, starting with the Ace and ending with the King. In the columns you build down in alternating colours, so a red 9 goes on a black 10, and every card you move off a face-down card turns it over.',
      'Each deal is checked by a solver before you get it, so every game can be won. Level 1 is a gentle deal with plenty of moves. Later levels bury low cards deeper, give you fewer moves at the start and need longer plans, and after level 50 you keep getting new deals at that same top difficulty. Pick draw one for a relaxed game or draw three for the classic challenge.',
    ],
    tips: [
      'Turning over face-down cards matters more than anything else. When you have a choice, move cards off the column with the most face-down cards.',
      'Do not rush cards up to the foundations. A low black card may still be needed to hold a red card in a column.',
      'Keep an empty column for a King that is sitting on top of face-down cards. Moving a King into an empty column for nothing wastes the space.',
      'In draw three, the order of the stock shifts each time you play a card from it. If you are stuck, playing one waste card can bring new cards to the top on the next pass.',
      'Undo is free. If a line of play leads nowhere, go back and try the other column.',
    ],
    faq: [
      { q: 'Can every deal be won?', a: 'Yes. Before a deal is offered, a solver plays it with every card known and has to find a win. Deals it cannot win are thrown away, so you are never given a hopeless game. You can still get stuck by making the wrong moves, and then undo helps.' },
      { q: 'What is the difference between draw one and draw three?', a: 'In draw one you turn one card from the stock at a time, and you can reach every card. In draw three you turn three and can only play the top one, so many cards stay out of reach until the order shifts. Draw three is harder, and its levels are rated on their own scale.' },
      { q: 'How do I move cards?', a: 'Drag them with the mouse or your finger. Or tap a card to pick it up and tap where it should go. Tap a picked-up card again, or double-click it, to send it to the best place, usually a foundation. On a keyboard, Tab moves between cards and Enter picks up and puts down.' },
      { q: 'How does the difficulty grow?', a: 'Each deal is rated from how deeply the low cards are buried under face-down cards, how many moves you have at the start, and how much searching the solver needed to win. Level 1 starts easy, each level aims a little higher, and the rating never goes above the cap for your draw mode.' },
      { q: 'How is the score worked out?', a: 'You get 10 points for each card on a foundation, 5 for moving a waste card to a column and 5 for each card you turn over. Moving a card back down from a foundation costs 15, and turning the waste back over costs 100 in draw one and 20 in draw three. A fast win adds a time bonus.' },
      { q: 'How do stars work?', a: 'A win gives one star, a second if you used no hints and a third if you finished within the par time shown on the result screen. Undo does not cost a star.' },
      { q: 'Is my game saved?', a: 'Yes. Your level, statistics, personal bests and the game you are in the middle of are saved in your browser, so you can close the tab and continue the same deal later.' },
    ],
  },
  blocky: {
    config: blocky,
    metaTitle: 'Blocky Blitz: Free Online Block Puzzle Game',
    metaDescription:
      'Play Blocky Blitz free online. Drag blocks onto an 8x8 grid, fill rows and columns to clear them, chain combos and use the hold slot. No download, no sign-up.',
    tagline: 'Drag blocks onto the grid, fill a row or column and watch it clear.',
    genres: ['Block puzzle', 'Casual puzzle', 'Endless game'],
    intro: [
      'Blocky Blitz is a free block puzzle for your browser. You get three pieces at a time and drag each one onto an 8×8 grid. Pieces never rotate, so you have to look at the shape you are given and find the gap where it fits. Fill a whole row or column and it clears, which frees up space for the next pieces.',
      'There is no timer and no end except running out of room. Clear several lines in one move, or clear lines on back-to-back moves, for a combo bonus. Reach the score target to move up a level and earn another re-roll. Save one piece in the hold slot when it does not fit yet, and drag it out when it does.',
    ],
    tips: [
      'Keep the middle of the board open. Pieces that lean on a wall fit more often than pieces dropped in the centre.',
      'Look at all three pieces before you place any. The right order is often the one that leaves the biggest gap for the largest piece.',
      'Clear on every move you can. A streak of clears multiplies the bonus, and a gap you leave open usually gets filled by a later piece.',
      'Use the hold slot for a big piece you cannot place yet, such as a 3×3 square. Drop another piece on it to swap.',
      'Save re-rolls for a board that is nearly full. Each new set still has at least one piece that fits.',
    ],
    faq: [
      { q: 'Can I rotate the pieces?', a: 'No. Every piece keeps the orientation it is dealt in, and the game has a separate piece for each orientation of every shape. That is what makes choosing where to place them the puzzle.' },
      { q: 'How is the score worked out?', a: 'You get 1 point for every block you place. Clearing lines adds 10 × lines², so one line is 10, two lines are 40 and three are 90. Clearing on back-to-back moves multiplies that bonus by 1 + 0.5 for each move already in the streak. Emptying the whole board adds 200.' },
      { q: 'What does the hold slot do?', a: 'The rounded square next to the board stores one piece. Drag a piece from the tray into it to save it, and drag the stored piece onto the board when you want it. If the slot is full, dropping another piece on it swaps the two. Placing the held piece does not deal new pieces.' },
      { q: 'What does the swap button do?', a: 'It replaces the pieces still waiting in the tray with a new set and uses one re-roll. You start with 2 and earn one more each time you level up.' },
      { q: 'When does the game end?', a: 'When none of the pieces in the tray, and none in the hold slot, fits anywhere on the board. The game checks after every move.' },
      { q: 'Is every set of pieces playable?', a: 'Every new set of three includes at least one piece that fits on the current board. Later pieces can still run out of room if the board fills up, which is how a game ends.' },
      { q: 'How do I play with a keyboard?', a: 'Tab to a piece and press Enter to pick it up. The arrow keys move it over the board, Enter places it, H sends it to the hold slot and Escape puts it back.' },
      { q: 'Is my game saved?', a: 'Yes. The board, your pieces, the hold slot, score and level are saved in your browser after every move, so you can close the tab and carry on. Your best score is saved too and you can reset it in the settings.' },
    ],
  },
  bubbles: {
    config: bubbles,
    metaTitle: 'Bubble Surge: Free Online Bubble Shooter Game',
    metaDescription:
      'Play Bubble Surge free online. Aim a shooter in the middle of a huge bubble field, match three or more to pop them and clear each level before it creeps in.',
    tagline: 'Pop your way out from the middle of a huge bubble field.',
    genres: ['Bubble shooter', 'Casual puzzle', 'Arcade'],
    intro: [
      'Bubble Surge turns the usual bubble shooter inside out. The bubbles fill the whole screen and the shooter sits in the middle, inside a hole in the field. It turns all the way round, so you can fire in any direction. Aim with the mouse or a finger and the dotted guide shows where the bubble will go, including up to two bounces off the walls.',
      'A bubble sticks to the first bubble it touches. Join three or more of the same colour and they pop, and any bubbles left with no link to the edge of the field drop for bonus points. Clear enough of the field to finish the level. Miss too many times in a row and a new layer creeps in around the hole. If a bubble touches the ring around your shooter, the game is over.',
    ],
    tips: [
      'Aim at the edge of a clump of your colour. A bubble that lands beside two others of its colour pops all three.',
      'Look for bubbles that hold a big group to the edge. Pop the link and the whole group drops, which scores 20 points for each bubble.',
      'Use the bounce guide to reach spots you cannot hit in a straight line, such as a pocket behind a ridge.',
      'Swap bubbles with Space or by clicking the ring. Keep a colour you will need later, and use the other one now.',
      'Watch the arc on the ring. When it is nearly full, make a shot that pops, because a pop resets it.',
      'Pop on five shots to fill the meter. The next bubble becomes a bomb that clears everything within three cells.',
    ],
    faq: [
      { q: 'How do I aim and fire?', a: 'Move the mouse around the screen, or drag a finger. The shooter turns toward the pointer. Click or lift your finger to fire. With a keyboard, the left and right arrow keys turn the shooter and Enter fires.' },
      { q: 'How do I swap the bubble in the shooter?', a: 'Click the ring in the middle, tap the preview bubble in the bar at the bottom, or press Space. The current bubble and the next one trade places.' },
      { q: 'What makes bubbles drop?', a: 'After a pop, any bubble that is no longer linked to the edge of the field, either directly or through other bubbles, falls. The top, bottom, left and right edges all count as anchors.' },
      { q: 'What do the bomb and rainbow bubbles do?', a: 'Pop on five shots to fill the five-circle meter and the bubble in the shooter turns into a bomb. It pops everything within three cells of where it lands. A rainbow bubble turns up now and then and matches whatever colour it lands next to.' },
      { q: 'What is the arc around the ring?', a: 'It shows how close the field is to creeping in. Every few shots without a pop, a new layer of bubbles grows around the hole. A pop clears the warning. If a bubble reaches the ring, the game is over.' },
      { q: 'How do levels and stars work?', a: 'Each level asks you to clear a share of the field, and the share grows slowly. Later levels add yellow and purple, start with a smaller hole and creep in sooner. You earn up to three stars for finishing in few shots.' },
      { q: 'Can the game get stuck with a colour I do not have?', a: 'No. The bubbles you are dealt always use colours that are still on the field, so you can always make a match.' },
      { q: 'Is my progress saved?', a: 'Yes. Your level, score, stars and best score are saved in your browser, so you can close the tab and come back to the same level.' },
    ],
  },
  family: {
    config: family,
    metaTitle: 'Family Sort: Free Online Water Sort Puzzle',
    metaDescription:
      'Play Family Sort free online. Pour coloured liquids between glass bottles until each holds one colour. Every level is solvable. Earn coins and unlock new looks.',
    tagline: 'Pour, sort and fill every bottle with one colour.',
    genres: ['Water sort puzzle', 'Casual puzzle', 'Relaxing game'],
    intro: [
      'Family Sort is a free liquid sorting puzzle for your browser. Each glass bottle holds up to four layers of coloured liquid, and your job is to pour them around until every bottle is either empty or full of one colour. Tap a bottle to lift it, then tap the bottle you want to pour into.',
      'You can pour onto the same colour or into an empty bottle, and only the matching layers on top of the bottle move. Colours never mix. The first levels use two colours and a couple of empty bottles, and the puzzles grow slowly from there, with more colours, more bottles and more tangled layers. Every level is built so that it can be solved.',
    ],
    tips: [
      'Look at the tops of all the bottles before your first pour. The colour you can collect most easily is usually the best one to start with.',
      'Empty bottles are your workspace. Use one to move a layer out of the way, then fill it with that colour later.',
      'Try not to bury a colour you need under another one. A layer that is already on the right colour is worth leaving alone.',
      'Undo is free. If a plan goes wrong, take back a few moves and try another order.',
      'Save hints and extra bottles for the hard levels. A level cleared without hints pays a coin bonus.',
    ],
    faq: [
      { q: 'What are the rules for pouring?', a: 'You can pour from one bottle into another when the target bottle is empty or has the same colour on top, and has room. Only the top group of one colour moves, as much of it as fits. You cannot pour into the bottle you picked up.' },
      { q: 'Is every level solvable?', a: 'Yes. Each level is made by taking a sorted set of bottles and running legal pours backwards, so there is always a way to sort it again. The game also checks every level with its own solver.' },
      { q: 'What does a hint do?', a: 'A hint costs 30 coins. It works out a solution from the position on the table and glows the bottle to pour from and the bottle to pour into. If no solution is left, it tells you so, and costs nothing.' },
      { q: 'What does the extra bottle do?', a: 'It adds one empty bottle to the level for 100 coins, up to two per level. It is the way out when you have run out of moves.' },
      { q: 'How do I earn coins?', a: 'Every level you clear for the first time pays coins, and a level cleared without hints pays a bonus. Spend coins on hints and extra bottles, or on new bottle styles and backgrounds in the settings.' },
      { q: 'Can I play without telling colours apart by sight?', a: 'Yes. Turn on colour symbols in the settings and every layer shows a small shape. Each bottle is also read out in full by screen readers.' },
      { q: 'How do I play with a keyboard?', a: 'Use the left and right arrow keys to move between bottles, Enter or Space to pick one up and to pour, and Escape to put it down. U undoes, H gives a hint and R restarts the level.' },
      { q: 'Is my progress saved?', a: 'Yes. Your level, coins, unlocked styles and the level you are in the middle of are saved in your browser, so you can close the tab and carry on.' },
    ],
  },
  hideseek: {
    config: hideseek,
    metaTitle: 'Mafia Hunt: Multiplayer Hide and Seek Game',
    metaDescription:
      'Play Mafia Hunt with friends on the same Wi-Fi. One player is the mafia with a gun, everyone else hides and survives until the timer runs out.',
    tagline: 'One mafia with a gun. Everyone else hides.',
    genres: ['Multiplayer', 'Hide and seek', 'Party game'],
    intro: [
      'Mafia Hunt is a multiplayer hide and seek game for friends in the same room. One computer on your Wi-Fi hosts the game, and everyone else opens its address on a phone or laptop, joins with a four letter room code and plays together. There is no account and nothing to install on the other devices.',
      'When the round starts, one random player becomes the mafia and gets a gun. Everyone else is a villager and has 15 seconds to hide on one of five maps, from crates and houses to a maze and a forest. You can only see a short way around you, and walls block your view and the bullets. The mafia wins by shooting every villager before the timer runs out. If anyone is still alive at the end, the villagers win. The host chooses the map and how long a round lasts, from one to five minutes.',
    ],
    tips: [
      'As a villager, break the mafia’s line of sight. Keep a wall between you and them, and move when they look the other way.',
      'The maps are big. Use the small map in the corner to see where the walls are before you pick a hiding place.',
      'Listen for the shot. A shot lights up the line it travelled, which shows the mafia where you are not, and shows you where they are.',
      'As the mafia, check the corners of houses and sweep the edges of the map. Villagers like to hide in the corners.',
      'The gun needs a moment to reload. Do not fire at a gap, wait until you can see someone.',
    ],
    faq: [
      { q: 'How do I host a game?', a: 'Open Mafia Hunt, enter your name and choose Create a room. Your browser becomes the host, so keep that page open. Share the 4-letter code and friends join from their own browsers. Nothing to install.' },
      { q: 'How do my friends join?', a: 'They open the Wi-Fi address on their own phone or laptop, choose Mafia Hunt and type the four letter room code. They must be on the same Wi-Fi as the host.' },
      { q: 'How many people can play?', a: 'From two to nine players. One is the mafia and the rest are villagers.' },
      { q: 'Who is the mafia?', a: 'The game picks one player at random when the host starts it. Everyone is told who the mafia is, so the game is about hiding, not guessing.' },
      { q: 'Why is the screen dark?', a: 'Each player can only see a circle around them. The server only sends you the players you can see, so nobody can look through walls.' },
      { q: 'How do I control it?', a: 'Move with WASD or the arrow keys, aim with the mouse, and click or press Space to shoot. On a phone use the on-screen stick to move and tap where you want to shoot.' },
      { q: 'What maps are there?', a: 'Five: Crates, Town, Maze, Plaza and Forest. The host picks one in the lobby, or leaves it on Random and the game picks for you.' },
      { q: 'How long does a round last?', a: 'The host chooses one, two, three or five minutes in the lobby. The mafia is held back for the first 15 seconds so the villagers can hide.' },
      { q: 'Why did my room close?', a: 'The host closed their page or lost their connection, so the room ended. Start a new room and share the new code. The host must keep the game page open while everyone plays.' },
    ],
  },
  undercover: {
    config: undercover,
    metaTitle: 'Undercover: Multiplayer Word Party Game',
    metaDescription:
      'Play Undercover with friends on the same Wi-Fi. Give clues about a secret word, spot who has a different one, and vote out the Undercover and Mr. White.',
    tagline: 'Everyone has a word. Someone has a different one.',
    genres: ['Multiplayer', 'Word game', 'Party game'],
    intro: [
      'Undercover is a word deduction party game for three or more players on the same Wi-Fi. One computer hosts the game, and everyone else opens its address on a phone or laptop and joins with a four letter room code. Each player secretly gets a word, and nobody knows what anyone else was given.',
      'Civilians all get the same word. The Undercover get a similar word, so they think they are civilians. Mr. White gets no word and has to bluff. Each round everyone gives a short clue in turn, then the group votes one player out. If Mr. White is voted out, they get one guess at the civilians’ word, and a right guess wins the game. The host chooses how many Undercover and Mr. White there are, as long as together they are at most half of the players.',
    ],
    tips: [
      'As a civilian, give a clue that is true for your word but not too obvious. A clue that points straight at the word also helps the Undercover.',
      'As the Undercover, listen to the first clues before you give yours. Once you see the group’s word, stay close to it.',
      'As Mr. White, repeat the mood of earlier clues and stay short. If you are voted out, use the clues to guess the word.',
      'Watch for clues that fit nothing so far. A vague clue and a very specific clue can both be a bluff.',
      'Use the vote list at the end of each round. Who voted for whom tells you a lot about who is protecting whom.',
    ],
    faq: [
      { q: 'How many players do I need?', a: 'At least three. The game works with up to twenty players in one room.' },
      { q: 'How many Undercover and Mr. White can there be?', a: 'The host picks both numbers in the lobby. Together they must be at most half of the players, rounded down, and there must be at least one of them. With nine players that is up to four.' },
      { q: 'Does the Undercover know they are the Undercover?', a: 'No. They get a word that looks normal and have to work out from the clues that it is different. Mr. White knows because there is no word on the screen.' },
      { q: 'What happens if the vote is tied?', a: 'The tied players go to a second vote. If that is tied too, nobody is out and the next round starts.' },
      { q: 'What does Mr. White do when they are voted out?', a: 'They get one chance to type the civilians’ word. If it matches, ignoring case and spaces, Mr. White wins at once. If not, the game goes on.' },
      { q: 'When does the game end?', a: 'Civilians win when every Undercover and Mr. White is out. The infiltrators win when the civilians are no more than them, or you can switch the lobby setting so they only win when one civilian is left. Mr. White also wins by guessing the word.' },
      { q: 'Can I say my own word?', a: 'No. The game rejects a clue that contains your own word. Mr. White has no word, so there is nothing to reject.' },
      { q: 'How do I host a game?', a: 'Open Undercover, enter your name and choose Create a room. Your browser becomes the host, so keep that page open. Share the 4-letter code and friends join from their own browsers. Nothing to install.' },
    ],
  },
  tictactoe: {
    config: tictactoe,
    metaTitle: 'Tic Tac Toe Online: Play a Friend',
    metaDescription:
      'Play Tic Tac Toe online with a friend. Create a room, share the 4-letter code and play a best-of-three match in your browser. No sign-up or install.',
    tagline: 'Create a room, share the code, win the match.',
    genres: ['Multiplayer', 'Classic', 'Two player'],
    intro: [
      'Tic Tac Toe Online is the classic three-in-a-row game for two players, each on their own phone or computer. One player creates a room and shares a four letter code, and the other joins with it. There is nothing to install and no account to make.',
      'You take turns placing X and O on a three by three board. The first to line up three marks in a row, column or diagonal wins the game. The host chooses a single game or a best of three or five match, and the marks swap every game so both players get to start.',
    ],
    tips: [
      'Take the centre square when you can. It sits on four of the eight winning lines.',
      'If you start with a corner, answer a centre reply with the opposite corner to keep the pressure on.',
      'Always check for a line your opponent is one move from finishing before you make your own plan.',
      'Look for a fork: a move that makes two threats at once so your opponent can only block one.',
      'Against a strong player a draw is a good result. In a longer match, small mistakes decide the winner.',
    ],
    faq: [
      { q: 'How many players are there?', a: 'Exactly two. One player creates the room and the other joins with the code.' },
      { q: 'How do I play with a friend?', a: 'Open Tic Tac Toe, enter your name and choose Create a room. Share the 4-letter code and your friend joins from their own browser. Keep your page open while you play, because your browser is the host.' },
      { q: 'Who goes first?', a: 'The host can pick themselves, their friend or a random player for the first game. After that the marks swap each game, so the other player starts.' },
      { q: 'How is the match scored?', a: 'The host picks a single game, best of three or best of five. The first player to win most of the games takes the match. A draw gives nobody a point.' },
      { q: 'What happens if someone leaves?', a: 'The player who stays wins the match. The host can start a new match when another player joins.' },
      { q: 'Why did my room close?', a: 'The host closed their page or lost their connection, so the room ended. Start a new room and share the new code.' },
    ],
  },
  bingo: {
    config: bingo,
    metaTitle: 'Bingo Royale: Multiplayer Number Bingo',
    metaDescription:
      'Play Bingo Royale with 2 to 8 friends. Arrange 1 to 25 on your own board, take turns announcing numbers and be the first to complete 5 lines.',
    tagline: 'Your board, your numbers, first to five lines.',
    genres: ['Multiplayer', 'Party game', 'Number game'],
    intro: [
      'Bingo Royale is a multiplayer twist on Bingo for two to eight friends, each on their own phone or computer. One player creates a room and shares a four letter code, and everyone else joins with it. Nothing to install and no account to make.',
      'There is no number machine. Every player fills their own five by five board with the numbers 1 to 25 in any order, then players take turns, clockwise, to announce one number that nobody has used. An announced number is marked on every board at once. The first player to complete five lines wins, where a line is any row, column or one of the two diagonals.',
    ],
    tips: [
      'Spread your numbers out. A board where the middle numbers share many lines can complete several at once.',
      'Watch the other boards. If someone is one number from a fifth line, do not announce it.',
      'The centre square sits on four lines, so the number you put there matters most.',
      'Announce numbers that sit on lines you are close to finishing, but that are scattered on other boards.',
      'Every number is on every board, but in different places. Pick numbers that move you forward and help the others least.',
    ],
    faq: [
      { q: 'How many players can play?', a: 'Two to eight in one room. The host starts the game once everyone has confirmed their board.' },
      { q: 'How do I win?', a: 'Complete five lines on your own board. A line is a row, a column or a diagonal, and it counts once all five of its numbers have been announced. There are twelve possible lines.' },
      { q: 'Is this the same as normal Bingo?', a: 'No. Nothing is drawn at random. Players pick the numbers themselves, one at a time and in clockwise order, from the numbers that are still unused.' },
      { q: 'What if two players reach five lines on the same number?', a: 'The one with more lines wins. If they have the same number of lines, they share the win.' },
      { q: 'What if I take too long?', a: 'The host sets a time for each turn in the lobby, or turns the limit off. When time runs out a random unused number is announced for you.' },
      { q: 'What happens if a player leaves?', a: 'Their turn is skipped and their board stays on screen. If everyone else leaves, the last player wins.' },
      { q: 'Can I change my board after the game starts?', a: 'No. Boards lock when the host starts. Before that you can rearrange, shuffle or edit your board as often as you like.' },
      { q: 'Why did my room close?', a: 'The host closed their page or lost their connection, so the room ended. Start a new room and share the new code.' },
    ],
  },
  tambola: {
    config: tambola,
    metaTitle: 'Tambola Online: Play Housie with Friends Free',
    metaDescription:
      'Play Tambola (Housie) free online, solo or in a room with friends. Cut each called number in time or you are out. Claim Early Five, a Line or a Full House.',
    tagline: 'Cut the numbers yourself, claim the pattern, outlast the other players.',
    genres: ['Casual', 'Number', 'Multiplayer'],
    intro: [
      'Tambola, also called Housie or Indian Bingo, is a number-calling game. A caller announces numbers from 1 to 90, and you mark them on your ticket. Each ticket has 3 rows and 9 columns, with 5 numbers and 4 blanks in every row, so 15 numbers in all.',
      'You can play it two ways. Play with friends: one player makes a room and shares a four letter code, everyone gets a ticket, and the game calls a number every few seconds. You have to cut each number yourself, before its timer runs out. Miss one and you are out of the round. Or play solo against computer players, where the first levels are slow and the caller speeds up as you go.',
    ],
    tips: [
      'In a room, watch your ticket the moment a number is called. Numbers 1 to 9 are in the first column, 10 to 19 in the second, and so on, so you can find it fast.',
      'With more than one ticket, the same number can be on two of them. Cut it on every ticket that has it, or the timer will take you out.',
      'You only have to cut numbers that are on your ticket. Numbers that are not on it never cost you anything.',
      'Prizes go in order: Early Five, then Line, then Full House. Press Claim as soon as your ticket completes the current prize, or press C. A false claim locks the button for a few seconds.',
      'If you are out, you can still watch the round. Other players keep playing until the Full House is claimed or only one player is left.',
      'Playing solo, say each number to yourself, then scan its column. Only mark a number once it has been called.',
    ],
    faq: [
      { q: 'What is Tambola?', a: 'Tambola, also known as Housie or Indian Bingo, is a game where players mark numbers from 1 to 90 on a ticket as a caller announces them. The first to complete a pattern wins.' },
      { q: 'How do I play with friends?', a: 'Choose Play with friends, then Create a room and share the four letter code, or join a friend’s room with theirs. The host picks the settings and presses Start. Up to 10 players can join.' },
      { q: 'What happens if I do not cut a number in time?', a: 'You are out of the round. When a number on your ticket is called, you have a few seconds, set by the host, to tap it on every ticket that has it. If the timer runs out first, you can no longer mark or claim, but you can keep watching.' },
      { q: 'Do I have to cut numbers that are not on my ticket?', a: 'No. Only numbers that are on one of your tickets count. If a number is not on your ticket, there is nothing to do.' },
      { q: 'How does the round end?', a: 'The round ends when someone claims the Full House, when only one player is left in it, or when all 90 numbers have been called. The player with the most prizes wins, and the last player standing wins if everyone else is out.' },
      { q: 'What are Early Five, Line and Full House?', a: 'Early Five is any 5 numbers marked on one ticket. A Line is all 5 numbers in one row. A Full House is all 15 numbers on a ticket. They are claimed in that order, and the first valid claim takes each prize.' },
      { q: 'What if I claim by mistake?', a: 'A claim is checked against the numbers you actually marked. If your ticket does not complete the prize yet, you win nothing and the Claim button is locked for a few seconds.' },
      { q: 'Does the solo game save my progress?', a: 'Yes. Your level, stars, best score and fastest times are saved in your browser, so you carry on where you left off next time.' },
    ],
  },
  stickman: {
    config: stickman,
    metaTitle: 'Stickman Fight: Free Online 2 Player Fighting Game',
    metaDescription:
      'Play Stickman Fight free online. Beat computer stickmen across 30 levels or battle a friend on one keyboard. Eight weapons, six arenas, specials, no download.',
    tagline: 'Swing, block, smash and knock them off the platform.',
    genres: ['Action', 'Fighting', '2 Player'],
    intro: [
      'Stickman Fight is a 2D platform brawler in your browser. You and an opponent stand on floating platforms with a weapon in hand. Hit them, block their hits, and knock them into the pit or the lava. Health is 100, and the first fighter to run out loses.',
      'Play alone against the computer, starting with a slow Rookie and a plain sword, and work up through 30 levels of faster, tougher opponents with new weapons and bosses on every fifth level. After level 30 the fights keep coming at full strength. Or share a keyboard with a friend: both players move, jump, block and use specials at the same time.',
    ],
    tips: [
      'Block with S when an attack is coming from the front, then hit back while your opponent recovers. Blocking does nothing against hits from behind, and a blocked hit still drains your guard.',
      'Hits knock people back further the lower their health is. Fight near the edge of a platform and a hit can end the round without damage mattering at all.',
      'Learn the special that goes with your weapon. Jump the Ground Smash, walk out of the lightning column before it lands, and use Iron Guard to take no damage for three seconds.',
      'You get a double jump. Use it to get back onto a platform when you are knocked off, but save it, because there is no third jump.',
      'Arenas have hazards: thorns, icicles, grave spikes, fire jets and moving platforms. Ice makes you slide, so stop early near an edge.',
    ],
    faq: [
      { q: 'How do I play 2 player?', a: 'Choose 2 Player on the main menu, pick weapons and colours, and press Start Fight. Player 1 uses A, D, W, S, F and G. Player 2 uses the arrow keys, K and L. Both can press keys at the same time. There is a Rematch button at the end.' },
      { q: 'Can I play on my phone?', a: 'Yes. Single player has on-screen buttons for move, jump, attack, block and special. Two player on one phone is cramped but works, with player 1 on the left and player 2 on the right.' },
      { q: 'What do coins do?', a: 'You earn coins for beating computer opponents. Spend them on weapons, skins, body colours, effects and weapon designs in the Weapon Selection and Skin Selection screens. Replaying a level pays less than the first win.' },
      { q: 'What are the eight weapons?', a: 'Sword, Dual Swords, Axe, Spear, Hammer, Bow and Arrow, Katana and Giant Sword. Each has its own damage, range, speed and special attack. The sword is free, and the rest are unlocked with coins.' },
      { q: 'What happens if I fall off the platforms?', a: 'You lose 25 health, or 35 in the lava arena, then respawn on your starting platform with a couple of seconds of protection. If that takes your last health you are out.' },
      { q: 'Does the game save my progress?', a: 'Yes. Coins, unlocked items, your level, stars and settings are saved in your browser, so you carry on where you left off. You can erase it from Settings.' },
      { q: 'Is there a time limit?', a: 'Each fight lasts two minutes. If nobody has been knocked out, the fighter with the most health left wins.' },
    ],
  },
  multiverse: {
    config: multiverse,
    metaTitle: 'Multiverse Fighter: Free Online Fighting Game',
    metaDescription:
      'Play Multiverse Fighter free online. Pick from twelve fighters, beat the computer, or battle a friend online with a five-letter room code. No download.',
    tagline: 'Twelve fighters, one arena, and a friend on the other end.',
    genres: ['Action', 'Fighting', 'Online'],
    intro: [
      'Multiverse Fighter is a one-on-one brawler in your browser. Pick a fighter, walk into the arena and win two rounds out of three. Every fighter has different power, health and speed, and its own special attack that unlocks when the cyan energy bar fills.',
      'Play the computer to earn coins and climb through belts, or open an online room and send a friend the five-letter code. Online matches use base stats for both players, so the better fighter wins, not the bigger wallet.',
    ],
    tips: [
      'Hold S to guard when an attack is coming from the front. A guarded hit does a fraction of its damage, and your opponent is stuck in recovery while you act.',
      'Heavy punches hit hard but start slowly. Use them after a block or a knockdown, not as an opener.',
      'Hitting and being hit both charge your special bar. A full bar is a threat even when you are losing a round.',
      'Learn your special. Some travel and bounce back, some hit in a column where you stand, and some only work up close.',
      'Spend early coins on Power or Health for the fighter you play most. Upgrades apply against the computer only, not online.',
    ],
    faq: [
      { q: 'How do I play online?', a: 'Choose Play, then Online. Select Create room to get a five-character code and send it to a friend, or choose Join room and type their code. Both players pick a fighter and press Ready, and the match starts.' },
      { q: 'Does online play need a server?', a: 'Players connect directly to each other. A free matchmaking service only introduces the two browsers. The room stays open for as long as the host keeps the page open.' },
      { q: 'Can I play on my phone?', a: 'Yes. There is a circular move pad on the left and four attack buttons on the right, plus a special button. You can hold several buttons at once. Turn the phone sideways for a bigger arena.' },
      { q: 'How do I unlock fighters?', a: 'Captain America and Paul Atreides are free. Win fights and claim the daily reward to earn coins, then buy the others on the Fighters screen. Online, every fighter is open.' },
      { q: 'What happens if my opponent leaves a match?', a: 'You see a message and a ten-second countdown in case they reconnect. If they do not, you win the match and get the usual reward.' },
      { q: 'Is my progress saved?', a: 'Yes. Coins, level, unlocked fighters, upgrades and your daily reward timer are saved in your browser.' },
    ],
  },
}

// Shared selling points shown on every landing page.
export const commonFeatures = [
  { icon: '🆓', title: 'Free, no sign-up', body: 'Play instantly in your browser. No download, no account needed.' },
  { icon: '📱', title: 'Phone & desktop', body: 'Touch, mouse and keyboard controls. Install it as an app and play offline.' },
  { icon: '📅', title: 'Daily challenge', body: 'Three games, one level each, picked fresh every day for everyone. Keep your streak alive.' },
  { icon: '💾', title: 'Progress saved', body: 'Levels, stars and achievements are saved automatically on your device.' },
]
