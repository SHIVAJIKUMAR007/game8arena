// Multiplayer Tambola (Housie). The server is the caller: it announces one number at a time, the same for everyone.
// Every player holds their own ticket(s) and must "cut" (mark) each announced number themselves, on every ticket
// that has it, before the mark window closes. A player who lets a number on their ticket go unmarked is
// evicted from the round. They can keep watching, but cannot mark or claim any more. The patterns are claimed in
// order (Early Five, then Line, then Full House); the first valid claim takes each prize, and the round ends when
// the Full House is claimed, when only one player is left, or when every number has been called.
//
// Pure rules, no sockets or timers: the hub calls act(), leave() and tick(now) and sends everyone view().
// Marks live on the server, so a claim is checked against what the player really marked, not against what was called.
import { createRng } from '../src/platform/rng.js'
import { GOALS, MAX_NUMBER, generateTicket, isGoalMet } from '../src/games/tambola/ticket.js'

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 10
export const CALL_SECONDS = [6, 8, 10, 15] // time between announcements
export const MARK_SECONDS = [3, 5, 8, 10] // time you have to cut a number once it is announced
export const TICKET_COUNTS = [1, 2, 3]
export const PRIZES = ['earlyFive', 'line', 'fullHouse']
export const FIRST_CALL_MS = 5000 // a pause to read your ticket before the first number
export const GRACE_MS = 600 // slack on top of the mark window for network delay: the window you see is the one shown
export const CLAIM_LOCK_MS = 3000 // after a false claim you cannot claim again for a moment

export const defaultSettings = () => ({ callSeconds: 8, markSeconds: 5, tickets: 1 })

/** Fills in anything missing or invalid, and never lets the mark window be longer than the gap between calls. */
export function normalizeSettings(raw = {}) {
  const d = defaultSettings()
  const callSeconds = CALL_SECONDS.includes(raw.callSeconds) ? raw.callSeconds : d.callSeconds
  let markSeconds = MARK_SECONDS.includes(raw.markSeconds) ? raw.markSeconds : d.markSeconds
  if (markSeconds > callSeconds) markSeconds = Math.max(...MARK_SECONDS.filter(s => s <= callSeconds))
  return { callSeconds, markSeconds, tickets: TICKET_COUNTS.includes(raw.tickets) ? raw.tickets : d.tickets }
}

/**
 * @param {{ players: { id: string, name: string }[], settings?: object, random?: () => number, now?: number }} opts
 */
