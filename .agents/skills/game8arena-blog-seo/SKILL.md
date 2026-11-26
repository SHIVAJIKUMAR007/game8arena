---
name: game8arena-blog-seo
description: >
  Plan, write, and integrate Game8Arena blog posts that answer real game
  searches and guide readers to relevant playable games. Use for new articles,
  blog refreshes, keyword planning, and blog-to-game conversion work.
user-invocable: true
argument-hint: "[topic, keyword, or draft]"
---

# Game8Arena blog SEO and game conversion

Use this workflow when creating or updating blog content for Game8Arena. The goal is to help a reader solve their search, then make it easy to try a relevant game on the site.

Search rankings are not guaranteed. Word count, keyword tools, and metadata checks are editorial aids, not promises of traffic or ranking.

## Start with the site's games and search intent

Read `src/data/games.js`, `src/data/gameContent.js`, and the relevant game module before describing a game. Use implemented controls, rules, modes, level progression, and tested behavior. Do not claim a game or feature exists because it appears in a trend, keyword list, or competitor page.

Choose one primary search intent for each article:

- **Play intent:** a reader wants a game to start now, such as a browser game for two players.
- **Information intent:** a reader wants rules, recommendations, comparisons, controls, or strategy.
- **Game-specific intent:** a reader already knows a game title and wants to play it or understand a feature.

Prefer broader category and discovery topics when they introduce unfamiliar players to Game8Arena. Use the actual game landing page for a specific query such as "play Tambola online" or "free Minesweeper online"; do not create multiple blog posts that compete with the same game page.

### Game8Arena topic clusters

Use these clusters to plan related articles and internal links:

| Cluster | Example topics | Relevant games |
|---|---|---|
| Multiplayer games | two-player games, browser multiplayer, games with friends, same-keyboard games, party games | Tic Tac Toe, Stickman Fight, Undercover, Mafia Hunt, Bingo Royale, Tambola, Multiverse Fighter |
| Puzzle games | free online puzzles, water sort, traffic escape, block puzzles, pipe and box puzzles | Family Sort, Traffic Escape, Blocky Blitz, Pipe Connect, Box Escape, Arrow Escape |
| Brain and logic games | memory games, logic puzzles, number games, Sudoku, Minesweeper | Memory Sequence, Find God, Code Breaker, Sudoku, Minesweeper, Merge Rush |
| Game guides | rules, controls, strategy, progression, hints and level walkthroughs | Match the guide to the game and query |
| Gaming news | releases, updates, and industry news with a clear connection to Game8Arena readers | Cite current primary sources and include dates |

Do not make medical or cognitive-health claims for brain games without suitable evidence. Keep unrelated gaming news secondary to the site's playable games and core clusters.

### Suggested editorial backlog

Treat these as candidate topics, not measured keyword opportunities. Check current search data and existing blog posts before writing:

1. Best 2 player games online free: Tic Tac Toe and Stickman Fight
2. Best free multiplayer browser games: Undercover and Bingo Royale
3. Best games to play with friends online: Mafia Hunt and Undercover
4. Best free online puzzle games: relevant puzzle games across the site
5. Best brain games for adults online: Memory Sequence and Sudoku
6. Best water sort puzzle games online: Family Sort
7. Best party games to play with friends: Tambola and Undercover
8. Best free fighting games online: Stickman Fight
9. Best same-keyboard games for two players: Stickman Fight
10. Best free memory games online: Memory Sequence
11. Best logic puzzle games online: Find God and Code Breaker
12. Best parking escape games online: Traffic Escape
13. Best block puzzle games online: Blocky Blitz
14. Best free games to play when bored: a useful cross-category selection
15. Best games to play without downloading: games that work in the browser
16. Best free bingo games online: Bingo Royale
17. How to play Tambola online: Tambola
18. Best games like 2048: Merge Rush, with an accurate explanation of the differences
19. Best Minesweeper games online: Minesweeper
20. Best free word games online: Word Guess

Publish at a pace that allows original, checked content. A few useful posts each week are preferable to releasing a large batch of thin or repetitive pages.

## Research keywords honestly

1. Search the existing blog registry and game landing pages for overlap before choosing a topic.
2. Use Google Search Console for queries and pages that already receive impressions. Use Google Trends to compare interest over time. Keyword Planner can provide search-volume ranges. Third-party tools such as Ahrefs can help with discovery and competition estimates.
3. Record the source, location, date, and method for any search-volume or difficulty number. Label third-party difficulty as an estimate. Never invent volume, difficulty, search demand, rankings, or a claim that a keyword is easy to rank for.
4. If the user supplies a difficulty target, preserve it as a target or user-provided value unless a tool verifies it. Do not present it as a measured score.
5. Build one useful article around a primary query and its close variations. Google can understand natural wording; do not make a separate near-identical article for every phrasing.

## Write for a person first

