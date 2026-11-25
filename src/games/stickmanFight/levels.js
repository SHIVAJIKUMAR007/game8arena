// Campaign levels. A level is generated from a seed and its number, so "level 7" is the same fight for everyone.
// Difficulty follows the shared ramp (platform/engine.js): level 1 is easy, it rises smoothly, and from level
// LEVEL_COUNT onward it stays at MAX_DIFFICULTY while the arena, opponent and weapon keep changing. Exports an
// `engine` that satisfies the shared game-engine contract.
import { assertEngine, clampDifficulty, rampTarget } from '../../platform/engine'
import { createRng } from '../../platform/rng'
import { ARENAS, ARENA_ORDER, COLORS, WEAPONS, WEAPON_ORDER } from './data'

export const LEVEL_COUNT = 30
export const MAX_DIFFICULTY = 92
export const RAMP = { start: 6, end: MAX_DIFFICULTY, maxLevel: LEVEL_COUNT }

// Weapons are introduced one at a time, then the order is shuffled by the seed.
const INTRO = ['sword', 'sword', 'spear', 'axe', 'dual', 'katana', 'bow', 'hammer', 'spear', 'giant']
const BOSS_WEAPONS = { 5: 'dual', 10: 'giant' }
const NAMES = {
  sword: ['Rookie', 'Grunt', 'Soldier'],
  dual: ['Twin Blade', 'Whirl', 'Shadow Twin'],
  axe: ['Lumberjack', 'Chopper', 'Berserker'],
  spear: ['Lancer', 'Pikeman', 'Skewer'],
  hammer: ['Basher', 'Crusher', 'Smasher'],
  bow: ['Archer', 'Sniper', 'Hawkeye'],
  katana: ['Ninja', 'Ronin', 'Shogun'],
  giant: ['Titan', 'Colossus', 'Goliath'],
}
const SKIN_FOR = { sword: 'cap', dual: 'mask', axe: 'viking', spear: 'helmet', hammer: 'helmet', bow: 'wizard', katana: 'ninja', giant: 'crown' }
const TIPS = {
  sword: 'Rookies swing in a straight line. Block, then hit back.',
  dual: 'Fast but light. Block the flurry, and jump out of the Spin Storm.',
  axe: 'Slow, heavy chops. Duck behind a block and punish the recovery.',
  spear: 'Long reach. Stay close or hop over the thrust, and watch for lightning.',
  hammer: 'Huge knockback. Jump over the Ground Smash shockwave.',
  bow: 'Keeps its distance. Close the gap, or block arrows with S.',
  katana: 'Quick and slippery. Its Dash Slash goes straight through you, so jump it.',
  giant: 'One hit hurts. Stay out of range, and punish every miss.',
}

export const levelSeed = level => `stickman:${Math.max(1, Math.floor(level) || 1)}`
export const isBoss = level => level % 5 === 0
/** The target difficulty for a level: the shared ramp, capped. */
export const targetDifficulty = level => clampDifficulty(rampTarget(level, RAMP), MAX_DIFFICULTY)

/** Coins for a win. Replays pay less so grinding level 1 is not the best plan. */
export function rewardFor(level, stars, firstClear) {
  const base = 30 + Math.min(level, 40) * 8 + stars * 10
  return Math.round(firstClear ? base : base * 0.4)
}

/**
 * @param {string|number} seed
 * @param {{ level?: number }} [config]
 */
export function generateLevel(seed, config = {}) {
  const level = Math.max(1, Math.floor(Number(config.level)) || 1)
  const rng = createRng(`${seed}:${level}`)
  const boss = isBoss(level)
  const difficulty = targetDifficulty(level)
  const s = difficulty / 100

  const arenaId = level <= LEVEL_COUNT ? ARENA_ORDER[(level - 1) % ARENA_ORDER.length] : rng.pick(ARENA_ORDER)
  const variant = level === 1 ? 0 : rng.int(0, ARENAS[arenaId].layouts.length - 1)

  let weapon
  if (BOSS_WEAPONS[level]) weapon = BOSS_WEAPONS[level]
  else if (level <= INTRO.length) weapon = INTRO[level - 1]
  else weapon = rng.pick(WEAPON_ORDER)
  const tier = Math.min(2, Math.floor(level / 10))
  const name = (boss ? 'Boss ' : '') + NAMES[weapon][tier]
  const enemyColor = level === 1 ? 'red' : rng.pick(COLORS.slice(0, 6).filter(c => c.id !== 'blue')).id

  return {
    id: `${seed}:${level}`,
    level,
    seed: String(seed),
    arenaId,
    variant,
    boss,
    difficulty,
    enemy: {
      name,
      weapon,
      color: enemyColor,
      skin: SKIN_FOR[weapon],
      effect: 'none',
      design: 'classic',
      isAI: true,
      hpMax: Math.round((55 + 55 * s) * (boss ? 1.12 : 1)),
      dmgMult: Math.round((0.6 + 0.4 * s) * 100) / 100,
      skill: Math.min(0.97, s),
    },
    tip: TIPS[weapon],
  }
}

/** Checks a generated level against the rules of the game. */
export function validateLevel(ls) {
  const errors = []
  if (!ls || typeof ls !== 'object') return { ok: false, errors: ['level must be an object'] }
  if (!ARENAS[ls.arenaId]) errors.push('unknown arena')
  else if (!Number.isInteger(ls.variant) || ls.variant < 0 || ls.variant >= ARENAS[ls.arenaId].layouts.length) errors.push('unknown layout')
  const e = ls.enemy
  if (!e || !WEAPONS[e.weapon]) errors.push('enemy needs a known weapon')
  else {
    if (!(e.hpMax > 0)) errors.push('enemy hp must be positive')
    if (!(e.dmgMult > 0 && e.dmgMult <= 2)) errors.push('enemy damage out of range')
    if (!(e.skill >= 0 && e.skill <= 1)) errors.push('enemy skill must be between 0 and 1')
  }
  if (!(ls.difficulty >= 0 && ls.difficulty <= MAX_DIFFICULTY)) errors.push('difficulty above the cap')
  return { ok: errors.length === 0, errors }
}

const norm = (v, lo, hi) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)))

/** This game's own difficulty score (0..MAX_DIFFICULTY), read from how tough the opponent actually is. */
export function evaluateDifficulty(ls) {
  const e = ls?.enemy
  if (!e) return 0
  const raw = 0.5 * e.skill + 0.25 * norm(e.hpMax, 55, 125) + 0.25 * norm(e.dmgMult, 0.6, 1)
  return clampDifficulty(raw * 100, MAX_DIFFICULTY)
}

/** A short tip about the opponent, shown before the fight. */
export const getHint = ls => ls?.tip ?? null

export const engine = assertEngine({ generateLevel, validateLevel, evaluateDifficulty, getHint }, 'stickmanFight')
