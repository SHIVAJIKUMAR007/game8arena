import { lazy } from 'react'

export default {
  id: 'hideseek',
  title: 'Mafia Hunt',
  emoji: '🕵️',
  category: 'Multiplayer',
  players: { min: 2, max: 9 },
  color: '#c0392b',
  description: 'A hide and seek game for friends on the same Wi-Fi. One player is the mafia with a gun, the rest hide and survive until the timer ends.',
  controls: 'Move with WASD or the arrow keys, aim with the mouse, click or press Space to shoot. On touch screens use the stick to move and tap to shoot.',
  daily: false,
  component: lazy(() => import('./HideSeekGame')),
}
