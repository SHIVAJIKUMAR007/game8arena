// Static game data: weapons, specials, arenas and cosmetics. No logic and no DOM, so the simulation, the AI, the
// renderer and the menus all read the same numbers.

export const W = 1280
export const H = 720
export const MAX_HP = 100
export const FIGHTER = { w: 34, h: 90 }

/**
 * Weapon stats. `hit` is the active part of the swing as a fraction of `dur`; `top`/`bottom` are the hit box's
 * vertical extent above the fighter's feet. The bow fires a projectile at the start of its active window.
 */
export const WEAPONS = {
  sword: {
    id: 'sword', name: 'Sword', icon: '🗡️', price: 0, style: 'slash', damage: 10, range: 84, dur: 0.36, hit: [0.3, 0.6],
    kb: 300, up: 180, top: 95, bottom: 6, blurb: 'Balanced and reliable.',
    special: { id: 'wave', name: 'Energy Wave', kind: 'wave', cd: 7, damage: 14, speed: 720, kb: 420 },
  },
  dual: {
    id: 'dual', name: 'Dual Swords', icon: '⚔️', price: 250, style: 'dual', damage: 6, range: 72, dur: 0.2, hit: [0.25, 0.6],
    kb: 150, up: 120, top: 95, bottom: 6, blurb: 'Blazing fast, light hits.',
    special: { id: 'spin', name: 'Spin Storm', kind: 'spin', cd: 8, damage: 5, radius: 100, duration: 0.9, pulse: 0.15, kb: 280 },
  },
  axe: {
    id: 'axe', name: 'Axe', icon: '🪓', price: 200, style: 'overhead', damage: 15, range: 84, dur: 0.55, hit: [0.4, 0.68],
    kb: 420, up: 220, top: 100, bottom: 6, blurb: 'Heavy chops that knock back.',
    special: { id: 'guard', name: 'Iron Guard', kind: 'shield', cd: 11, duration: 3, rage: 1.35 },
  },
  spear: {
    id: 'spear', name: 'Spear', icon: '🔱', price: 150, style: 'stab', damage: 9, range: 132, dur: 0.42, hit: [0.35, 0.65],
    kb: 260, up: 130, top: 66, bottom: 28, blurb: 'Longest reach, thin hit box.',
    special: { id: 'thunder', name: 'Thunder Strike', kind: 'lightning', cd: 9, damage: 22, warn: 0.65, radius: 56, kb: 380 },
  },
  hammer: {
    id: 'hammer', name: 'Hammer', icon: '🔨', price: 350, style: 'overhead', damage: 20, range: 88, dur: 0.8, hit: [0.5, 0.72],
    kb: 560, up: 300, top: 100, bottom: 6, blurb: 'Slow, huge knockback.',
    special: { id: 'smash', name: 'Ground Smash', kind: 'smash', cd: 9, damage: 18, radius: 210, jump: 600, launch: 640 },
  },
  bow: {
    id: 'bow', name: 'Bow & Arrow', icon: '🏹', price: 300, style: 'bow', damage: 8, range: 0, dur: 0.55, hit: [0.45, 0.5],
    kb: 200, up: 80, top: 95, bottom: 6, arrowSpeed: 1050, blurb: 'Shoot from a distance.',
    special: { id: 'volley', name: 'Arrow Volley', kind: 'volley', cd: 7, damage: 7, speed: 1000, kb: 220 },
  },
  katana: {
    id: 'katana', name: 'Katana', icon: '🥷', price: 400, style: 'slash', damage: 8, range: 98, dur: 0.26, hit: [0.3, 0.6],
    kb: 200, up: 120, top: 95, bottom: 6, blurb: 'Quick, long and sharp.',
    special: { id: 'dash', name: 'Dash Slash', kind: 'dash', cd: 6, damage: 15, speed: 1250, duration: 0.26, reach: 120, kb: 400 },
  },
  giant: {
    id: 'giant', name: 'Giant Sword', icon: '🗡', price: 600, style: 'overhead', damage: 24, range: 132, dur: 1.0, hit: [0.5, 0.72],
    kb: 650, up: 320, top: 125, bottom: 6, blurb: 'Enormous. Enormous damage.',
    special: { id: 'titan', name: 'Titan Crash', kind: 'smash', cd: 12, damage: 26, radius: 280, jump: 680, launch: 720 },
  },
}
export const WEAPON_ORDER = ['sword', 'dual', 'axe', 'spear', 'hammer', 'bow', 'katana', 'giant']

