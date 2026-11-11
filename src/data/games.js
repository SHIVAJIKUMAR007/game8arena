// Each game lives in its own folder under src/games/<name>/ and default-exports its definition:
//   { id, title, emoji, category, color, description, controls?, daily?, component }
// `component` may be React.lazy(...) so every game ships as its own chunk.
// For level-based games, build the game on top of src/platform/LevelGameShell.jsx
// (menu, lives, hints, undo, stars, daily, achievements, saving…) — you only write the Board.
// Register a new game by importing it here.
import arrow from "../games/arrow";
import merge from "../games/merge";
import findGod from "../games/findGod";
import boxEscape from "../games/boxEscape";
import trafficEscape from "../games/trafficEscape";
import memorySequence from "../games/MemorySequence";
import colorConnect from "../games/ColorConnect";
import pipeConnect from "../games/pipeConnect";
import codeBreaker from "../games/codeBreaker";

export const games = [arrow, merge, findGod, boxEscape, trafficEscape, memorySequence, colorConnect, pipeConnect, codeBreaker];
