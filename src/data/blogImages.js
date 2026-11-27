// Blog images are Game8Arena's own game screenshots and artwork, stored in /public/Game8ArenaGamesImages.
// Each post shows the screenshot of the game it covers (see screenshotsForPost). Roundup posts show screenshots of
// several games. No stock photos are used, so every image shows something a reader can actually play on the site.
//
// To add an image: drop the file in /public/Game8ArenaGamesImages, add it to `screens` below, and map it to a post in
// `slugRules` or `exactSlugs`. seo.test.jsx fails if a file in that folder is not used by any post.

const BASE = '/Game8ArenaGamesImages/'

// key -> [file name, display name, alt text]. Alt text only states what the file shows.
const screens = {
  arrow: ['Arrow Escape.webp', 'Arrow Escape', 'Arrow Escape board with arrows, hint, undo and restart buttons'],
  blocky: ['Blocky Blast.webp', 'Blocky Blitz', 'Blocky Blitz game screen on Game8Arena'],
  box: ['Box Escape.webp', 'Box Escape', 'Box Escape game screen on Game8Arena'],
  bubble: ['Bubble Surge.webp', 'Bubble Surge', 'Bubble Surge game screen on Game8Arena'],
  codebreaker: ['Code Breaker.webp', 'Code Breaker', 'Code Breaker game screen on Game8Arena'],
  connect: ['Color Connect.webp', 'Color Connect', 'Color Connect game screen on Game8Arena'],
  family: ['Family Sort.webp', 'Family Sort', 'Family Sort game screen on Game8Arena'],
  findgod: ['Find God.webp', 'Find God', 'Find God game screen on Game8Arena'],
  mafia1: ['Mafia Hunt 1.webp', 'Mafia Hunt', 'Mafia Hunt game screen on Game8Arena'],
  mafia2: ['Mafia Hunt 2.webp', 'Mafia Hunt', 'Mafia Hunt second game screen on Game8Arena'],
  memory: ['Memory Sequence.webp', 'Memory Sequence', 'Memory Sequence game screen on Game8Arena'],
  merge: ['Merge Rush.webp', 'Merge Rush', 'Merge Rush game screen on Game8Arena'],
  multiverse: ['Multiverse Fighters.webp', 'Multiverse Fighter', 'Multiverse Fighter game screen on Game8Arena'],
  pipe: ['Pipe Connect.webp', 'Pipe Connect', 'Pipe Connect game screen on Game8Arena'],
  solitaire: ['Solitaire.webp', 'Solitaire', 'Solitaire game screen on Game8Arena'],
  stickman: ['Stickman Fight.webp', 'Stickman Fight', 'Stickman Fight game screen on Game8Arena'],
  sudoku: ['Sudoku.webp', 'Sudoku', 'Sudoku game screen on Game8Arena'],
  tambola: ['Tambola.webp', 'Tambola', 'Tambola game screen on Game8Arena'],
  traffic: ['Traffic Escape.webp', 'Traffic Escape', 'Traffic Escape game screen on Game8Arena'],
  tictactoe: ['Tik tak toe.webp', 'Tic Tac Toe', 'Tic Tac Toe artwork: a neon X and O board'],
  word: ['Wordle.webp', 'Word Guess', 'Word Guess game screen on Game8Arena'],
  bingo: ['bingow.webp', 'Bingo Royale', 'Bingo Royale artwork: a bingo card under the BINGO title'],
  minesweeper: ['mine Sweeper.webp', 'Minesweeper', 'Minesweeper game screen on Game8Arena'],
  undercover1: ['undercover 1.webp', 'Undercover', 'Undercover game screen on Game8Arena'],
  undercover2: ['undercover 2.webp', 'Undercover', 'Undercover second game screen on Game8Arena'],
}

const toImage = key => {
  const [file, name, alt] = screens[key]
  return {
    type: 'image',
    url: `${BASE}${encodeURIComponent(file)}`,
    filename: file,
    alt,
    caption: `${name} on Game8Arena.`,
  }
}

/** Every file name this module can serve; the test suite compares it with the folder contents. */
export const screenshotFiles = Object.values(screens).map(([file]) => file)

// Roundups and posts whose slug does not name one game.
const exactSlugs = {
  'how-to-solve-logic-grid-puzzles': ['findgod', 'sudoku'],
  'how-to-solve-sokoban-puzzles': ['box', 'traffic'],
  'best-games-like-2048': ['merge', 'blocky'],
  'best-memory-games-online': ['memory', 'connect'],
  'best-free-games-to-play-when-bored': ['bubble', 'merge', 'blocky'],
  'how-to-solve-sudoku-for-beginners': ['sudoku'],
  'sudoku-strategies-and-tips': ['sudoku'],
  'how-to-play-mastermind': ['codebreaker'],
  'best-brain-games-for-adults': ['sudoku', 'memory'],
  'best-free-online-puzzle-games': ['arrow', 'sudoku'],
  'best-free-casual-games-browser': ['bubble', 'merge'],
  'get-better-at-puzzle-games': ['sudoku', 'minesweeper'],
  'original-browser-fighting-games': ['stickman', 'multiverse'],
}

// Posts about a single game, matched by the game name inside the slug.
const slugRules = [
  [/arrow-escape/, ['arrow']],
  [/merge-rush/, ['merge']],
  [/find-god/, ['findgod']],
  [/box-escape/, ['box']],
  [/traffic-escape/, ['traffic']],
  [/memory-sequence/, ['memory']],
  [/color-connect/, ['connect']],
  [/pipe-connect/, ['pipe']],
  [/code-breaker/, ['codebreaker']],
  [/sudoku/, ['sudoku']],
  [/word-guess/, ['word']],
  [/minesweeper/, ['minesweeper']],
  [/klondike|solitaire/, ['solitaire']],
  [/blocky-blitz/, ['blocky']],
  [/bubble-surge/, ['bubble']],
  [/multiverse/, ['multiverse']],
  [/stickman/, ['stickman']],
  [/tambola/, ['tambola']],
  [/family-sort/, ['family']],
  [/mafia-hunt/, ['mafia1', 'mafia2']],
  [/undercover/, ['undercover1', 'undercover2']],
  [/tic-tac-toe/, ['tictactoe']],
  [/bingo/, ['bingo']],
]

/**
 * Screenshots for a post, or undefined when no rule matches its slug.
 * @param {{ slug: string }} post
 */
export function screenshotsForPost(post) {
  const keys = exactSlugs[post.slug] || slugRules.find(([re]) => re.test(post.slug))?.[1]
  return keys?.map(toImage)
}

// Topic names used by the article drafts. A draft that names a topic gets that game's screenshot; the second slot
// repeats it when a game has only one, and blogPosts.js removes the duplicate once the post is assembled.
const topics = {
  arrow: ['arrow'], box: ['box'], traffic: ['traffic'], merge: ['merge'], memory: ['memory'], connect: ['connect'],
  pipe: ['pipe'], mastermind: ['codebreaker'], sudoku: ['sudoku'], word: ['word'], minesweeper: ['minesweeper'],
  solitaire: ['solitaire'], logicgrid: ['findgod', 'sudoku'], brain: ['sudoku', 'memory'], casual: ['merge', 'bubble'],
  gamenews: ['bubble', 'blocky'],
}

export const blogImages = (topic, flip = false) => {
  const keys = topics[topic] || topics.casual
  const pair = [toImage(keys[0]), toImage(keys[1] || keys[0])]
  return flip ? pair.reverse() : pair
}