/** Colours for the weapon "designs" that can be bought for any weapon you own. */
export const DESIGNS = [
  { id: 'classic', name: 'Classic', price: 0, palette: null },
  { id: 'gold', name: 'Gold', price: 250, palette: { blade: '#ffd447', edge: '#fff3b0', accent: '#b8860b', handle: '#5b3a12' } },
  { id: 'frost', name: 'Frost', price: 150, palette: { blade: '#9fe8ff', edge: '#e8fbff', accent: '#3aa7d8', handle: '#2b4a63' } },
  { id: 'flame', name: 'Flame', price: 150, palette: { blade: '#ff7a2e', edge: '#ffd27a', accent: '#c2200f', handle: '#3b1a10' } },
  { id: 'neon', name: 'Neon', price: 200, palette: { blade: '#46ff9b', edge: '#d6ffe9', accent: '#ff2fd1', handle: '#1c1c3a' } },
  { id: 'shadow', name: 'Shadow', price: 200, palette: { blade: '#5b4a85', edge: '#b49bff', accent: '#1a1030', handle: '#111111' } },
]

export const SKINS = [
  { id: 'classic', name: 'Classic', price: 0 },
  { id: 'cap', name: 'Red Cap', price: 100 },
  { id: 'ninja', name: 'Ninja', price: 150 },
  { id: 'mask', name: 'Bandit', price: 150 },
  { id: 'helmet', name: 'Knight', price: 200 },
  { id: 'viking', name: 'Viking', price: 250 },
  { id: 'crown', name: 'Crown', price: 300 },
  { id: 'wizard', name: 'Wizard', price: 350 },
]

export const COLORS = [
  { id: 'blue', name: 'Sky Blue', hex: '#19b5f5', price: 0 },
  { id: 'red', name: 'Red', hex: '#ff3b3b', price: 0 },
  { id: 'green', name: 'Green', hex: '#3ddc5b', price: 0 },
  { id: 'yellow', name: 'Yellow', hex: '#ffd31a', price: 0 },
  { id: 'orange', name: 'Orange', hex: '#ff8a1f', price: 0 },
  { id: 'purple', name: 'Purple', hex: '#a55cf5', price: 0 },
  { id: 'pink', name: 'Pink', hex: '#ff5fa8', price: 60 },
  { id: 'teal', name: 'Teal', hex: '#1fd1b5', price: 60 },
  { id: 'lime', name: 'Lime', hex: '#b6e617', price: 80 },
  { id: 'white', name: 'Snow', hex: '#f1f4f8', price: 80 },
  { id: 'black', name: 'Shadow', hex: '#2a2a35', price: 100 },
  { id: 'gold', name: 'Gold', hex: '#ffc933', price: 200 },
]

/** Cosmetic effects: tint the weapon trail and add an aura. `hue` cycles for rainbow. */
export const EFFECTS = [
  { id: 'none', name: 'None', price: 0, trail: '#ffffff', aura: null },
  { id: 'fire', name: 'Fire', price: 200, trail: '#ff9a2e', aura: '#ff5a1f' },
  { id: 'ice', name: 'Ice', price: 200, trail: '#9fe8ff', aura: '#c9f3ff' },
  { id: 'electric', name: 'Electric', price: 250, trail: '#fff25c', aura: '#fff25c' },
  { id: 'shadow', name: 'Shadow', price: 250, trail: '#8a6bd6', aura: '#3c2a63' },
  { id: 'rainbow', name: 'Rainbow', price: 400, trail: 'rainbow', aura: 'rainbow' },
]

export const byId = (list, id) => list.find(x => x.id === id)
export const colorHex = id => (byId(COLORS, id) || COLORS[0]).hex

// ───────────── arenas ─────────────
const P = (x, y, w, extra) => ({ x, y, w, h: 44, ...extra })
const S = (x, y, w, h, extra) => ({ x, y, w, h, ...extra })

const VOID = { kind: 'void', y: H + 60, damage: 25 }
const LAVA = { kind: 'lava', y: 640, damage: 35 }

/**
 * Each arena has two layouts. Platforms are solid blocks (44px thick, so a falling fighter can never skip past
 * one in a single step). `move` makes a platform slide sideways. Spikes sit on platforms; with a `period` they
 * retract and flare on a timer. Spawns stand on a platform's top surface.
 */
