import { lazy } from 'react'

export default {
  id: 'multiverse',
  title: 'Multiverse Fighter',
  emoji: '🥋',
  category: 'Action',
  categories: ['Action', 'Multiplayer'],
  color: '#12727a',
  description: 'A fast one-on-one brawler with twelve heroes and warlords from two universes. Beat the computer through ever tougher levels, or fight a friend online in a room you set up with a five-letter code.',
  controls: 'A and D move, W jumps, S crouches and blocks, J punches, I throws a heavy punch, L kicks, K is a flying kick and Space fires your special when the cyan bar is full. P pauses against the computer. Phones get an on-screen pad and buttons.',
  daily: false,
  component: lazy(() => import('./MultiverseGame')),
}
