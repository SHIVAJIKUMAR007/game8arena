// Topic photos for blog posts. Files live in /public/blog (WebP, 900px wide) and come from Pexels (free licence).
// Each post picks two photos of its topic with blogImages(topic, flip); "flip" swaps the pair so two posts on the
// same game don't open with the same picture. The source link points at the photo on Pexels.
const photos = {
  "arrow-1": {
    "file": "arrow-1.webp",
    "id": 6540714,
    "alt": "Several arrows with yellow fletching clustered in the yellow center of a colorful archery target.",
    "caption": "Aim for the target: arrow puzzles reward planning each move."
  },
  "arrow-2": {
    "file": "arrow-2.webp",
    "id": 117025,
    "alt": "A white arrow inside a painted rectangle on dark asphalt pointing down-left, a road marking.",
    "caption": "Direction matters when every arrow tells you where to go."
  },
  "merge-1": {
    "file": "merge-1.webp",
    "id": 32417524,
    "alt": "Four wooden cubes with black numbers spelling 2026 on a beige background.",
    "caption": "Numbered blocks, the raw material of merge-and-slide number puzzles."
  },
  "merge-2": {
    "file": "merge-2.webp",
    "id": 311269,
    "alt": "Close-up of colorful wooden toy blocks with painted numbers such as 2, 3, 4 and 10.",
    "caption": "Combine the right numbers to build bigger ones."
  },
  "logicgrid-1": {
    "file": "logicgrid-1.webp",
    "id": 13533591,
    "alt": "Black-and-white photo of a person holding a pen over a newspaper crossword grid.",
    "caption": "Fill every cell by deduction, one clue at a time."
  },
  "logicgrid-2": {
    "file": "logicgrid-2.webp",
    "id": 12585534,
    "alt": "Close-up of a crossword grid with handwritten letters H E L P and a tiny figurine standing on the squares.",
    "caption": "Stuck on a grid? Logic puzzles reward patient deduction."
  },
  "box-1": {
    "file": "box-1.webp",
    "id": 5317153,
    "alt": "A red plastic crate stacked on dark crates in a storage nook beside leaning framed boards.",
    "caption": "Crates to push and place, the heart of box-pushing puzzles."
  },
  "box-2": {
    "file": "box-2.webp",
    "id": 29607924,
    "alt": "Open wooden warehouse doors revealing stacked cardboard boxes and a small truck inside.",
    "caption": "Planning how to move boxes in tight spaces."
  },
  "traffic-1": {
    "file": "traffic-1.webp",
    "id": 32634336,
    "alt": "Aerial view of a packed lot of white and colored vehicles in tight rows beside a building.",
    "caption": "Cars boxed in on every side: the classic traffic jam puzzle."
  },
  "traffic-2": {
    "file": "traffic-2.webp",
    "id": 15095771,
    "alt": "Overhead drone view of cars parked in marked bays on dark asphalt.",
    "caption": "Slide the right car out first to clear the lot."
  },
  "memory-1": {
    "file": "memory-1.webp",
    "id": 7104162,
    "alt": "Overhead view of a child and adult laying out and matching illustrated sea-creature cards on a rug.",
    "caption": "Match the pairs by remembering where each card lies."
  },
  "memory-2": {
    "file": "memory-2.webp",
    "id": 6940926,
    "alt": "A hand resting on a stack of face-down red playing cards on a light table.",
    "caption": "Flip, remember and match to train recall."
  },
  "connect-1": {
    "file": "connect-1.webp",
    "id": 17072947,
    "alt": "Red, green, blue and yellow cables crossing each other against a dark background.",
    "caption": "Link matching colors without crossing the lines."
  },
  "connect-2": {
    "file": "connect-2.webp",
    "id": 7411910,
    "alt": "String art world map with colored threads on a wooden board, with colored thread spools on the floor.",
    "caption": "Colored strings join points to form a picture."
  },
  "pipe-1": {
    "file": "pipe-1.webp",
    "id": 4406602,
    "alt": "A stream of clear water flowing from a pipe into a pool with ripples.",
    "caption": "Route the flow so water reaches its destination."
  },
  "pipe-2": {
    "file": "pipe-2.webp",
    "id": 770224,
    "alt": "Water pouring from a rusty industrial pipe into a pool, with foliage behind.",
    "caption": "Connect pipe segments so nothing leaks."
  },
  "word-1": {
    "file": "word-1.webp",
    "id": 19867368,
    "alt": "Wooden letter tiles scattered on a weathered wood table with the tiles spelling FREE.",
    "caption": "Arrange letter tiles into words."
  },
  "word-2": {
    "file": "word-2.webp",
    "id": 6845709,
    "alt": "Wooden letter tiles on white spelling FOCUS ON REMEDIES NOT FAULTS.",
    "caption": "Build words tile by tile."
  },
  "minesweeper-1": {
    "file": "minesweeper-1.webp",
    "id": 13311961,
    "alt": "Blue and grey square floor tiles in a checkered grid receding in perspective.",
    "caption": "A grid of squares waiting to be uncovered. Loosely related, there are no mines or flags in the photo."
  },
  "minesweeper-2": {
    "file": "minesweeper-2.webp",
    "id": 7566201,
    "alt": "Top-down view of black and beige checkered floor tiles.",
    "caption": "Check every square and reason about the neighbors. Loosely related, a plain tile grid."
  },
  "solitaire-1": {
    "file": "solitaire-1.webp",
    "id": 1908136,
    "alt": "Fanned deck of playing cards with a joker on a dark wooden surface.",
    "caption": "A full deck ready to be dealt for solitaire."
  },
  "solitaire-2": {
    "file": "solitaire-2.webp",
    "id": 1216346,
    "alt": "Playing cards face up and face down scattered on a wooden floor.",
    "caption": "Cards laid out on the table, sort them in order."
  },
  "sudoku-1": {
    "file": "sudoku-1.webp",
    "id": 7257461,
    "alt": "A hand holding a pen over a sudoku grid in a puzzle book on a desk.",
    "caption": "Fill the grid so no number repeats in a row, column or box."
  },
  "sudoku-2": {
    "file": "sudoku-2.webp",
    "id": 6975084,
    "alt": "Person from behind filling in a sudoku puzzle on paper at a wooden table.",
    "caption": "A calm daily sudoku habit."
  },
  "mastermind-1": {
    "file": "mastermind-1.webp",
    "id": 16564254,
    "alt": "A vintage dial combination padlock with a key next to it on granite.",
    "caption": "Crack the code, one guess at a time. Loosely related, a padlock and key."
  },
  "mastermind-2": {
    "file": "mastermind-2.webp",
    "id": 225233,
    "alt": "A cluster of colorful padlocks attached to a railing in sunlight.",
    "caption": "Many locks, many codes. Loosely related, colorful padlocks."
  },
  "brain-1": {
    "file": "brain-1.webp",
    "id": 8438872,
    "alt": "Overhead view of chess pieces set up on a wooden chessboard.",
    "caption": "Plan several moves ahead."
  },
  "brain-2": {
    "file": "brain-2.webp",
    "id": 6114952,
    "alt": "Wooden chess pieces on a board against a plain wall.",
    "caption": "Strategy games keep the mind sharp."
  },
  "gamenews-1": {
    "file": "gamenews-1.webp",
    "id": 32755770,
    "alt": "A black game controller on a desk beside a mechanical keyboard.",
    "caption": "Gaming setup basics."
  },
  "gamenews-2": {
    "file": "gamenews-2.webp",
    "id": 12718845,
    "alt": "Two game controllers and a small console on a cloth outdoors, with a TV screen in the background.",
    "caption": "Gaming out in the open."
  },
  "casual-1": {
    "file": "casual-1.webp",
    "id": 7915284,
    "alt": "A man lying on a bean bag from behind, playing a game on his phone.",
    "caption": "Quick casual games anywhere."
  },
  "casual-2": {
    "file": "casual-2.webp",
    "id": 7269630,
    "alt": "A small child from above, holding a smartphone showing a game, sitting on a white floor.",
    "caption": "Touch games are easy to pick up at any age."
  }
}

const toImage = key => {
  const p = photos[key]
  return {
    type: 'image',
    url: `/blog/${p.file}`,
    sourceUrl: `https://www.pexels.com/photo/${p.id}/`,
    filename: p.file,
    alt: p.alt,
    caption: p.caption,
  }
}

export const blogImages = (topic, flip = false) => {
  const pair = [toImage(`${topic}-1`), toImage(`${topic}-2`)]
  return flip ? pair.reverse() : pair
}
