// Multiverse Fighter roster: the twelve fighters, their stats, colours, props and specials, plus the helpers that turn
// a stat line and upgrade levels into real numbers. Pure data and maths, shared by the sim, renderer and screens.
// The designs are original, stylised takes on the characters, not copies of any studio artwork.

/** @typedef {{ id:string, name:string, universe:'MCU'|'Dune', power:number, health:number, speed:number, price:number,
 *   scale:number, prop:string, colors:{skin:string, primary:string, secondary:string, accent:string, hair:string},
 *   special:{ kind:string, name:string, desc:string } }} Fighter */

/** @type {Fighter[]} */
export const ROSTER = [
  {
    id: 'cap', name: 'Captain America', universe: 'MCU', power: 6, health: 7, speed: 5, price: 0, scale: 1, prop: 'shield',
    colors: { skin: '#f2c9a0', primary: '#27408b', secondary: '#c8202f', accent: '#f4f4f4', hair: '#d9b54a' },
    special: { kind: 'shield', name: 'Shield Throw', desc: 'Hurls the shield. It bounces back and hits again.' },
  },
  {
    id: 'ironman', name: 'Iron Man', universe: 'MCU', power: 7, health: 6, speed: 5, price: 400, scale: 1.02, prop: 'reactor',
    colors: { skin: '#b8202a', primary: '#b8202a', secondary: '#e8b52e', accent: '#7ff3ff', hair: '#e8b52e' },
    special: { kind: 'beam', name: 'Repulsor Beam', desc: 'A sustained beam from both palms. Hold your ground.' },
  },
  {
    id: 'thor', name: 'Thor', universe: 'MCU', power: 8, health: 7, speed: 4, price: 450, scale: 1.08, prop: 'cape',
    colors: { skin: '#f0c19a', primary: '#2a3a55', secondary: '#9aa4b2', accent: '#8fd8ff', hair: '#e5c35a' },
    special: { kind: 'storm', name: 'Lightning Storm', desc: 'Three bolts strike where you stand. Keep moving.' },
  },
  {
    id: 'panther', name: 'Black Panther', universe: 'MCU', power: 6, health: 5, speed: 8, price: 300, scale: 1, prop: 'ears',
    colors: { skin: '#6b4a38', primary: '#17171d', secondary: '#4b3a6f', accent: '#b9b9d6', hair: '#17171d' },
    special: { kind: 'chain', name: 'Claw Flurry', desc: 'Dashes in and slashes five times.' },
  },
  {
    id: 'hulk', name: 'Hulk', universe: 'MCU', power: 10, health: 10, speed: 2, price: 500, scale: 1.3, prop: 'bulk',
    colors: { skin: '#4fa83d', primary: '#4fa83d', secondary: '#6b3f8c', accent: '#8de06a', hair: '#1c2e18' },
    special: { kind: 'smash', name: 'Ground Smash', desc: 'Slams the floor. Shockwaves roll both ways. Jump them.' },
  },
  {
    id: 'spidey', name: 'Spider-Man', universe: 'MCU', power: 5, health: 5, speed: 9, price: 250, scale: 0.96, prop: 'web',
    colors: { skin: '#c8202f', primary: '#c8202f', secondary: '#27408b', accent: '#f4f4f4', hair: '#c8202f' },
    special: { kind: 'web', name: 'Web Pull', desc: 'Yanks the target in, then an uppercut.' },
  },
  {
    id: 'paul', name: 'Paul Atreides', universe: 'Dune', power: 6, health: 6, speed: 7, price: 0, scale: 1, prop: 'hood',
    colors: { skin: '#e8c39e', primary: '#3c4a52', secondary: '#7a8a8f', accent: '#5fd0ff', hair: '#2a1d16' },
    special: { kind: 'chain', name: 'Weirding Way', desc: 'A rapid six-strike chain at close range.' },
  },
  {
    id: 'chani', name: 'Chani', universe: 'Dune', power: 5, health: 5, speed: 9, price: 150, scale: 0.94, prop: 'wrap',
    colors: { skin: '#c99a76', primary: '#8a6a45', secondary: '#4a3a28', accent: '#6bd0ff', hair: '#2a1a12' },
    special: { kind: 'lunge', name: 'Crysknife Lunge', desc: 'A long lunge. A hit leaves a bleed.' },
  },
  {
    id: 'stilgar', name: 'Stilgar', universe: 'Dune', power: 6, health: 7, speed: 5, price: 100, scale: 1.02, prop: 'turban',
    colors: { skin: '#b08560', primary: '#4a3a2e', secondary: '#2e2620', accent: '#6bd0ff', hair: '#6b6b6b' },
    special: { kind: 'counter', name: 'Counter Stance', desc: 'Take the next hit and throw it back harder.' },
  },
  {
    id: 'duncan', name: 'Duncan Idaho', universe: 'Dune', power: 7, health: 6, speed: 6, price: 200, scale: 1.03, prop: 'sword',
    colors: { skin: '#e6b998', primary: '#2f3a44', secondary: '#b9332a', accent: '#d8dde2', hair: '#3a2a1c' },
    special: { kind: 'combo', name: 'Parry Combo', desc: 'Opens with a parry. If it lands, the combo follows.' },
  },
  {
    id: 'feyd', name: 'Feyd-Rautha', universe: 'Dune', power: 8, health: 6, speed: 7, price: 350, scale: 1.0, prop: 'blades',
    colors: { skin: '#d8d0c8', primary: '#16161a', secondary: '#5a5a66', accent: '#d9dde2', hair: '#d8d0c8' },
    special: { kind: 'spin', name: 'Blade Dance', desc: 'A spinning flurry that heals you as it cuts.' },
  },
  {
    id: 'baron', name: 'Baron Harkonnen', universe: 'Dune', power: 8, health: 9, speed: 2, price: 400, scale: 1.32, prop: 'suspensor',
    colors: { skin: '#e4dcd2', primary: '#1d1d22', secondary: '#4a4a55', accent: '#ff6a4a', hair: '#e4dcd2' },
    special: { kind: 'grav', name: 'Suspensor Slam', desc: 'Pulls the target up, then slams them down, stunned.' },
  },
]

