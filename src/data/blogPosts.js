// Blog posts shown at /blogs and /blogs/:slug (prerendered and listed in sitemap.xml).
//
// Body format, one array entry per block:
//   '## Heading'            → <h2>
//   'Plain paragraph'       → <p>   (inline links: [text](/games/arrow) or [text](https://…))
//   ['item', 'item']        → <ul>
//
// Keep metaTitle ≤ 60 chars and metaDescription 70–160 chars (checked by src/seo/seo.test.jsx).
// News posts go stale: update `updated` and the text when facts change, and cite sources.

export const blogPosts = [
  {
    slug: 'gta-6-release-date-platforms',
    title: 'GTA 6 Release Date, Platforms and Everything We Know',
    metaTitle: 'GTA 6 Release Date, Platforms & What We Know',
    metaDescription:
      'GTA 6 launches November 19, 2026 on PS5 and Xbox Series X|S. Release date history, setting, characters, PC status and pre-order news in one place.',
    date: '2026-11-17',
    updated: '2026-11-17',
    category: 'News',
    tags: ['GTA 6', 'Rockstar Games', 'Release dates'],
    excerpt: 'Grand Theft Auto VI arrives on November 19, 2026. Here is the release date history, platforms, setting and what is still unknown.',
    body: [
      'Grand Theft Auto VI is the biggest game launch of 2026, and arguably of the decade. After two delays, Rockstar Games has locked in a release date, and this time it has held. Here is what is confirmed as of November 17, 2026.',
      '## When does GTA 6 come out?',
      'GTA 6 launches on Thursday, November 19, 2026. Rockstar announced that date in November 2025, when it moved the game back from May 26, 2026. The original target, announced alongside the first trailer in December 2023, was simply “2025”.',
      [
        'December 2023: first trailer, release window “2025”',
        'May 2025: delayed to May 26, 2026',
        'November 2025: delayed again to November 19, 2026',
        'November 2026: pre-loads open, launch date unchanged',
      ],
      '## Which platforms is GTA 6 on?',
      'At launch, GTA 6 is available on PlayStation 5 and Xbox Series X|S. Xbox has also said the game will be playable through Xbox Cloud Gaming from day one, which lets people stream it on hardware that could not run it locally.',
      'There is no PC version announced yet. Rockstar has historically brought its big releases to PC later (GTA V arrived on PC about 18 months after its console debut), so a PC port is likely at some point, but there is no date.',
      '## Where is GTA 6 set?',
      'The game takes place in the fictional state of Leonida, Rockstar’s take on Florida, with a modern-day Vice City at its centre. The trailers show beaches, swamps, small towns and highways, so expect a map that mixes a big city with a lot of countryside.',
      '## Who are the main characters?',
      'For the first time in the main series, there are two lead characters from the start: Lucia Caminos and Jason Duval, a criminal couple. The trailers frame their story as a Bonnie-and-Clyde style run of heists that goes wrong.',
      '## How big are pre-orders?',
      'Very big. Both PlayStation and Xbox have said GTA 6 is the most pre-ordered game ever on their stores, and market-research firm Sensor Tower estimated around 15 million pre-orders ahead of launch. Expect busy servers and slow downloads on launch night, so pre-load if you can.',
      '## What we still do not know',
      [
        'A PC release date',
        'Details on GTA Online for GTA 6 and when it starts',
        'Post-launch story DLC plans',
      ],
      'We will update this page after launch. Waiting for the download to finish? Our [free puzzle games](/) run in any browser with no install, and a few rounds of [Traffic Escape](/games/traffic) feel right on theme.',
    ],
    sources: [
      { name: 'Rockstar Games Newswire: GTA VI now set to launch November 19, 2026', url: 'https://www.rockstargames.com/newswire/article/ak3ak31a49a221/grand-theft-auto-vi-is-now-set-to-launch-november-19-2026' },
      { name: 'Xbox Wire: GTA VI comes to Xbox Cloud Gaming on November 19', url: 'https://news.xbox.com/en-us/2026/11/10/grand-theft-auto-6-comes-to-xbox-cloud-gaming-november-19/' },
      { name: 'CNN: The biggest entertainment event of the year is GTA VI', url: 'https://www.cnn.com/2026/11/16/media/grand-theft-auto-gta-vi-entertainment-media' },
      { name: 'CNBC: How GTA VI could reshape gaming and streaming', url: 'https://www.cnbc.com/2026/11/14/gta-6-grand-theft-auto-launch.html' },
    ],
  },
  {
    slug: 'gaming-news-november-2026',
    title: 'Gaming News Roundup: GTA VI Week, Zelda Record and Wolfenstein 3',
    metaTitle: 'Game News: GTA VI Week, Zelda Record, Wolfenstein 3',
    metaDescription:
      'This week in games: GTA VI launches November 19, the Ocarina of Time remake sells 5.2 million in four days, and Wolfenstein 3 is officially in production.',
    date: '2026-11-17',
    updated: '2026-11-17',
    category: 'News',
    tags: ['Gaming news', 'GTA 6', 'Nintendo Switch 2', 'Wolfenstein'],
    excerpt: 'GTA VI is days away, Nintendo sets a Switch 2 record with Ocarina of Time, and MachineGames confirms Wolfenstein 3.',
    body: [
      'It is a big week for games. Here are the three stories that matter most, as of November 17, 2026.',
      '## GTA VI launches on November 19',
      'Rockstar’s Grand Theft Auto VI arrives this Thursday on PS5 and Xbox Series X|S, after two delays. PlayStation and Xbox both say it is the most pre-ordered game in the history of their stores, and Xbox confirmed it will also stream through Xbox Cloud Gaming at launch. There is still no PC version announced.',
      'We put the release date history, setting, characters and open questions in one place: [GTA 6 release date, platforms and everything we know](/blogs/gta-6-release-date-platforms).',
      '## Ocarina of Time remake breaks a Switch 2 record',
      'Nintendo says The Legend of Zelda: Ocarina of Time for Nintendo Switch 2 sold more than 5.2 million copies worldwide in its first four days after launching on November 5. That makes it the fastest-selling Nintendo-published Switch 2 game so far, counting physical and digital copies, with about 810,000 of those sales in Japan.',
      'For context, the original Nintendo 64 version sold about 7.6 million copies over its whole life, so the remake could pass it within weeks.',
      '## Wolfenstein 3 is officially in production',
      'MachineGames has confirmed that Wolfenstein 3 is in development, ending years of rumours since Wolfenstein II: The New Colossus in 2017. The announcement came during Xbox’s 25th-anniversary celebrations. There is no release date, platform list or gameplay footage yet, so treat this as a “years, not months” project.',
      '## Quick hits',
      [
        'Expect heavy network traffic and busy servers on GTA VI launch night. Pre-load the game if your platform offers it.',
        'Several studios have timed their releases to avoid GTA VI’s launch week, so expect a quieter release calendar until December.',
      ],
      'Need something quick between big releases? Try today’s daily challenge in [Sudoku](/games/sudoku) or [Code Breaker](/games/code). Both are free and run in your browser.',
    ],
    sources: [
      { name: 'Rockstar Games Newswire: GTA VI release date', url: 'https://www.rockstargames.com/newswire/article/ak3ak31a49a221/grand-theft-auto-vi-is-now-set-to-launch-november-19-2026' },
      { name: 'Game Informer: Ocarina of Time remake is Nintendo’s fastest-selling Switch 2 game', url: 'https://gameinformer.com/2026/11/11/the-legend-of-zelda-ocarina-of-time-remake-is-nintendos-fastest-selling-switch-2-game' },
      { name: 'VGC: MachineGames confirms Wolfenstein 3 is in development', url: 'https://www.videogameschronicle.com/news/machinegames-has-finally-officially-confirmed-that-wolfenstein-3-is-in-development/' },
      { name: 'CNN: GTA VI is the biggest entertainment event of the year', url: 'https://www.cnn.com/2026/11/16/media/grand-theft-auto-gta-vi-entertainment-media' },
    ],
  },
  {
    slug: 'best-free-casual-games-browser',
    title: 'The Best Free Casual Games You Can Play in Your Browser',
    metaTitle: 'Best Free Casual Games to Play in Your Browser',
    metaDescription:
      'Short on time? These free casual browser games need no download or sign-up. Pick by mood: quick logic, memory, relaxing puzzles or a daily challenge.',
    date: '2026-11-17',
    updated: '2026-11-17',
    category: 'Guides',
    tags: ['Casual games', 'Browser games', 'Puzzle games'],
    excerpt: 'No download, no account, no waiting. A guide to free casual games you can start in seconds, sorted by what kind of break you need.',
    body: [
      'Casual games are built for the gaps in your day: a coffee break, a commute, five minutes before a meeting. The best ones start instantly, teach themselves in a few seconds and let you stop at any moment without losing progress.',
      'Browser games are the easiest way to get that. There is nothing to install and nothing to update, and the same game works on your phone and your laptop. Here is how to pick one based on the kind of break you want.',
      '## If you have two minutes: quick logic',
      'Pick something with short levels and a clear goal. [Arrow Escape](/games/arrow) asks you to slide arrows off the board in the right order. Each level takes under a minute, and the difficulty climbs slowly. [Traffic Escape](/games/traffic) is the classic rush-hour puzzle: move the cars until yours can get out.',
      '## If you want to switch your brain off: relaxing puzzles',
      'Some puzzles are about flow rather than pressure. [Color Connect](/games/connect) has you draw pipes between matching dots until the grid is full. [Pipe Connect](/games/pipe) is about rotating tiles until the water runs through. Neither has a timer you need to beat, so you can play at your own pace.',
      '## If you want a real challenge: deduction games',
      '[Sudoku](/games/sudoku) is still the king of pure logic puzzles, and it never runs out. [Code Breaker](/games/code) is a code-guessing game in the style of Mastermind: each guess gives you clues, and the fun is in using them well. Both reward slow, careful thinking over fast fingers.',
      '## If you want to test your memory',
      '[Memory Sequence](/games/memory) plays a pattern of lights and notes and asks you to repeat it, adding one step each round. It is harder than it sounds once the sequence passes ten steps, and later levels shuffle the pads around.',
      '## If you like numbers going up',
      '[Merge Rush](/games/merge) is a merge game: combine matching tiles to make bigger ones and keep the board from filling up. It is easy to learn, and each run asks for a bit more planning than the last.',
      '## What makes a good casual game?',
      [
        'It starts in seconds, with no download, sign-up or long intro',
        'The rules fit in one sentence',
        'Levels are short enough to finish in a break',
        'Progress saves automatically, so you can leave at any moment',
        'It works the same with touch, mouse and keyboard',
      ],
      'Every game on [Game8Arena](/) is built around those rules. They are all free, need no account, and save your progress on your own device. If you want a reason to come back each day, most of them have a daily challenge and achievements.',
    ],
  },
  {
    slug: 'get-better-at-puzzle-games',
    title: '7 Habits That Make You Better at Puzzle Games',
    metaTitle: '7 Habits That Make You Better at Puzzle Games',
    metaDescription:
      'Stuck on a level? Seven practical habits that help in any puzzle game, from working backwards to taking a break, with examples from free browser games.',
    date: '2026-11-17',
    updated: '2026-11-17',
    category: 'Guides',
    tags: ['Puzzle games', 'Tips', 'Casual games'],
    excerpt: 'Most puzzle players get stuck in the same ways. These seven habits work in Sudoku, sliding puzzles, memory games and more.',
    body: [
      'Puzzle games feel like they test raw intelligence, but most of the gap between a stuck player and a fast one is habit. Good players approach every level the same way. Here are seven habits you can borrow, whatever you play.',
      '## 1. Look before you move',
      'Take five seconds to scan the whole board before you touch anything. In [Traffic Escape](/games/traffic) or [Box Escape](/games/box), the piece blocking you is often not the one next to your exit but one further back that has to move first.',
      '## 2. Work backwards from the goal',
      'Ask “what has to be true just before I win?” and keep going back from there. In sliding puzzles that means working out which pieces must be clear of the exit path. In [Arrow Escape](/games/arrow), look for the arrows that can leave right now, and the ones that only open up once those are gone.',
      '## 3. Start with the most constrained spot',
      'The square with the fewest options is usually the best place to start. In [Sudoku](/games/sudoku), look for the row, column or box with the most digits already filled in. In [Color Connect](/games/connect), draw the pairs in corners and along edges first, because they have the fewest possible routes.',
      '## 4. Use every clue you get',
      'Deduction games give you more information than it seems. In [Code Breaker](/games/code), a guess that scores zero is not wasted: it tells you which symbols to drop. Before each new guess, check that it fits every result you have seen so far.',
      '## 5. Chunk what you need to remember',
      'Memory is limited, but grouping helps. In [Memory Sequence](/games/memory), remember the pattern as shapes or groups of three (“top row, then diagonal”) rather than as single taps. That is the same trick people use to remember phone numbers.',
      '## 6. Use undo to experiment',
      'Undo is a tool, not a crutch. If you are torn between two moves, try one and see where it leads, then undo if it is a dead end. Trying things out on purpose is faster than staring at the board.',
      '## 7. Take a break when you are stuck',
      'If you have been stuck for a few minutes, walk away. Many players find the answer is obvious when they come back, because they stop repeating the same failed idea. Casual games that save automatically make this easy.',
      '## Put it into practice',
      'Pick one habit and use it on purpose for a few levels. “Most constrained spot first” in Sudoku is a good place to start, because the difference shows up right away. All of our [free puzzle games](/) save your progress, so you can practise in short sessions.',
    ],
  },
]

export const blogPostBySlug = Object.fromEntries(blogPosts.map(p => [p.slug, p]))
export const blogPath = slug => `/blogs/${slug}`
