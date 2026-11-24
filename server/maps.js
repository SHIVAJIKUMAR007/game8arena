// The arenas. Every map is 2100 x 1400 (about three times the original area): walls to hide behind, a spot in
// the middle for the mafia and eight start spots for villagers around the edges.
// Walls are axis-aligned rectangles { x, y, w, h }. Anything that would sit on a start spot is removed when a map
// is built, and the tests check that every start spot can reach every other.

export const WORLD = { w: 2100, h: 1400 }

const MAFIA_SPAWN = { x: 1050, y: 700 }
const VILLAGER_SPAWNS = [
  { x: 80, y: 80 }, { x: 2020, y: 80 }, { x: 80, y: 1320 }, { x: 2020, y: 1320 },
  { x: 700, y: 70 }, { x: 1400, y: 70 }, { x: 700, y: 1330 }, { x: 1400, y: 1330 },
]
const CLEAR = 70 // keep this much room around every start spot

const rect = (x, y, w, h) => ({ x, y, w, h })

const nearSpawn = wall =>
  [MAFIA_SPAWN, ...VILLAGER_SPAWNS].some(
    s => s.x > wall.x - CLEAR && s.x < wall.x + wall.w + CLEAR && s.y > wall.y - CLEAR && s.y < wall.y + wall.h + CLEAR,
  )

/** Small deterministic generator, so the forest is the same every time the server starts. */
function lcg(seed) {
  let a = seed
  return () => ((a = (a * 16807) % 2147483647) - 1) / 2147483646
}

function build(id, name, walls) {
  return {
    id, name, world: WORLD, mafiaSpawn: MAFIA_SPAWN, villagerSpawns: VILLAGER_SPAWNS,
    walls: walls.filter(w => !nearSpawn(w) && w.x >= 0 && w.y >= 0 && w.x + w.w <= WORLD.w && w.y + w.h <= WORLD.h),
  }
}

// 1. Crates: the original layout, stretched out, with extra crates in the gaps.
const ORIGINAL = [
  [200, 150, 160, 100], [840, 150, 160, 100], [540, 90, 120, 60], [540, 650, 120, 60], [200, 560, 160, 100], [840, 560, 160, 100],
  [380, 300, 100, 60], [720, 300, 100, 60], [380, 440, 100, 60], [720, 440, 100, 60], [100, 330, 60, 140], [1040, 330, 60, 140],
  [260, 340, 40, 120], [900, 340, 40, 120],
]
const crates = [
  ...ORIGINAL.map(([x, y, w, h]) => rect(Math.round(x * 1.75), Math.round(y * 1.75), Math.round(w * 1.75), Math.round(h * 1.75))),
  rect(1500, 250, 120, 120), rect(1700, 520, 100, 160), rect(1480, 900, 160, 100), rect(300, 1100, 120, 120), rect(1750, 1150, 140, 100),
  rect(900, 1150, 100, 100), rect(1250, 380, 80, 80), rect(1180, 980, 120, 80),
]

// 2. Town: blocks of houses with streets between them and an open square in the middle.
const town = []
for (let col = 0; col < 5; col++) {
  for (let row = 0; row < 3; row++) {
    const w = 240 + ((col + row) % 2) * 60
    const h = 170 + ((col * 2 + row) % 3) * 30
    town.push(rect(150 + col * 390, 170 + row * 420, w, h))
  }
}
town.push(rect(560, 620, 60, 160), rect(1480, 620, 60, 160), rect(900, 340, 300, 40), rect(900, 1020, 300, 40))

// 3. Maze: two long bars split the arena into three corridors; crates and short walls make corners.
const maze = [
  rect(0, 400, 1500, 40), rect(600, 960, 1500, 40),
  rect(500, 440, 40, 340), rect(1560, 620, 40, 340), rect(1000, 440, 40, 150), rect(1000, 810, 40, 150),
  rect(250, 520, 140, 40), rect(260, 780, 40, 140), rect(700, 560, 40, 200), rect(760, 840, 200, 40),
  rect(1250, 540, 40, 200), rect(1300, 830, 200, 40), rect(1750, 480, 200, 40), rect(1800, 760, 40, 160),
  rect(250, 160, 200, 60), rect(850, 200, 40, 160), rect(1200, 150, 200, 60), rect(1700, 200, 60, 160), rect(1500, 300, 160, 40),
  rect(300, 1120, 200, 60), rect(900, 1100, 40, 160), rect(1200, 1150, 200, 60), rect(1650, 1120, 60, 160), rect(1800, 1200, 160, 40),
]

// 4. Plaza: a ring of pillars around the middle, four corner halls and long benches along the sides.
const plaza = [
  rect(180, 180, 280, 60), rect(180, 180, 60, 240), rect(1640, 180, 280, 60), rect(1860, 180, 60, 240),
  rect(180, 1160, 280, 60), rect(180, 980, 60, 240), rect(1640, 1160, 280, 60), rect(1860, 980, 60, 240),
  rect(900, 160, 300, 50), rect(900, 1190, 300, 50), rect(120, 640, 50, 120), rect(1930, 640, 50, 120),
]
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2
  plaza.push(rect(Math.round(1050 + Math.cos(a) * 380 - 30), Math.round(700 + Math.sin(a) * 300 - 30), 60, 60))
}
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 8
  plaza.push(rect(Math.round(1050 + Math.cos(a) * 720 - 40), Math.round(700 + Math.sin(a) * 520 - 40), 80, 80))
}

// 5. Forest: lots of trees, scattered with room to move between them.
const forest = []
{
  const rnd = lcg(20240601)
  for (let tries = 0; tries < 4000 && forest.length < 80; tries++) {
    const size = 44 + Math.floor(rnd() * 3) * 14
    const t = rect(Math.floor(60 + rnd() * (WORLD.w - 120 - size)), Math.floor(60 + rnd() * (WORLD.h - 120 - size)), size, size)
    if (forest.every(o => t.x > o.x + o.w + 110 || t.x + t.w < o.x - 110 || t.y > o.y + o.h + 110 || t.y + t.h < o.y - 110)) forest.push(t)
  }
  forest.push(rect(300, 300, 220, 140), rect(1500, 1000, 220, 140), rect(1550, 260, 140, 220), rect(380, 880, 140, 220)) // a few ruins
}

export const MAPS = [
  build('crates', 'Crates', crates),
  build('town', 'Town', town),
  build('maze', 'Maze', maze),
  build('plaza', 'Plaza', plaza),
  build('forest', 'Forest', forest),
]

export const MAP_IDS = MAPS.map(m => m.id)
export const getMap = id => MAPS.find(m => m.id === id) || MAPS[0]
