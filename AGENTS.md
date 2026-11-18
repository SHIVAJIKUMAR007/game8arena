You are a senior React + TypeScript game engineer working on my existing project, Game8Arena (game8arena.com).

Your first task is to inspect the complete existing codebase, understand its architecture, styling system, routing, game modules, and existing game implementations.

Do not rewrite the application or replace existing working games.

Build a reusable architecture for adding new casual single-player browser games.

Requirements:

1. Create reusable game infrastructure:
   - Game layout and header
   - Score and best-score display
   - Level progression
   - Difficulty configuration
   - Pause, restart, and new-game controls
   - Hint system
   - Win and game-over screens
   - Sound toggle, if the project already supports sound
   - Responsive mobile and desktop controls

2. Create a reusable progression system:
   - Level 1 starts easy.
   - Difficulty increases gradually.
   - Each game defines its own difficulty evaluator.
   - Difficulty must never increase beyond its configured maximum.
   - After reaching maximum difficulty, continue generating new variations at that difficulty.
   - Avoid sudden, unfair difficulty spikes.

3. Create a generic game-engine interface using TypeScript:
   - generateLevel()
   - validateLevel()
   - evaluateDifficulty()
   - getSolution(), where applicable
   - getHint(), where applicable

4. Implement deterministic level generation using seeds. The same seed and configuration should produce the same puzzle.

5. Add level persistence:
   - Current level
   - Completed levels
   - Best score
   - Hints used
   - Completion time
   - Game settings

6. Use localStorage or the project's existing persistence solution. Handle corrupted or missing save data safely.

7. Add a game registry so new games can be integrated without modifying unrelated game logic.

8. Keep game-specific rules and algorithms separate from shared UI components.

9. Add validation and unit tests for the shared systems.

10. Follow the project's existing naming conventions, folder structure, design system, and coding standards.

Important:

- Inspect before implementing.
- Do not assume libraries are installed.
- Do not add unnecessary dependencies.
- Do not modify existing game behavior.
- Run the build and tests after implementation.
- Report all files created or modified.

First explain the architecture you intend to use, then implement it.
