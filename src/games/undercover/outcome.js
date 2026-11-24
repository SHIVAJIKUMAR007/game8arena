// Who won, from one player's final view. Everyone on the winning side wins, including civilians who were voted out.
export const ROLE_NAMES = { civilian: 'Civilian', undercover: 'Undercover', mrwhite: 'Mr. White' }

export function iWon(view) {
  const role = view.you.role
  switch (view.winner) {
    case 'civilians': return role === 'civilian'
    case 'undercover': return role === 'undercover'
    case 'infiltrators': return role === 'undercover' || role === 'mrwhite'
    case 'mrwhite': return view.winners.includes(view.you.id)
    default: return false
  }
}

export function winnerTitle(view) {
  switch (view.winner) {
    case 'civilians': return 'Civilians win!'
    case 'undercover': return 'Undercover wins!'
    case 'infiltrators': return 'Undercover and Mr. White win!'
    case 'mrwhite': return 'Mr. White wins!'
    default: return 'Game over'
  }
}