export function createTambola({ players, settings = {}, random = Math.random, now = 0 }) {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) throw new Error(`Tambola needs ${MIN_PLAYERS}-${MAX_PLAYERS} players.`)
  const cfg = normalizeSettings(settings)
  const callMs = cfg.callSeconds * 1000
  const markMs = cfg.markSeconds * 1000
  const rng = createRng(Math.floor(random() * 4294967296))
  const order = rng.shuffle(Array.from({ length: MAX_NUMBER }, (_, i) => i + 1))

  const g = {
    phase: 'play', // 'play' | 'over'
    players: players.map(p => {
      const tickets = Array.from({ length: cfg.tickets }, () => generateTicket(rng))
      return {
        id: p.id, name: p.name, tickets, marks: tickets.map(() => new Set()), active: true, reason: '', outAt: 0, lockUntil: 0, prizes: [],
      }
    }),
    calls: [], // { n, at, deadline, checked }
    calledSet: new Set(),
    nextCallAt: now + FIRST_CALL_MS,
    goalIdx: 0,
    prizes: PRIZES.map(goal => ({ goal, winner: null })),
    feed: [], // newest last: { k: 'call' | 'evict' | 'prize' | 'left', id?, n?, goal? }
    reason: '',
    winners: [],
    dirty: true,
  }
  const find = id => g.players.find(p => p.id === id)
  const active = () => g.players.filter(p => p.active)
  const note = e => {
    g.feed.push(e)
    if (g.feed.length > 12) g.feed.shift()
  }

  function standings() {
    const markCount = p => p.marks.reduce((s, m) => s + m.size, 0)
    const fullHouse = g.prizes[2].winner
    return [...g.players].sort((a, b) =>
      b.prizes.length - a.prizes.length ||
      Number(b.id === fullHouse) - Number(a.id === fullHouse) ||
      Number(b.active) - Number(a.active) ||
      markCount(b) - markCount(a))
  }

  function finish(reason) {
    if (g.phase === 'over') return
    g.phase = 'over'
    g.reason = reason
    const top = standings()[0]
    if (reason === 'last') g.winners = active().map(p => p.id) // the last one still in the round
    else g.winners = top && top.prizes.length ? [top.id] : [] // otherwise whoever took the most prizes
    g.dirty = true
  }

  /** Ends the round when too few players are left in it. */
  function checkEnd() {
    if (g.phase !== 'play') return
    const left = active().length
    if (left === 0) finish('out')
    else if (left === 1) finish('last')
  }

  function checkDeadlines(t) {
    for (const c of g.calls) {
      if (c.checked || t < c.deadline + GRACE_MS) continue
      c.checked = true
      for (const p of active()) {
        const missed = p.tickets.some((ticket, i) => ticket.some(row => row.includes(c.n)) && !p.marks[i].has(c.n))
        if (!missed) continue
        p.active = false
        p.reason = 'evicted'
        p.outAt = c.n
        note({ k: 'evict', id: p.id, n: c.n })
        g.dirty = true
      }
    }
    checkEnd()
    if (g.phase === 'play' && g.calls.length === MAX_NUMBER && g.calls.every(c => c.checked)) finish('exhausted')
  }

  return {
    get phase() { return g.phase },
    get dirty() { return g.dirty },
    clearDirty() { g.dirty = false },
    get settings() { return { ...cfg } },

    /** @returns {{ error?: string }} */
    act(id, msg, t = 0) {
      const me = find(id)
      if (!me) return { error: 'You are not in this game.' }
      if (g.phase !== 'play') return { error: 'The round is over.' }
      if (!me.active) return { error: 'You are out of this round.' }
      if (!msg) return { error: 'Unknown action.' }

      if (msg.a === 'mark') {
        const { n, ticket } = msg
        if (!Number.isInteger(n) || !g.calledSet.has(n)) return { error: 'That number has not been called.' }
        if (!Number.isInteger(ticket) || ticket < 0 || ticket >= me.tickets.length) return { error: 'No such ticket.' }
        if (!me.tickets[ticket].some(row => row.includes(n))) return { error: 'That number is not on that ticket.' }
        if (!me.marks[ticket].has(n)) {
          me.marks[ticket].add(n)
          g.dirty = true
        }
        return {}
      }

      if (msg.a === 'claim') {
        if (t < me.lockUntil) return { error: 'Wait a moment before claiming again.' }
        const prize = g.prizes[g.goalIdx]
        if (!prize) return { error: 'Every prize is taken.' }
        if (!me.tickets.some((ticket, i) => isGoalMet(prize.goal, ticket, me.marks[i]))) {
          me.lockUntil = t + CLAIM_LOCK_MS
          g.dirty = true
          return { error: `That is not a ${GOALS[prize.goal].label} yet. Mark every number on your ticket first.` }
        }
        prize.winner = id
        me.prizes.push(prize.goal)
        note({ k: 'prize', id, goal: prize.goal })
        g.goalIdx++
        if (g.goalIdx >= g.prizes.length) finish('fullhouse')
        g.dirty = true
        return {}
      }
      return { error: 'Unknown action.' }
    },

    /** Evicts players who missed a mark window, and announces the next number when it is time. */
    tick(t) {
      if (g.phase !== 'play') return
      checkDeadlines(t)
      if (g.phase !== 'play') return
      if (t >= g.nextCallAt && g.calls.length < MAX_NUMBER) {
        const n = order[g.calls.length]
        g.calls.push({ n, at: t, deadline: t + markMs, checked: false })
        g.calledSet.add(n)
        g.nextCallAt = t + callMs
        note({ k: 'call', n })
        g.dirty = true
      }
    },

    /** A player left. Their prizes stay with them, and the last player standing wins. */
    leave(id) {
      const me = find(id)
      if (!me || !me.active || g.phase !== 'play') return
      me.active = false
      me.reason = 'left'
      note({ k: 'left', id })
      g.dirty = true
      checkEnd()
    },

    abort() {
      if (g.phase === 'over') return
      finish('out')
    },

    /** Everyone sees who is in and who holds which prize; only you see your own tickets and marks. */
    view(id, t = 0) {
      const me = find(id)
      const due = []
      if (me && me.active && g.phase === 'play') {
        for (const c of g.calls) {
          if (c.checked || t >= c.deadline + GRACE_MS) continue
          me.tickets.forEach((ticket, i) => {
            if (ticket.some(row => row.includes(c.n)) && !me.marks[i].has(c.n)) due.push({ n: c.n, ticket: i, left: Math.max(0, c.deadline - t) })
          })
        }
      }
      const last = g.calls.at(-1)
      return {
        t: 'tmstate',
        phase: g.phase,
        you: id,
        players: g.players.map(p => ({
          id: p.id, name: p.name, active: p.active, reason: p.reason, outAt: p.outAt, prizes: p.prizes,
          marked: p.marks.reduce((s, m) => s + m.size, 0),
        })),
        tickets: me ? me.tickets : [],
        marks: me ? me.marks.map(m => [...m]) : [],
        due,
        called: g.calls.map(c => c.n),
        latest: last ? last.n : null,
        nextCallIn: g.phase === 'play' && g.calls.length < MAX_NUMBER ? Math.max(0, g.nextCallAt - t) : 0,
        callMs,
        markMs,
        goal: g.prizes[g.goalIdx]?.goal ?? null,
        prizes: g.prizes,
        feed: g.feed,
        winners: g.winners,
        reason: g.reason,
        locked: me ? Math.max(0, me.lockUntil - t) : 0,
      }
    },
  }
}
