// Content for the landing page and the how-to-play tips. Stickman Fight has its own coins and unlocks, so it
// does not use the shared hints, undo or achievements.
export const config = {
  hints: 0,
  undos: 0,
  achievements: [],

  tutorial: [
    { icon: '🏃', title: 'Move, jump and double jump', body: 'A and D run, W jumps, and pressing W again in the air gives a second jump. Platforms are solid, so jump around them, not through them. Fall into the pit or the lava and you lose health, then respawn.' },
    { icon: '⚔️', title: 'Attack and block', body: 'F swings your weapon. A swing only hurts once, and only if it connects. Hold S to block hits that come from the front. Block too much and your guard breaks, which leaves you stunned.' },
    { icon: '★', title: 'Use your special', body: 'G fires your weapon’s special: an energy wave, a lightning strike, a ground smash, a spin, a dash, a volley or a shield. Each one has a cooldown, shown by the circle next to your health bar.' },
    { icon: '🪙', title: 'Win coins and unlock gear', body: 'Beat the computer to earn coins and stars, then spend them on new weapons, skins, colours, effects and weapon designs. Two players can also fight each other on one keyboard, with a rematch button.' },
  ],
}
