// Longer landing-page sections, shown under "Tips & strategy" on /games/:id.
// Every number here comes from the game's own code (src/games/<name>/logic.js and config.js), so when a difficulty
// curve changes, update the matching section. Shape: [{ heading, body: [paragraph, ...] }].
// Keep headings in sentence case and paragraphs plain: say what the game does, not how good it is.

export const gameGuides = {
  memory: [
    {
      heading: 'How Memory Sequence levels grow',
      body: [
        'Level 1 gives you four pads and a target of five steps. The target goes up by one with every level until it reaches 24 at level 20. The pad count grows in stages: four pads up to level 3, six pads from level 4 to level 8, and nine pads from level 9 on.',
        'Each level is a short run of rounds. The first round is the target length minus five, so level 10 opens with a 9-step sequence and finishes on 14, and every round adds one step. The game never lights the same pad three times in a row, which means a long streak of one pad will not appear.',
      ],
    },
    {
      heading: 'Speed and the pad shuffle',
      body: [
        'Playback starts at about half a second per step and gets 20 milliseconds shorter with each level, until it levels off at 190 milliseconds. Fast playback leaves no time to rehearse, so say each pad number to yourself as it lights.',
        'From level 12 the pads swap places after every round. A position you memorized one round ago is no longer reliable. Each pad keeps its own note when it moves, so the sound is the better anchor once the shuffle starts.',
      ],
    },
    {
      heading: 'Lives, hints and the daily challenge',
      body: [
        'You have 3 lives, 3 hints and 2 undos on every level. A wrong pad costs a life and replays the sequence. A hint flashes the next pad, and undo takes back your last mistake and gives the life back. Hints are most useful in the last rounds, where the sequence is longest.',
        'The daily challenge uses level 10: nine pads and a 14-step target. Everyone gets the same board on the same day.',
      ],
    },
  ],

  connect: [
    {
      heading: 'Grid sizes in Color Connect',
      body: [
        'Color Connect starts on a 5×5 grid. Boards grow to 6×6 at level 4, 7×7 at level 9, 8×8 at level 15 and 9×9 from level 23. A bigger grid lengthens every path, and because all squares must be covered, the pipes have to wind around each other to fit.',
        'The daily challenge is level 16, an 8×8 board.',
      ],
    },
    {
      heading: 'What counts as a move',
      body: [
        'Picking up a different colour counts as one move. Drawing a pipe in a single stroke is one move, so perfect play is one move per colour. Each time you go past that budget by a few moves, you lose a life.',
        'That makes the order of your strokes matter. Finish a colour before you switch, and avoid hopping between pairs to test ideas. You have 3 hints and 10 undos on each level. Undo takes back your last stroke, but the move stays on your count, so think before you draw.',
      ],
    },
    {
      heading: 'Filling every square',
      body: [
        'Joining the pairs is only half of the goal. Every square must also be covered, so a finished board is a set of paths that together tile the grid. Count the empty squares as you go. A pocket that no pipe can reach tells you that an earlier pipe took a route that was too short.',
        'Corners and single-square gaps are the best places to start. If only one colour can still reach a square, that colour has to run through it, and that often fixes a whole stretch of the path.',
      ],
    },
  ],

  pipe: [
    {
      heading: 'How Pipe Connect scales',
      body: [
        'The first two levels use a 4×4 grid. From there the grid grows to 5×5 at level 3, 6×6 at level 10, 7×7 at level 15 and 8×8 from level 21. The number of drains grows too: one drain up to level 5, two from level 6, three from level 15 and four from level 29.',
        'Bolted pieces appear from level 4. Their number is about 0.6 times the grid width, so a 5×5 board has three and an 8×8 board has five. They cannot be turned, which makes them fixed clues for the route.',
      ],
    },
    {
      heading: 'Working with the timer',
      body: [
        'The clock starts on your first turn, not when the level loads. Use that: study the board, find the tap and the drains, and trace a route in your head before you touch a pipe.',
        'If the timer runs out you lose a life and the clock refills halfway, so a slow start is recoverable. Undo takes back a turn but does not give time back. Right-click turns a pipe anticlockwise, which saves two clicks on a piece that needs a quarter turn the wrong way.',
      ],
    },
    {
      heading: 'Reading the flow',
      body: [
        'Pipes the water reaches turn blue, which shows you how far the route has come. Two pipes only connect when both of them open toward each other, so check both ends before you assume a link.',
        'Not every pipe has to carry water. Pieces away from the route are free to point anywhere. A hint turns one pipe on the route the right way and bolts it in place. You get 3 hints and 10 undos per level.',
      ],
    },
  ],

  sudoku: [
    {
      heading: 'How the puzzles get harder',
      body: [
        'Level 1 starts with 36 digits already on the grid. As levels rise, the game removes digits until the hardest puzzles show 24. Fewer given digits mean fewer easy cells, so you reach the point where scanning alone stops working sooner.',
        'Each puzzle is checked to make sure exactly one grid fits, so every cell has a single right answer and a wrong digit is always a mistake, never a matter of taste.',
      ],
    },
    {
      heading: 'Techniques worth learning',
      body: [
        'Start with the digit that appears most often on the board. For one such digit, look at the boxes where it is missing and cross out every row and column that already holds it. Often one cell is left.',
        'Then look for single candidates. A cell whose row, column and box already contain eight different digits can only take the ninth. After those two habits, scan for a digit that fits in only one cell of a row, column or box. The number pad dims a digit once all nine copies are placed, so you can skip it.',
      ],
    },
    {
      heading: 'Lives, hints and the daily puzzle',
      body: [
        'You have 3 lives, 3 hints and 3 undos on each puzzle. A wrong digit is rejected and costs a life. A hint fills in the easiest cell, so it is a good way to see which technique you missed. Stars depend on how many lives you lost.',
        'The daily challenge is a level 8 puzzle, the same for everyone that day. The Grandmaster badge is awarded for clearing level 20.',
      ],
    },
  ],

  god: [
    {
      heading: 'Board sizes and realms',
      body: [
        'The board size also sets the number of gods and realms. Levels 1 and 2 use a 5×5 board, levels 3 to 5 use 6×6, levels 6 to 9 use 7×7, levels 10 to 14 use 8×8, and from level 15 the board is 9×9. The daily challenge is an 8×8 board.',
        'Each board has a villager who needs one particular god, and which god you are asked to find changes from board to board.',
      ],
    },
    {
      heading: 'Discarding and searching',
      body: [
        'Tap a cell once to discard it, which marks it with ✕. Double-tap to search it. A wrong search costs a life, but discards are free, so mark every cell you can rule out before you search. You have 3 lives, 3 hints and 10 undos.',
        'When a god is placed, discard its row, its column, its realm and the eight cells around it. That clears a lot of the board at once.',
      ],
    },
    {
      heading: 'Deductions that solve hard boards',
      body: [
        'Look at the smallest realm first, because it has the fewest places for its god. If every remaining cell of a realm lies in the same row, no other realm can put a god in that row, so you can discard the rest of it.',
        'The same idea works for two realms. If two realms are confined to the same two rows, those rows are used up and every other cell in them can go. The no-touching rule adds another: any 2×2 block can hold at most one god. When you are stuck, a hint shows the next deduction and explains it, so you learn the pattern instead of just the answer.',
      ],
    },
  ],

  box: [
    {
      heading: 'How Box Escape levels scale',
      body: [
        'Level 1 has a single crate. Levels 2 and 3 have two crates, levels 4 to 7 have three, and from level 8 every level has four. Rooms get larger and gain more interior walls over the first dozen levels.',
        'The daily challenge uses level 9, with four crates in a larger room.',
      ],
    },
    {
      heading: 'Par and pushes',
      body: [
        'Par is the fewest pushes a level can be solved in, so every push counts toward it. A hint shows the next push on a shortest solution, which makes it a fair way to find out how close your own plan was.',
        'You have 3 hints and 15 undos on each level. Undo is generous because a good plan often means trying a push and taking it back when the crate ends up in the wrong place.',
      ],
    },
    {
      heading: 'Spotting dead ends early',
      body: [
        'A crate in a corner is stuck for good unless that corner is a target. A crate against a wall can only slide along it, so before you push it there, check that a target lies on that wall. Two crates side by side against a wall block each other, because neither can be pushed past the other.',
        'The game blocks an obvious trap and costs a life. Subtler dead ends are not caught, so if the level can no longer be solved, undo or restart. Controls are the arrow keys or WASD, a swipe, the on-screen pad, or a tap on a floor tile to walk there.',
      ],
    },
  ],

  merge: [
    {
      heading: 'Goal tiles in the first five levels',
      body: [
        'The first five levels each have a target tile. They are 27 on level 1, then 81, 243, 729 and finally 2187 on level 5. Every target is a power of three and is three times the one before it, because three tiles of the lower value merge into one.',
        'Because merges need three matching tiles, you plan for the third tile before you slide. A pair that lines up is not a merge yet.',
      ],
    },
    {
      heading: 'When the board fills up',
      body: [
        'If the board is full and no move is left, you lose a life and the three smallest tiles are cleared so you can continue. You have 3 lives per level. Undo takes back your last move and returns the life if that move cost one.',
        'You also have 3 hints and 5 undos on each level. A hint shows a good direction to slide. It does not guarantee a merge, so it is most useful when you are choosing between two similar moves.',
      ],
    },
    {
      heading: 'Endless mode and the daily challenge',
      body: [
        'From level 6 there is no target tile and you play for the highest score you can reach. The daily challenge uses the same endless rules, and a daily run counts once it ends.',
        'In an endless run, keep your largest tiles together in one corner. A slide away from that corner scatters them, so save it for when you are about to run out of space.',
      ],
    },
  ],

  traffic: [
    {
      heading: 'How par and lives work',
      body: [
        'Sliding one car any distance counts as one move. Par is the fewest moves the level can be solved in, and the layouts come from a search, so par is a true minimum and not an estimate.',
        'You are allowed some extra moves before a life is lost. The allowance is half of par, rounded up, with a minimum of three. On a level with a par of 10, you can use 5 extra moves, and you lose a life each time your move count goes past 15, then 20, and so on. The line above the lot shows when the next one will go.',
      ],
    },
    {
      heading: 'Levels from easy to hard',
      body: [
        'The levels are drawn from a library of layouts that were found by a search program and sorted from easy to hard. Early levels are quick. Later ones fill the lot with long trucks that can only slide in one lane, and you have to clear a chain of blockers in the right order.',
        'There are at least 50 levels, since one achievement is for clearing level 50.',
      ],
    },
    {
      heading: 'Working backward from the exit',
      body: [
        'Start at the exit. Find the cars in the red car’s row, then ask what blocks each of those. The last car in that chain is the one to move first. Trucks matter most, because they are the longest vehicles and have the fewest places to park.',
        'Sometimes the best move sends a car away from the exit to open a lane. You have 3 hints and 10 undos on each level. Undo puts the car back but the move stays on your count, so use a hint instead of testing ideas.',
      ],
    },
  ],

  tictactoe: [
    {
      heading: 'Why most games end in a draw',
      body: [
        'The board has eight winning lines: three rows, three columns and two diagonals. The centre square sits on four of them, each corner sits on three, and each edge square sits on two. That is why the centre and the corners matter more than the edges.',
        'If both players make no mistakes, the game is a draw. A win comes from a slip, so your goal is to create positions where your opponent has a chance to slip.',
      ],
    },
    {
      heading: 'Openings and forks',
      body: [
        'When you play X, a corner is the strongest opening. If O answers on an edge, you can build a fork: a move that creates two threats at once, so O can only block one. If you open in the centre, O has to answer in a corner, because an edge reply loses against good play.',
        'When you play O against a corner opening, take the centre. It is the only reply that avoids a forced loss. Any other reply lets X build a fork.',
      ],
    },
    {
      heading: 'Playing a longer match',
      body: [
        'The host picks a single game or a best-of-three or best-of-five match. The marks swap every game, so both players start about equally often. A draw gives nobody a point, so a match that starts with draws is decided by the first win.',
        'Treat your starts and your replies differently. When you start, play for the fork. When you reply, aim to hold the draw and wait for a mistake. If a player leaves, the one who stays wins the match, and if the host closes the page the room ends, so keep your tab open while you play.',
      ],
    },
  ],

  code: [
    {
      heading: 'How the codes grow',
      body: [
        'Levels 1 and 2 use a 3-peg code with 4 colours and 7 attempts. Levels 3 to 5 use 4 pegs and 5 colours, and levels 6 to 9 use 6 colours, both with 8 attempts. From level 10 the same colour can appear more than once, and from level 16 the code has 5 pegs and 7 colours with 9 attempts. From level 23 there are 8 colours.',
        'Repeats change the size of the search a lot. With 6 colours and 4 pegs there are 360 codes when colours cannot repeat and 1,296 when they can.',
      ],
    },
    {
      heading: 'Reading the clues',
      body: [
        'A filled dot means one peg has the right colour in the right spot. A ring means one peg has the right colour in the wrong spot. The clue never tells you which pegs, so you have to work that out from several guesses together.',
        'Each peg of the code can be matched only once. If you guess a colour twice and the code holds it once, only one of your pegs scores. On levels where colours can repeat, that rule helps you count how many copies of a colour are in the code.',
      ],
    },
    {
      heading: 'Using the possible-codes counter',
      body: [
        'The counter shows how many codes still fit every clue so far. A good guess cuts it sharply. A guess that an earlier clue already ruled out is marked red, and a run of guesses that fit every clue builds your combo.',
        'On a level without repeats, open with a guess that uses different colours, so you learn which colours are in the code. If you run out of attempts, you lose a life and get three more. A hint reveals one spot of the code, and undo refunds the attempt for a guess that could not have been the code, though its clue still counts.',
      ],
    },
  ],

  arrow: [
    {
      heading: 'How many arrows each level has',
      body: [
        'From level 1 to level 28 the arrow count rises by two a level, from 6 arrows on level 1 to 60 on level 28. After that the count is picked from a seeded range of 30 to 100, the same for every player, so a later level can have fewer arrows than the 60-arrow wall.',
        'The average length of an arrow also grows with the level, from about 3 cells at the start to about 6 by level 30. The daily board has between 25 and 70 arrows, chosen from the date, and it never has rainbow arrows.',
      ],
    },
    {
      heading: 'How rainbow arrows work',
      body: [
        'Rainbow arrows appear from level 21. Each campaign level has one, and from level 40 each has two. A rainbow arrow follows the normal blocking rules, so it can still crash. When it leaves safely, it sends other arrows out with it: 3 on levels 21 to 30, 4 on levels 31 to 40, 5 on levels 41 to 50 and 6 from level 51.',
        'The arrows it takes along are chosen at random from plain arrows that were already free to go, so a rainbow arrow cannot free a blocked arrow by itself. It clears free arrows and opens lanes for the rest. Use it when a board has many free arrows and you want to thin it out in one tap.',
      ],
    },
    {
      heading: 'Lives, stars and the controls',
      body: [
        'You have 3 lives, 3 hints and 3 undos on every level. Clearing a level without losing a life earns 3 stars and banks an extra life. A hint highlights an arrow that is safe to launch right now.',
        'A free arrow is never a mistake, because launching it only removes an obstacle. All the risk is in arrows that are blocked, so spend your thinking time there. Hold an arrow to see its flight line, or turn on Show paths. Pinch or use the + and − controls to zoom a large board, and use Tab and Enter to play from the keyboard.',
      ],
    },
  ],

  word: [
    {
      heading: 'How Word Guess picks harder words',
      body: [
        'Every answer is given a difficulty score from four things: how familiar the word is, how rare its letters are, whether a letter repeats, and how many other answers differ from it in only one spot. The last one is what makes words like light, night and fight slow to solve even when you know four letters.',
        'Answers are ranked by that score and cut into six tiers that start at levels 1, 6, 13, 21, 31 and 43. The last tier repeats forever. Inside a tier the order is a seeded shuffle, so everyone meets the same word on the same level, and no answer comes back until the tier has been used up.',
      ],
    },
    {
      heading: 'Stars, hints and hard mode',
      body: [
        'You get six guesses per word. Solving in 3 guesses or fewer earns 3 stars. You also have 2 hints per word, and a hint shows one letter in its place but limits that word to 2 stars. There is no undo, because a scored guess cannot be taken back.',
        'Hard mode makes every green and yellow letter you have found part of your later guesses. It forces you to commit, which costs some flexibility on words with look-alikes. One achievement is for winning a word in hard mode without a hint.',
      ],
    },
    {
      heading: 'The daily word and your statistics',
      body: [
        'The daily word is separate from your level and is the same for everyone. It is drawn from tiers 2 to 4, the middle of the range, so it suits a new player and an experienced one. The game saves your level, statistics, streak and any word you have started, all in your browser.',
        'When a word has several neighbors, spend a guess on letters that separate them instead of repeating the ones you know. If the pattern is _IGHT, a guess with several different first letters tells you more than another guess with IGHT in it.',
      ],
    },
  ],

  bingo: [
    {
      heading: 'Boards and lines',
      body: [
        'Every player places the numbers 1 to 25 on a 5×5 board in any order. A board has 12 lines: five rows, five columns and two diagonals. The first player to complete five lines wins, and a line counts once all five of its numbers have been announced.',
        'Squares are not equal. The centre sits on four lines. The other eight squares on the diagonals sit on three lines each, and the remaining sixteen squares sit on two. A number on a busy square helps you complete lines faster whenever anyone announces it.',
      ],
    },
    {
      heading: 'Choosing what to announce',
      body: [
        'Players announce one unused number in clockwise order, and the number is marked on every board at once. That means every number you call helps your opponents too. The skill is picking numbers that move your lines forward while sitting on quiet squares on the other boards.',
        'At most 25 numbers can be announced, so a round has a hard limit. Check each opponent before you call. If someone has four lines and needs one more number, do not give them that number. If two players reach five lines on the same number, the player with more lines wins, and equal lines share the win.',
      ],
    },
    {
      heading: 'Turns, time limits and rooms',
      body: [
        'The host sets how long each turn lasts, or turns the limit off. If your time runs out, the game announces a random unused number for you, which may help someone else more than it helps you. A player who leaves has their turn skipped, and their board stays on screen.',
        'A room holds two to eight players. Boards lock when the host starts, so finish arranging them first. The host runs the room, so if the host closes the page or loses the connection, the room ends and someone has to create a new one.',
      ],
    },
  ],

  multiverse: [
    {
      heading: 'Fighter stats and upgrades',
      body: [
        'Each of the twelve fighters has three ratings from 1 to 10: power, health and speed. Health sets hit points, from 820 for a rating of 5 to 1,120 for a rating of 10. Power scales the damage you deal, from 1.2 times for a rating of 5 to 1.7 times for a rating of 10. Speed sets how fast you walk and how high you jump.',
        'Against the computer you can upgrade Power and Health up to level 8. The first upgrade costs 50 coins, and every level after that costs about 55 percent more. Two fighters are free from the start. The rest cost between 100 and 500 coins, and you begin with 65.',
      ],
    },
    {
      heading: 'Rounds, coins and belts',
      body: [
        'A match is won by taking two rounds. A round lasts 60 seconds and ends at a knockout or when the clock runs out. A win pays 30 coins and 30 XP, a loss pays 10 of each, and 100 XP is one level. A free daily reward of 50 coins comes back every 24 hours.',
        'Your belt changes every two levels, from white through yellow, orange, green, blue and brown to black at level 13. The computer also improves with your level. Its reaction time shrinks from about 0.43 seconds at level 1 to 0.1 seconds from level 10, so a pattern that worked early will stop working.',
      ],
    },
    {
      heading: 'Playing online',
      body: [
        'In an online room the host runs the match and the guest sends only the buttons they hold. After the first introduction, both browsers talk to each other directly. The guest may see their own attacks land a moment after pressing the button, because hits are decided on the host and sent back.',
        'Both fighters use base stats online and every fighter is open, so upgrades do not matter there. Pause is turned off in online matches. If a player drops, the other player waits up to 10 seconds, and then the match goes to the one who stayed.',
      ],
    },
  ],
}