export const ROSTER_BY_ID = Object.freeze(Object.fromEntries(ROSTER.map(f => [f.id, f])))
export const START_UNLOCKED = Object.freeze(['cap', 'paul'])
export const fighterById = id => ROSTER_BY_ID[id] || ROSTER[0]
export const isFighterId = id => typeof id === 'string' && Object.hasOwn(ROSTER_BY_ID, id)

export const MAX_UPGRADE = 8
/** Coins for the next upgrade level (0 → 1 costs 50). */
export const upgradeCost = level => Math.round(50 * Math.pow(1.55, level) / 5) * 5

/** @param {Fighter} f @param {{power?:number, health?:number}} [up] @param {number} [aiScale] */
export function statsFor(f, up = {}, aiScale = 1) {
  const pl = Math.min(MAX_UPGRADE, Math.max(0, up.power | 0))
  const hl = Math.min(MAX_UPGRADE, Math.max(0, up.health | 0))
  return {
    hpMax: Math.round((520 + 60 * f.health) * (1 + 0.1 * hl) * aiScale),
    dmgMult: (0.7 + 0.1 * f.power) * (1 + 0.08 * pl) * aiScale,
    walk: 2.6 + 0.4 * f.speed,
    jump: 13.5 + 0.2 * f.speed,
  }
}

export const BELTS = [
  { id: 'white', label: 'White', color: '#f4f4f4' },
  { id: 'yellow', label: 'Yellow', color: '#f2c230' },
  { id: 'orange', label: 'Orange', color: '#f08a24' },
  { id: 'green', label: 'Green', color: '#3fae4a' },
  { id: 'blue', label: 'Blue', color: '#2f7be0' },
  { id: 'brown', label: 'Brown', color: '#8a5a32' },
  { id: 'black', label: 'Black', color: '#1b1b1f' },
]
/** Belt for a level: a new belt every two levels, capped at black. */
export const beltIndex = level => Math.min(BELTS.length - 1, Math.floor((Math.max(1, level) - 1) / 2))
