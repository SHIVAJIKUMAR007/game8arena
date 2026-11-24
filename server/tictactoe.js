// Tic Tac Toe for two players: a best-of series. Pure rules, no sockets or timers: the hub calls act(), leave() and
// tick(now) and sends each player view(id). Marks swap every game so both players get to start.
//
//   play (players take turns) -> between (a short pause showing the result) -> play ... -> over (series decided)
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 2
export const BEST_OF = [1, 3, 5]
export const FIRST_MOVES = ['random', 'host', 'guest']
export const BETWEEN_MS = 2500

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

export const defaultSettings = () => ({ bestOf: 3, first: 'random' })

/** @param {(string|null)[]} board nine cells of 'X', 'O' or null. Returns { mark, line } for a win, 'draw', or null while play goes on. */
export function judge(board) {
  for (const line of LINES) {
    const [a, b, c] = line
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { mark: board[a], line }
  }
  return board.every(Boolean) ? 'draw' : null
}

/** Wins needed to take a best-of series. */
export const winsNeeded = bestOf => Math.floor(bestOf / 2) + 1

/**
 * @param {{ players: {id: string, name: string}[], settings?: { bestOf?: number, first?: string }, random?: () => number, now?: number }} opts
 *   players[0] is the host.
 */
export function createTicTacToe({ players, settings = {}, random = Math.random, now = 0 }) {
  if (players.length !== 2) throw new Error('Tic Tac Toe needs exactly two players.')
  const bestOf = BEST_OF.includes(settings.bestOf) ? settings.bestOf : defaultSettings().bestOf
  const first = FIRST_MOVES.includes(settings.first) ? settings.first : 'random'
  const [host, guest] = players
  const startsFirst = first === 'host' ? host.id : first === 'guest' ? guest.id : players[random() < 0.5 ? 0 : 1].id
  const names = { [host.id]: host.name, [guest.id]: guest.name }
  const g = {
    phase: 'play', // 'play' | 'between' | 'over'
    board: Array(9).fill(null),
    game: 1,
    xId: startsFirst, // who plays X (and moves first) this game
    turnId: startsFirst,
    scores: { [host.id]: 0, [guest.id]: 0 },
    draws: 0,
    last: null, // result of the game that just ended: { winnerId | null, line }
    seriesWinnerId: null,
    forfeit: false,
    nextAt: 0,
    now,
    dirty: true,
  }
  const ids = [host.id, guest.id]
  const other = id => (id === host.id ? guest.id : host.id)
  const markOf = id => (id === g.xId ? 'X' : 'O')

  function finishGame(result) {
    if (result === 'draw') {
      g.draws += 1
      g.last = { winnerId: null, line: null }
    } else {
      const winnerId = result.mark === 'X' ? g.xId : other(g.xId)
      g.scores[winnerId] += 1
      g.last = { winnerId, line: result.line }
    }
    const [a, b] = ids.map(id => g.scores[id])
    const played = g.game
    if (a >= winsNeeded(bestOf) || b >= winsNeeded(bestOf) || played >= bestOf) {
      g.phase = 'over'
      g.seriesWinnerId = a === b ? null : a > b ? ids[0] : ids[1]
    } else {
      g.phase = 'between'
      g.nextAt = g.now + BETWEEN_MS
    }
  }
  return {
    get phase() { return g.phase },
    get dirty() { return g.dirty },
    clearDirty() { g.dirty = false },

    /** @returns {{ error?: string }} */
    act(id, msg, t = g.now) {
      g.now = t
      if (!ids.includes(id)) return { error: 'You are not in this game.' }
      if (!msg || msg.a !== 'move') return { error: 'Unknown action.' }
      if (g.phase !== 'play') return { error: 'Wait for the next game.' }
      if (g.turnId !== id) return { error: 'It is not your turn.' }
      const cell = msg.cell
      if (!Number.isInteger(cell) || cell < 0 || cell > 8) return { error: 'Pick one of the nine squares.' }
      if (g.board[cell]) return { error: 'That square is taken.' }
      g.board[cell] = markOf(id)
      g.turnId = other(id)
      const result = judge(g.board)
      if (result) finishGame(result)
      g.dirty = true
      return {}
    },

    /** Starts the next game once the pause is over. */
    tick(t) {
      g.now = t
      if (g.phase === 'between' && t >= g.nextAt) {
        g.game += 1
        g.board = Array(9).fill(null)
        g.xId = other(g.xId) // marks swap so the other player starts
        g.turnId = g.xId
        g.last = null
        g.phase = 'play'
        g.dirty = true
      }
    },

    /** A player left mid-series: the other one takes it. */
    leave(id, t = g.now) {
      g.now = t
      if (g.phase === 'over' || !ids.includes(id)) return
      g.phase = 'over'
      g.forfeit = true
      g.seriesWinnerId = other(id)
      g.dirty = true
    },

    abort() {
      if (g.phase === 'over') return
      g.phase = 'over'
      g.seriesWinnerId = null
      g.dirty = true
    },

    /** What one player may see: everything is public, but "you" and "them" are filled in for that player. */
    view(id, t = g.now) {
      const them = other(id)
      return {
        t: 'tstate',
        phase: g.phase,
        board: [...g.board],
        game: g.game,
        bestOf,
        turnId: g.turnId,
        you: { id, name: names[id], mark: markOf(id), score: g.scores[id] },
        them: { id: them, name: names[them], mark: markOf(them), score: g.scores[them] },
        draws: g.draws,
        last: g.last,
        seriesWinnerId: g.seriesWinnerId,
        forfeit: g.forfeit,
        left: g.phase === 'between' ? Math.max(0, Math.ceil((g.nextAt - t) / 1000)) : 0,
      }
    },
  }
}
