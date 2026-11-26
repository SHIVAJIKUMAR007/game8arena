You are a senior React + JavaScript game engineer working on the existing project **Game8Arena** (`game8arena.com`).

## Core Directive

Your first task is to inspect the complete existing codebase to understand its architecture, styling system, routing, game modules, and existing game implementations. **Do not rewrite the application or replace existing working games.** Build a reusable architecture for adding new casual single-player browser games in pure JavaScript.

---

## Functional Requirements

### 1. Reusable Game Infrastructure

Build shared, modular React components and hooks that provide:

- **Game layout and header**
- **Score and best-score display**
- **Level progression indicator**
- **Difficulty configuration**
- **Game controls**: Pause, restart, and new-game actions
- **Hint system**
- **Win and game-over screens/modals**
- **Sound toggle** (integrate if the project already supports audio; otherwise provide a clean hook/stub aligned with existing patterns)
- **Responsive controls** supporting both mobile (touch/on-screen) and desktop (keyboard/mouse)

### 2. Reusable Progression System

- **Level 1** must always start easy.
- **Difficulty increases gradually** across levels.
- Each game must define its own **difficulty evaluator**.
- Difficulty must **never exceed its configured maximum**.
- After reaching maximum difficulty, the engine must **continue generating new variations** at that maximum difficulty cap.
- Avoid sudden, unfair difficulty spikes between consecutive levels.

### 3. Generic Game-Engine Contract (JavaScript + JSDoc)

Define a standardized JavaScript game-engine interface/contract (documented via JSDoc `@typedef` / `@interface` and enforced via runtime validation helpers) that every game engine implements:

- `generateLevel(seed, config)`
- `validateLevel(levelState)`
- `evaluateDifficulty(levelState)`
- `getSolution(levelState)` _(where applicable)_
- `getHint(levelState)` _(where applicable)_

### 4. Deterministic Level Generation

- Implement a **seeded pseudo-random number generator (PRNG)** utility.
- Passing the **same seed and configuration** must deterministically produce the exact same puzzle/level every time.

### 5. Level & Progress Persistence

Persist player state cleanly across sessions:

- Current level
- Completed levels
- Best score
- Hints used
- Completion time
- Game settings (e.g., sound, difficulty preference)

### 6. Safe Storage Handling

- Use `localStorage` or the project's existing persistence solution.
- Gracefully handle **corrupted, malformed, version-mismatched, or missing save data** with safe fallbacks so the app never crashes.

### 7. Extensible Game Registry

- Create a centralized **Game Registry** so new games can be registered and discovered dynamically without modifying unrelated game logic or core routing boilerplate.

### 8. Separation of Concerns

- Keep **game-specific rules, state machines, and algorithms** strictly decoupled from shared UI components and hooks.

### 9. Validation & Unit Tests

- Add validation utilities and unit tests covering the shared systems (seeded PRNG determinism, progression curves, difficulty clamping, persistence fallback handling, and game registry).

### 10. Codebase Consistency

- Strictly follow the project's existing **naming conventions, folder structure, design system, and JavaScript coding standards** (e.g., ESLint/Prettier rules, `.js`/`.jsx` extensions).

### 11. Game Schema (schema.org structured data) — required for every new game

Every game must publish `VideoGame` JSON-LD (a schema.org `Game` subtype) on its landing page `/games/:id`. The builder is `videoGameSchema` in `src/seo/schema.js`, and `src/pages/GameLanding.jsx` renders it together with `BreadcrumbList` and `FAQPage` for every entry in `src/data/games.js`. Do not hand-write JSON-LD per game or add a second builder.

When you add a game, in the same change:

1. **Register it fully.** Add the game to `src/data/games.js`, add a `gameContent` entry in `src/data/gameContent.js` (`metaTitle` up to 60 characters, `metaDescription` 70–160 characters, `genres`, `faq`), and add `gameMeta` in `src/data/gameMeta.js`. The schema reads its `name`, `description`, `genre`, `image`, play URL and FAQ from these.
2. **Set `players: { min, max }`** in the game's `index.js` if more than one person can play, using the limits the game really enforces (check the server or room code, not a guess). Leave it out for solo games, which default to 1 player. This feeds `numberOfPlayers` and `playMode`. A game in the `Multiplayer` category must have `players.max > 1`, and a solo game must not.
3. **Only mark up what the page shows.** Do not add `aggregateRating`, `review`, `award`, download links, or release dates unless the real data exists and is visible on the page. Never invent ratings or counts.
4. **Keep it valid.** `src/seo/seo.test.jsx` checks every registered game for complete Game schema and a player range that matches its category. Run `npm test`, and after `npm run build` spot-check the prerendered `dist/games/<id>.html` for the `application/ld+json` script. Validate a deployed page with Google's Rich Results Test or validator.schema.org.
5. **Report it.** List the game's schema fields in the final summary of files created or modified.

---

## Execution Rules & Workflow

1. **Inspect Before Implementing:** Read `package.json`, folder structure, existing games, styles, and build scripts before writing any code.
2. **No Assumptions or Bloat:** Do not assume libraries are installed. Do not add unnecessary third-party dependencies.
3. **Preserve Existing Games:** Do not modify or break existing game behavior.
4. **Plan First:** Before writing code, explain the architecture you intend to use and how it fits into the existing codebase.
5. **Verify:** Run the project's build and test suites after implementation to ensure zero regressions or errors.
6. **Report:** Provide a clear summary of all files created or modified upon completion.

## Blog SEO and game conversions

When creating or updating blog content, follow the [Game8Arena blog SEO skill](.agents/skills/game8arena-blog-seo/SKILL.md). It documents the current blog data pipeline, keyword research standards, article structure, internal play links, and CTA behavior. Do not promise Google rankings or present unverified keyword metrics as facts.
