// Content for the landing page. Bubble Surge is a level game with stars, but no hints or undo.
export const config = {
  hints: 0,
  undos: 0,
  achievements: [],

  tutorial: [
    { icon: '🎯', title: 'Aim and fire from the centre', body: 'The shooter sits in the middle of the field and turns all the way round. Move the mouse, or drag a finger, to aim, then click or let go to fire. The dotted guide shows the path, including up to two bounces off the walls.' },
    { icon: '💥', title: 'Match three or more', body: 'A bubble sticks to the first bubble it touches. Join three or more of the same colour and they pop. Anything left hanging with no link to the edge of the field drops for extra points.' },
    { icon: '🔄', title: 'Swap, bombs and rainbows', body: 'Click the ring or press Space to swap the bubble in the shooter with the next one. Pop on five shots to fill the meter and the next bubble becomes a bomb. A rainbow bubble takes the colour of whatever it lands next to.' },
    { icon: '⚠️', title: 'Don’t let the field reach you', body: 'After several shots in a row without a pop, a new layer of bubbles creeps in around the hole. The red arc on the ring fills as it gets close. If any bubble touches the ring, the game is over.' },
  ],
}
