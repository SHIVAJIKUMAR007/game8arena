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

---

## Execution Rules & Workflow

1. **Inspect Before Implementing:** Read `package.json`, folder structure, existing games, styles, and build scripts before writing any code.
2. **No Assumptions or Bloat:** Do not assume libraries are installed. Do not add unnecessary third-party dependencies.
3. **Preserve Existing Games:** Do not modify or break existing game behavior.
4. **Plan First:** Before writing code, explain the architecture you intend to use and how it fits into the existing codebase.
5. **Verify:** Run the project's build and test suites after implementation to ensure zero regressions or errors.
6. **Report:** Provide a clear summary of all files created or modified upon completion.