export const ARENAS = {
  floating: {
    id: 'floating', name: 'Floating Platforms', hazard: 'Bottomless drop', pit: VOID, ice: false,
    sky: ['#3fb6ff', '#bdeaff'], plat: { body: '#243a63', top: '#5be0ff', edge: '#163052' }, decor: 'clouds',
    layouts: [
      { platforms: [P(420, 470, 440), P(60, 380, 220), P(1000, 380, 220), P(540, 300, 200)], spikes: [], spawns: [{ x: 170, y: 380 }, { x: 1110, y: 380 }] },
      { platforms: [P(150, 480, 360), P(770, 480, 360), P(560, 350, 160, { move: { range: 100, speed: 1.1 } }), P(40, 340, 180), P(1060, 340, 180)], spikes: [], spawns: [{ x: 330, y: 480 }, { x: 950, y: 480 }] },
    ],
  },
  forest: {
    id: 'forest', name: 'Forest Arena', hazard: 'Thorn bushes', pit: VOID, ice: false,
    sky: ['#79d672', '#d8f7b0'], plat: { body: '#4b3320', top: '#4cc23a', edge: '#2c1c10' }, decor: 'forest',
    layouts: [
      { platforms: [P(0, 520, 480), P(800, 520, 480), P(520, 400, 240), P(140, 350, 220), P(920, 350, 220)], spikes: [S(330, 496, 70, 24), S(880, 496, 70, 24)], spawns: [{ x: 200, y: 520 }, { x: 1080, y: 520 }] },
      { platforms: [P(0, 500, 360), P(920, 500, 360), P(440, 430, 400), P(60, 330, 200), P(1020, 330, 200), P(560, 300, 160)], spikes: [S(450, 406, 50, 24), S(790, 406, 50, 24)], spawns: [{ x: 160, y: 500 }, { x: 1120, y: 500 }] },
    ],
  },
  lava: {
    id: 'lava', name: 'Lava Arena', hazard: 'Lava and fire jets', pit: LAVA, ice: false,
    sky: ['#3a0d0d', '#c1431a'], plat: { body: '#2a1a1a', top: '#ff7a1f', edge: '#120808' }, decor: 'volcano',
    layouts: [
      { platforms: [P(80, 500, 300), P(900, 500, 300), P(490, 430, 300), P(570, 280, 140)], spikes: [S(600, 370, 80, 60, { period: 4 })], spawns: [{ x: 230, y: 500 }, { x: 1050, y: 500 }] },
      { platforms: [P(0, 520, 260), P(1020, 520, 260), P(380, 460, 200), P(700, 460, 200), P(540, 330, 200)], spikes: [S(440, 400, 60, 60, { period: 3.5 }), S(780, 400, 60, 60, { period: 3.5, phase: 1.75 })], spawns: [{ x: 130, y: 520 }, { x: 1150, y: 520 }] },
    ],
  },
  ice: {
    id: 'ice', name: 'Ice Arena', hazard: 'Slippery floor, icicles', pit: VOID, ice: true,
    sky: ['#9fd8ff', '#eaf8ff'], plat: { body: '#5d86b8', top: '#e9fbff', edge: '#3a5f8f' }, decor: 'snow',
    layouts: [
      { platforms: [P(200, 500, 880), P(60, 370, 240), P(980, 370, 240), P(520, 330, 240)], spikes: [S(330, 476, 50, 24), S(900, 476, 50, 24)], spawns: [{ x: 420, y: 500 }, { x: 860, y: 500 }] },
      { platforms: [P(100, 520, 380), P(800, 520, 380), P(480, 440, 320), P(100, 340, 170), P(1010, 340, 170)], spikes: [S(250, 496, 50, 24), S(980, 496, 50, 24)], spawns: [{ x: 330, y: 520 }, { x: 950, y: 520 }] },
    ],
  },
  night: {
    id: 'night', name: 'Night Battlefield', hazard: 'Grave spikes', pit: VOID, ice: false,
    sky: ['#2a1450', '#7a4aa8'], plat: { body: '#0a0f1a', top: '#ff9a1f', edge: '#000000' }, decor: 'night',
    layouts: [
      { platforms: [P(40, 530, 360), P(880, 530, 360), P(420, 400, 440), P(160, 330, 200), P(920, 330, 200)], spikes: [S(260, 506, 50, 24), S(970, 506, 50, 24)], spawns: [{ x: 150, y: 530 }, { x: 1130, y: 530 }] },
      { platforms: [P(0, 500, 300), P(980, 500, 300), P(380, 440, 200), P(700, 440, 200), P(540, 300, 200)], spikes: [S(215, 476, 50, 24), S(1015, 476, 50, 24)], spawns: [{ x: 100, y: 500 }, { x: 1180, y: 500 }] },
    ],
  },
  sky: {
    id: 'sky', name: 'Sky Arena', hazard: 'Moving platforms', pit: VOID, ice: false,
    sky: ['#5aa9ff', '#fff0c4'], plat: { body: '#7b8aa6', top: '#ffffff', edge: '#4e5b78' }, decor: 'sky',
    layouts: [
      { platforms: [P(100, 480, 260), P(920, 480, 260), P(500, 400, 220, { move: { range: 170, speed: 1 } }), P(540, 260, 200)], spikes: [], spawns: [{ x: 230, y: 480 }, { x: 1050, y: 480 }] },
      { platforms: [P(60, 520, 220), P(1000, 520, 220), P(380, 430, 160, { move: { range: 120, speed: 1.3 } }), P(740, 430, 160, { move: { range: 120, speed: 1.3, phase: Math.PI } }), P(560, 300, 160)], spikes: [], spawns: [{ x: 170, y: 520 }, { x: 1110, y: 520 }] },
    ],
  },
}
export const ARENA_ORDER = ['floating', 'forest', 'lava', 'ice', 'night', 'sky']

export function getLayout(arenaId, variant = 0) {
  const arena = ARENAS[arenaId] || ARENAS.floating
  const layouts = arena.layouts
  const v = Number.isInteger(variant) ? ((variant % layouts.length) + layouts.length) % layouts.length : 0
  return { arena, layout: layouts[v], variant: v }
}
