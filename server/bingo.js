// Bingo Royale: every player arranges the numbers 1-25 on their own 5x5 board, then players take turns, clockwise, to
// announce one unused number. An announced number is marked on every board. The first player to complete 5 of the 12
// lines (5 rows, 5 columns, 2 diagonals) wins. Pure rules, no sockets or timers: the hub calls act(), leave() and
// tick(now) and sends everyone view().
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8
export const SIZE = 5
export const CELLS = SIZE * SIZE
export const WIN_LINES = 5
export const TURN_SECONDS = [0, 15, 30, 60] // 0 = no limit

export const defaultSettings = () => ({ turnSeconds: 30 })

/** The 12 lines of a 5x5 board as lists of cell indexes: 5 rows, 5 columns, then the two diagonals. */
export const LINES = (() => {
  const lines = []
  for (let r = 0; r < SIZE; r++) lines.push(Array.from({ length: SIZE }, (_, c) => r * SIZE + c))
  for (let c = 0; c < SIZE; c++) lines.push(Array.from({ length: SIZE }, (_, r) => r * SIZE + c))
  lines.push(Array.from({ length: SIZE }, (_, i) => i * SIZE + i))
  lines.push(Array.from({ length: SIZE }, (_, i) => i * SIZE + (SIZE - 1 - i)))
  return lines
})()

/** True for an array of exactly the numbers 1-25, each once, in any order. */
export function isValidBoard(cells) {
  if (!Array.isArray(cells) || cells.length !== CELLS) return false
  const seen = new Set()
  for (const n of cells) {
    if (!Number.isInteger(n) || n < 1 || n > CELLS || seen.has(n)) return false
    seen.add(n)
  }
  return true
}

/** A random arrangement of 1-25 (Fisher-Yates). */
export function randomBoard(random = Math.random) {
  const cells = Array.from({ length: CELLS }, (_, i) => i + 1)
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[cells[i], cells[j]] = [cells[j], cells[i]]
  }
  return cells
}

/** Indexes (into LINES) of the lines whose five numbers have all been announced. @param {Set<number>|number[]} called */
export function completedLines(board, called) {
  const set = called instanceof Set ? called : new Set(called)
  const done = []
  LINES.forEach((line, i) => {
    if (line.every(cell => set.has(board[cell]))) done.push(i)
  })
  return done
}

/**
 * @param {{ players: { id: string, name: string, board: number[] }[], settings?: { turnSeconds?: number }, random?: () => number, now?: number }} opts
 *   players are in clockwise order.
 */
export function createBingo({ players, settings = {}, random = Math.random, now = 0 }) {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) throw new Error(`Bingo needs ${MIN_PLAYERS}-${MAX_PLAYERS} players.`)
  for (const p of players) if (!isValidBoard(p.board)) throw new Error('Every board must hold the numbers 1-25 once.')
  const turnSeconds = TURN_SECONDS.includes(settings.turnSeconds) ? settings.turnSeconds : defaultSettings().turnSeconds
  const g = {
    phase: 'play', // 'play' | 'over'
    players: players.map(p => ({ id: p.id, name: p.name, board: [...p.board], active: true, lines: [] })),
    called: [], // { n, by, auto }
    calledSet: new Set(),
    turn: 0, // index into players
    deadline: turnSeconds ? now + turnSeconds * 1000 : 0,
    winners: [],
    forfeit: false,
    dirty: true,
  }
  const find = id => g.players.find(p => p.id === id)
  const active = () => g.players.filter(p => p.active)

  /** Passes the turn to the next player clockwise who is still in the game. */
  function advance(t) {
    for (let i = 1; i <= g.players.length; i++) {
      const next = (g.turn + i) % g.players.length
      if (g.players[next].active) {
        g.turn = next
        break
      }
    }
    g.deadline = turnSeconds ? t + turnSeconds * 1000 : 0
  }

  function finish(winners, forfeit = false) {
    g.phase = 'over'
    g.winners = winners.map(p => p.id)
    g.forfeit = forfeit
    g.deadline = 0
  }

  function call(n, by, auto, t) {
    g.called.push({ n, by, auto })
    g.calledSet.add(n)
    for (const p of g.players) p.lines = completedLines(p.board, g.calledSet)
    // Whoever has 5 lines wins. If several reach it with the same number, the one with the most lines wins; equals share.
    const reached = active().filter(p => p.lines.length >= WIN_LINES)
    if (reached.length) {
      const best = Math.max(...reached.map(p => p.lines.length))
      finish(reached.filter(p => p.lines.length === best))
    } else if (g.calledSet.size >= CELLS) {
      // Every number is out and nobody has 5 lines (only possible when players have left): most lines wins.
      const best = Math.max(...active().map(p => p.lines.length))
      finish(active().filter(p => p.lines.length === best))
    } else advance(t)
    g.dirty = true
  }

  const free = () => Array.from({ length: CELLS }, (_, i) => i + 1).filter(n => !g.calledSet.has(n))

  return {
    get phase() { return g.phase },
    get dirty() { return g.dirty },
    clearDirty() { g.dirty = false },

    /** @returns {{ error?: string }} */
    act(id, msg, t = 0) {
      const me = find(id)
      if (!me || !me.active) return { error: 'You are not in this game.' }
      if (!msg || msg.a !== 'call') return { error: 'Unknown action.' }
      if (g.phase !== 'play') return { error: 'The game is over.' }
      if (g.players[g.turn].id !== id) return { error: 'It is not your turn.' }
      const n = msg.n
      if (!Number.isInteger(n) || n < 1 || n > CELLS) return { error: 'Pick a number from 1 to 25.' }
      if (g.calledSet.has(n)) return { error: 'That number was already announced.' }
      call(n, id, false, t)
      return {}
    },

    /** When a turn runs out, a random unused number is announced for the player. */
    tick(t) {
      if (g.phase !== 'play' || !g.deadline || t < g.deadline) return
      const options = free()
      call(options[Math.floor(random() * options.length)], g.players[g.turn].id, true, t)
    },

    /** A player left. Their board stays on screen. Their turn passes on, and the last player standing wins. */
    leave(id, t = 0) {
      const me = find(id)
      if (!me || !me.active || g.phase !== 'play') return
      me.active = false
      g.dirty = true
      const rest = active()
      if (rest.length < 2) {
        finish(rest, true)
        return
      }
      if (g.players[g.turn].id === id) advance(t)
    },

    abort() {
      if (g.phase === 'over') return
      finish([])
      g.dirty = true
    },

    /** Boards and announcements are public, so everyone gets the same view; `you` says which player is reading it. */
    view(id, t = 0) {
      return {
        t: 'bstate',
        phase: g.phase,
        you: id,
        players: g.players.map(p => ({ id: p.id, name: p.name, active: p.active, board: p.board, lines: p.lines, count: p.lines.length })),
        called: g.called,
        turnId: g.phase === 'play' ? g.players[g.turn].id : null,
        left: g.deadline ? Math.max(0, Math.ceil((g.deadline - t) / 1000)) : 0,
        turnSeconds,
        winners: g.winners,
        forfeit: g.forfeit,
        need: WIN_LINES,
      }
    },
  }
}
