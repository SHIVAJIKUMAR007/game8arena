// Undercover: the word-deduction game. Pure rules, no sockets or timers: the hub calls act(), leave() and tick(now)
// and sends each player view(id, now). Nobody can see another player's word or role until that player is out.
//
//   reveal -> clue (everyone in turn) -> vote (tie: one revote) -> [guess, if Mr. White went out] -> result -> clue ...
//   ... until Civilians, the Undercover or Mr. White win. Phases end on a timer, or as soon as everyone has acted.
import { WORD_PAIRS } from './words.js'

export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 20
export const CLUE_SECONDS = [20, 30, 45, 60]
export const END_RULES = ['parity', 'last'] // infiltrators win when civilians <= infiltrators, or when 1 civilian is left
const REVEAL_MS = 30000
const VOTE_MS = 60000
const GUESS_MS = 30000
const RESULT_MS = 8000
const MAX_CLUE = 30

/** The most infiltrators (Undercover + Mr. White together) a group of n can have: at least twice as many players. */
export const maxInfiltrators = n => Math.floor(n / 2)

export const defaultSettings = () => ({ undercover: 1, mrwhite: 0, clueSeconds: 30, endRule: 'parity' })

/** Checks the role counts against the number of players. Returns { ok, error }. */
export function validateSettings(n, s) {
  const { undercover: x, mrwhite: y } = s
  if (!Number.isInteger(n) || n < MIN_PLAYERS) return { ok: false, error: `You need at least ${MIN_PLAYERS} players.` }
  if (n > MAX_PLAYERS) return { ok: false, error: `At most ${MAX_PLAYERS} players can play.` }
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) return { ok: false, error: 'Role counts must be whole numbers.' }
  if (x + y < 1) return { ok: false, error: 'Pick at least one Undercover or Mr. White.' }
  if (x + y > maxInfiltrators(n)) {
    return { ok: false, error: `With ${n} players you can have at most ${maxInfiltrators(n)} Undercover and Mr. White together.` }
  }
  if (!CLUE_SECONDS.includes(s.clueSeconds)) return { ok: false, error: 'Pick a clue time from the list.' }
  if (!END_RULES.includes(s.endRule)) return { ok: false, error: 'Unknown end rule.' }
  return { ok: true }
}

/** Compares guesses and words ignoring case, accents, spaces and punctuation. */
export const normalize = s =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]/gu, '')

const cleanText = (raw, max) => String(raw ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) // eslint-disable-line no-control-regex

/**
 * @param {{ players: Array<{id: string, name: string}>, settings: object, random?: () => number, now?: number, pair?: [string, string] }} opts
 */
