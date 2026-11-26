// Each game lives in its own folder under src/games/<name>/ and default-exports its definition:
//   { id, title, emoji, category, color, description, controls?, daily?, players?, component }
// `players: { min, max }` feeds the game's schema.org markup (numberOfPlayers, playMode). Omit it for solo games;
// set it on every game that can be played by more than one person, with the real limits.
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
import sudoku from "../games/sudoku";
import wordGuess from "../games/wordGuess";
import minesweeper from "../games/minesweeper";
import solitaire from "../games/solitaire";
import blocky from "../games/blockyBlitz";
import bubbles from "../games/bubbleSurge";
import family from "../games/familySort";
import hideseek from "../games/hideSeek";
import undercover from "../games/undercover";
import tictactoe from "../games/ticTacToe";
import bingo from "../games/bingoRoyale";
import tambola from "../games/tambola";
import stickman from "../games/stickmanFight";
import multiverse from "../games/multiverseFighter";

export const games = [arrow, merge, findGod, boxEscape, trafficEscape, memorySequence, colorConnect, pipeConnect, codeBreaker, sudoku, wordGuess, minesweeper, solitaire, blocky, bubbles, family, hideseek, undercover, tictactoe, bingo, tambola, stickman, multiverse];