- Answer the main query near the beginning. Keep the primary keyword in the article title, H1, first paragraph, and metadata where it reads naturally.
- Cover the subquestions that help the reader choose or play. Use descriptive H2/H3 headings, concise paragraphs, and lists only when they improve scanning.
- For recommendations and comparisons, include actual games from the catalogue. Explain what differs between them, who each suits, the controls or modes that matter, and where the reader can try them.
- For game guides, use firsthand play or inspect the current implementation. Include specific controls, rules, level details, screenshots, and examples when available. Do not invent personal experience, reviews, features, or quotes.
- News claims need current, authoritative sources. Add publication and update dates, cite sources in the article data, and revisit time-sensitive facts when they change.
- A byline is already rendered as "By the Game8Arena team." Do not invent author identities, credentials, or experience. Add genuine author details only when supplied and verified.
- The requested word count is a coverage constraint, not a ranking factor. Honor the user's requested length, but do not pad an article to reach it. Check the word-count rules for the specific article dataset and its tests.
- Keep claims and comparisons specific. Do not promise that an article, keyword, or SEO change will rank.

## Help readers start a game

Every article should link to the most relevant playable page, not merely to the homepage:

- Put a clear play link near the start, after briefly answering the query.
- Add a relevant game link near the section where the reader is deciding what to play.
- Close with a direct invitation to play or compare another relevant game.
- Use descriptive anchors such as "Play Tambola" and the existing `/play/:id` route.
- Add a screenshot or image where it helps the reader distinguish games or understand the steps. Use the repository's image helpers and image sources, with accurate alt text.

The current blog implementation has specific CTA behavior:

- `postGame()` in `src/data/blogMeta.js` identifies a game when its title appears naturally in the post title or keyword. For a matched game, `BlogPost.jsx` inserts a large Play CTA before the third H2 and another at the end.
- A post with `ctaPlacement: 'top'` displays its large Play CTA below the post metadata and above the cover. This setting suppresses the automatic middle and end cards, so include ordinary in-body links near those positions as well.
- A roundup that does not match one game falls back to a general homepage CTA. Include direct links to every featured game. Do not force a game name into the title just to trigger the component.

## Add a post using the existing data pipeline

Keep blog content data-driven. Do not add a new route or duplicate the renderer for a new article.

1. Add the post to a focused `src/data/seoBlogPosts*.js` module, following the nearest existing dataset.
2. Import and spread that dataset into `src/data/blogPosts.js`.
3. Use the existing post fields: `slug`, `keyword`, `title`, `metaTitle`, `metaDescription`, `date`, `updated`, `category`, `tags`, `excerpt`, `images`, `body`, `faq`, and, where applicable, `secondaryKeywords`, `longTailKeywords`, `internalLinkOpportunities`, `suggestedRelatedArticles`, and `sources`.
4. `body` is an array of blocks. Use strings for paragraphs, `'## Heading'` / `'### Heading'` for headings, arrays for bullet lists, and the existing image block shape for in-article images. Internal links use `[label](/games/id)` or `[label](/play/id)`.
5. Use `blogImages()` from `src/data/blogImages.js` where a relevant image pair exists. Preserve its source attribution and provide descriptive alt text. Do not hotlink images from search results or copy image URLs from an unverified brief.
6. Add FAQ entries only when they answer real follow-up questions. The page renderer supplies FAQ schema when `faq` is present.
7. Add internal links to relevant game pages and existing articles. Check every linked slug and game ID. Avoid orphaning the new post.
8. Do not duplicate SEO title, slug, or primary keyword intent already served by a landing page or blog post.

## On-page checks

Use the existing SEO tests as the source of truth for the dataset being changed. For the long-form datasets, tests currently check items such as:

- unique slugs and meta titles;
- the primary keyword in the title, first paragraph, and metadata;
- title and description length;
- minimum article length for that dataset;
- image URLs, alt text, filenames, and source attribution;
- FAQ presence, related links, and game links.

Typical project limits are a title of 60 characters or fewer including ` | Game8Arena`, and a description between 70 and 160 characters. Some newer datasets require a 140-character minimum. Follow the test for the target dataset rather than applying a single limit to every post.

Run the narrow SEO test while editing, then the production build when the post is integrated:

```powershell
npm.cmd test -- src/seo/seo.test.jsx
npm.cmd run build
```

The build prerenders blog routes and refreshes the sitemap. Check its output for the new route. Do not edit generated `dist` files as a substitute for adding the post to the registry.

## Broader site improvements

Keep these as ongoing work rather than expanding every article task:

- Maintain unique game landing-page titles, descriptions, controls, rules, FAQs, and game schema.
- Keep game and blog URLs in the sitemap and preserve breadcrumbs and relevant structured data.
- Verify that rendered HTML exposes article text, links, and game descriptions without relying on canvas content.
- Monitor Search Console impressions, clicks, and blog-to-game link use. Update titles or expand posts based on evidence, and merge genuinely overlapping pages.
- Review mobile loading, image size, and Core Web Vitals as site-level work.
- Submit the sitemap to Search Console and Bing Webmaster Tools only when authorized access is available. Do not claim either property is configured without checking.