export function createUndercover({ players, settings, random = Math.random, now = 0, pair }) {
  const check = validateSettings(players.length, settings)
  if (!check.ok) throw new RangeError(check.error)
  const clueMs = settings.clueSeconds * 1000

  // Roles: shuffle the seats, give the first x Undercover and the next y Mr. White.
  const seats = players.map(p => ({ id: p.id, name: p.name, role: 'civilian', alive: true, left: false }))
  const order = seats.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]]
  }
  order.slice(0, settings.undercover).forEach(i => { seats[i].role = 'undercover' })
  order.slice(settings.undercover, settings.undercover + settings.mrwhite).forEach(i => { seats[i].role = 'mrwhite' })

  const chosen = pair || WORD_PAIRS[Math.floor(random() * WORD_PAIRS.length)]
  const flip = random() < 0.5
  const words = { civilian: flip ? chosen[1] : chosen[0], undercover: flip ? chosen[0] : chosen[1] }
  const by = new Map(seats.map(p => [p.id, p]))

  const g = {
    phase: 'reveal', // 'reveal' | 'clue' | 'vote' | 'guess' | 'result' | 'over'
    round: 1,
    deadline: now + REVEAL_MS,
    dirty: true,
    ready: new Set(),
    turnOrder: [],
    turn: 0,
    clues: [], // this round: { id, text }
    history: [], // earlier rounds: { round, items }
    votes: new Map(),
    candidates: null, // set during a revote
    result: null, // { eliminated: {id,name,role} | null, tie, votes: [{from,to}], guess? }
    guessFor: null,
    winner: null, // 'civilians' | 'undercover' | 'mrwhite' | 'infiltrators' | 'none'
    winners: [],
    settings,
    words,
    seats,
  }

  const alive = () => seats.filter(p => p.alive)
  const count = role => seats.filter(p => p.alive && p.role === role).length

  function finish(winner, winnerIds) {
    g.phase = 'over'
    g.winner = winner
    g.winners = winnerIds
    g.dirty = true
  }

  /** Civilians win when every infiltrator is out; infiltrators win when the civilians are too few. */
  function checkWin() {
    const civ = count('civilian')
    const und = count('undercover')
    const mw = count('mrwhite')
    if (und + mw === 0) {
      finish('civilians', seats.filter(p => p.role === 'civilian' && p.alive).map(p => p.id))
      return true
    }
    const lost = settings.endRule === 'last' ? civ <= 1 : civ <= und + mw
    if (lost) {
      const winners = seats.filter(p => p.alive && p.role !== 'civilian')
      const winner = und > 0 && mw > 0 ? 'infiltrators' : und > 0 ? 'undercover' : 'mrwhite'
      finish(winner, winners.map(p => p.id))
      return true
    }
    return false
  }

  function startClues(t) {
    g.phase = 'clue'
    g.clues = []
    const live = alive()
    const start = (g.round - 1) % live.length
    g.turnOrder = [...live.slice(start), ...live.slice(0, start)].map(p => p.id)
    g.turn = 0
    g.deadline = t + clueMs
    g.dirty = true
  }

  function startVote(t, candidates = null) {
    g.phase = 'vote'
    g.votes = new Map()
    g.candidates = candidates
    g.deadline = t + VOTE_MS
    g.dirty = true
  }

  function afterElimination(t) {
    if (checkWin()) return
    g.phase = 'result'
    g.deadline = t + RESULT_MS
    g.dirty = true
  }

  function eliminate(id, t, votes) {
    const p = by.get(id)
    p.alive = false
    g.result = { eliminated: { id: p.id, name: p.name, role: p.role }, tie: false, votes }
    g.dirty = true
    if (p.role === 'mrwhite' && !p.left) {
      g.phase = 'guess' // Mr. White gets one chance to name the civilians' word
      g.guessFor = id
      g.deadline = t + GUESS_MS
    } else afterElimination(t)
  }

  function resolveVote(t) {
    const votes = [...g.votes].filter(([from]) => by.get(from)?.alive).map(([from, to]) => ({ from, to }))
    const tally = new Map()
    for (const v of votes) tally.set(v.to, (tally.get(v.to) || 0) + 1)
    const top = Math.max(0, ...tally.values())
    const tied = [...tally].filter(([, n]) => n === top && n > 0).map(([id]) => id)
    if (tied.length === 1) return eliminate(tied[0], t, votes)
    if (tied.length > 1 && !g.candidates) return startVote(t, tied) // a tie gets one revote between the tied players
    g.result = { eliminated: null, tie: true, votes }
    return afterElimination(t)
  }

  function nextTurn(t) {
    do g.turn++
    while (g.turn < g.turnOrder.length && !by.get(g.turnOrder[g.turn]).alive)
    if (g.turn >= g.turnOrder.length) startVote(t)
    else g.deadline = t + clueMs
    g.dirty = true
  }

  const failGuess = (t, guess) => {
    g.result = { ...g.result, guess: { id: g.guessFor, text: guess ?? '', correct: false } }
    g.guessFor = null
    afterElimination(t)
  }

  function allVoted() {
    return alive().every(p => g.votes.has(p.id))
  }

  const api = {
    get phase() { return g.phase },
    get winner() { return g.winner },
    get dirty() { return g.dirty },
    clearDirty() { g.dirty = false },
    seats,
    words,

    /** A player does something. Returns { error } for an illegal action, nothing otherwise. */
    act(id, msg, t) {
      const me = by.get(id)
      if (!me || !msg || typeof msg !== 'object') return undefined
      switch (msg.a) {
        case 'ready':
          if (g.phase !== 'reveal' || me.left) return undefined
          g.ready.add(id)
          g.dirty = true
          if (alive().every(p => g.ready.has(p.id))) startClues(t)
          return undefined
        case 'clue': {
          if (g.phase !== 'clue' || g.turnOrder[g.turn] !== id) return { error: 'It is not your turn.' }
          const text = cleanText(msg.text, MAX_CLUE)
          if (!text) return { error: 'Type a clue first.' }
          const mine = me.role === 'mrwhite' ? '' : normalize(words[me.role])
          if (mine.length >= 3 && normalize(text).includes(mine)) return { error: 'You cannot say your own word.' }
          g.clues.push({ id, text })
          nextTurn(t)
          return undefined
        }
        case 'vote': {
          if (g.phase !== 'vote' || !me.alive) return { error: 'You cannot vote now.' }
          const target = by.get(msg.target)
          if (!target || !target.alive || target.id === id) return { error: 'Pick another player who is still in.' }
          if (g.candidates && !g.candidates.includes(target.id)) return { error: 'Vote for one of the tied players.' }
          g.votes.set(id, target.id)
          g.dirty = true
          if (allVoted()) resolveVote(t)
          return undefined
        }
        case 'guess': {
          if (g.phase !== 'guess' || g.guessFor !== id) return { error: 'You cannot guess now.' }
          const text = cleanText(msg.text, 40)
          if (!text) return { error: 'Type a guess first.' }
          if (normalize(text) === normalize(words.civilian)) {
            g.result = { ...g.result, guess: { id, text, correct: true } }
            g.guessFor = null
            finish('mrwhite', [id])
          } else failGuess(t, text)
          return undefined
        }
        default:
          return undefined
      }
    },

    /** A player left the room: they drop out, and the game carries on without them. */
    leave(id, t) {
      const p = by.get(id)
      if (!p || p.left) return
      p.left = true
      const wasIn = p.alive
      p.alive = false
      g.votes.delete(id)
      g.ready.delete(id)
      g.dirty = true
      if (g.phase === 'over') return
      if (g.phase === 'guess' && g.guessFor === id) return failGuess(t) // Mr. White left while guessing
      if (!wasIn) return
      if (checkWin()) return
      if (g.phase === 'reveal' && alive().every(q => g.ready.has(q.id))) startClues(t)
      else if (g.phase === 'clue' && g.turnOrder[g.turn] === id) nextTurn(t)
      else if (g.phase === 'vote' && allVoted()) resolveVote(t)
    },

    /** Moves on when a phase's time is up. */
    tick(t) {
      if (g.phase === 'over' || t < g.deadline) return
      switch (g.phase) {
        case 'reveal': startClues(t); break
        case 'clue':
          g.clues.push({ id: g.turnOrder[g.turn], text: '(no clue)' })
          nextTurn(t)
          break
        case 'vote': resolveVote(t); break
        case 'guess': failGuess(t); break
        case 'result':
          g.history.push({ round: g.round, items: g.clues })
          g.round++
          startClues(t)
          break
        default:
      }
    },

    /** The game is dropped (too few players left). */
    abort() {
      if (g.phase !== 'over') finish('none', [])
    },

    /** What one player may see. Roles and words stay hidden until a player is out or the game ends. */
    view(id, t = 0) {
      const me = by.get(id)
      if (!me) return null
      const over = g.phase === 'over'
      const rounds = [...g.history, ...(g.clues.length || g.phase === 'clue' ? [{ round: g.round, items: g.clues }] : [])]
      return {
        t: 'ustate',
        phase: g.phase,
        round: g.round,
        left: over ? 0 : Math.max(0, Math.ceil((g.deadline - t) / 1000)),
        you: {
          id, alive: me.alive, mrWhite: me.role === 'mrwhite', word: me.role === 'mrwhite' ? null : words[me.role],
          ready: g.ready.has(id), vote: g.votes.get(id) ?? null, role: over ? me.role : undefined,
        },
        players: seats.map(p => ({
          id: p.id, name: p.name, alive: p.alive, left: p.left,
          role: !p.alive || over ? p.role : undefined,
          voted: g.phase === 'vote' ? g.votes.has(p.id) : undefined,
          ready: g.phase === 'reveal' ? g.ready.has(p.id) : undefined,
        })),
        turnId: g.phase === 'clue' ? g.turnOrder[g.turn] : null,
        rounds,
        candidates: g.phase === 'vote' ? g.candidates : null,
        result: g.result,
        guessFor: g.guessFor,
        winner: g.winner,
        winners: g.winners,
        words: over ? words : undefined,
        counts: { civilian: seats.length - settings.undercover - settings.mrwhite, undercover: settings.undercover, mrwhite: settings.mrwhite },
        endRule: settings.endRule,
      }
    },
  }
  return api
}
