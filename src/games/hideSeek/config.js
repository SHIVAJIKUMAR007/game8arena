// Content for the landing page and the how-to-play tips. Mafia Hunt has no hints or undo, and no solo levels.
export const config = {
  hints: 0,
  undos: 0,
  achievements: [],

  tutorial: [
    { icon: '🕵️', title: 'One mafia, everyone else hides', body: 'When the game starts, one random player becomes the mafia and carries a gun. Everyone else is a villager and gets 15 seconds to hide before the mafia is let loose.' },
    { icon: '🏠', title: 'Use the walls', body: 'There are five big maps, from crates and houses to a maze and a forest. Walls block your view and the bullets, so duck behind one and the mafia cannot see you until they come round the corner. The small map in the corner shows where the walls are.' },
    { icon: '🔦', title: 'You only see what is near', body: 'Everything outside a small circle around you is dark, for the mafia too. Players you cannot see are not shown at all.' },
    { icon: '🔫', title: 'Shoot to win', body: 'The mafia aims with the mouse and clicks or presses Space to fire. A hit takes a villager out. Take everyone out before the time runs down and the mafia wins.' },
    { icon: '⏱️', title: 'Survive the clock', body: 'The host picks how long a round lasts. If even one villager is still alive when it ends, the villagers win.' },
    { icon: '📶', title: 'Play on the same Wi-Fi', body: 'One computer runs the game server. Everyone else opens its address on their phone or laptop and joins with the room code.' },
  ],
}
