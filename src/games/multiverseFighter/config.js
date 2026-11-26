// Content for the landing page and the how-to-play tips. Multiverse Fighter has its own coins and unlocks, so it does
// not use the shared hints, undo or achievements.
export const config = {
  hints: 0,
  undos: 0,
  achievements: [],

  tutorial: [
    { icon: '🥋', title: 'Move, jump and block', body: 'A and D walk, W jumps, and S crouches into a guard. A guard cuts damage from hits that come from the front, but a hit from behind goes straight through.' },
    { icon: '👊', title: 'Mix your attacks', body: 'J is a quick punch, I is a slow heavy punch, L is a kick and K is a flying kick. Chain hits for a combo, but later hits in a combo do a little less each.' },
    { icon: '⚡', title: 'Charge your special', body: 'Landing and taking hits fills the cyan bar. When it is full, press Space for your fighter’s own special: a thrown shield, a beam, a lightning storm and more.' },
    { icon: '🪙', title: 'Win coins and unlock fighters', body: 'Wins pay 30 coins and XP, losses pay 10. Spend coins on new fighters and on Power and Health upgrades, then take on the computer or a friend online.' },
  ],
}
