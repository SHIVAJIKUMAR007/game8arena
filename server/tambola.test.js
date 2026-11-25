import { afterEach, describe, expect, it } from 'vitest'
import { validateTicket } from '../src/games/tambola/ticket.js'
import { createHub } from './hub.js'
import {
  CALL_SECONDS, CLAIM_LOCK_MS, FIRST_CALL_MS, GRACE_MS, MARK_SECONDS, PRIZES, createTambola, defaultSettings, normalizeSettings,
} from './tambola.js'

const people = n => Array.from({ length: n }, (_, i) => ({ id: String(i + 1), name: `P${i + 1}` }))
const make = (n = 2, settings = {}, random = () => 0.37) => createTambola({ players: people(n), settings, random, now: 0 })
const mark = (g, id, t) => {
  for (const d of g.view(id, t).due) g.act(id, { a: 'mark', n: d.n, ticket: d.ticket }, t)
}

/** Moves the clock forward one second at a time. `each(t)` runs after every tick. Stops when `done(t)` is true. */
function run(g, { from = 0, to = 4000000, step = 1000, each = () => {}, done = () => false }) {
  let t = from
  while (t <= to && g.phase === 'play' && !done(t)) {
    g.tick(t)
    each(t)
    t += step
  }
  return t
}

describe('settings', () => {
  it('has sensible defaults and fixes anything invalid', () => {
    expect(defaultSettings()).toEqual({ callSeconds: 8, markSeconds: 5, tickets: 1 })
    expect(normalizeSettings({ callSeconds: 99, markSeconds: -1, tickets: 'x' })).toEqual(defaultSettings())
    expect(normalizeSettings(undefined)).toEqual(defaultSettings())
    expect(normalizeSettings({ callSeconds: 10, markSeconds: 8, tickets: 3 })).toEqual({ callSeconds: 10, markSeconds: 8, tickets: 3 })
  })

  it('never lets the mark window be longer than the gap between calls', () => {
    for (const c of CALL_SECONDS) {
      for (const m of MARK_SECONDS) expect(normalizeSettings({ callSeconds: c, markSeconds: m }).markSeconds).toBeLessThanOrEqual(c)
    }
    expect(normalizeSettings({ callSeconds: 6, markSeconds: 10 }).markSeconds).toBe(5)
  })
})

describe('dealing', () => {
  it('needs 2 to 10 players', () => {
    expect(() => make(1)).toThrow()
    expect(() => make(11)).toThrow()
    expect(() => make(10)).not.toThrow()
  })

  it('gives every player valid tickets, as many as the setting says', () => {
    for (const tickets of [1, 2, 3]) {
      const g = make(3, { tickets })
      for (const p of people(3)) {
        const v = g.view(p.id, 0)
        expect(v.tickets).toHaveLength(tickets)
        v.tickets.forEach(t => expect(validateTicket(t).ok).toBe(true))
        expect(v.marks).toEqual(Array.from({ length: tickets }, () => []))
      }
    }
  })

  it('is deterministic for the same random source', () => {
    expect(make(3).view('1', 0).tickets).toEqual(make(3).view('1', 0).tickets)
    expect(make(3).view('1', 0).tickets).not.toEqual(make(3, {}, () => 0.81).view('1', 0).tickets)
  })

  it('keeps tickets private: your view has only your own, and others show only counts', () => {
    const g = make(3)
    const v = g.view('1', 0)
    expect(v.tickets).toEqual(g.view('1', 0).tickets)
    expect(v.tickets).not.toEqual(g.view('2', 0).tickets)
    for (const p of v.players) expect(Object.keys(p).sort()).toEqual(['active', 'id', 'marked', 'name', 'outAt', 'prizes', 'reason'])
    expect(JSON.stringify(v)).not.toContain(JSON.stringify(g.view('2', 0).tickets))
  })
})

describe('the caller', () => {
  it('waits, then announces one number every interval, the same for everyone', () => {
    const g = make(2, { callSeconds: 8, markSeconds: 5 })
    g.tick(FIRST_CALL_MS - 1)
    expect(g.view('1', 0).called).toEqual([])
    g.tick(FIRST_CALL_MS)
    expect(g.view('1', 0).called).toHaveLength(1)
    g.tick(FIRST_CALL_MS + 7999)
    expect(g.view('1', 0).called).toHaveLength(1)
    g.tick(FIRST_CALL_MS + 8000)
    const a = g.view('1', 0)
    expect(a.called).toHaveLength(2)
    expect(g.view('2', 0).called).toEqual(a.called)
    expect(a.latest).toBe(a.called[1])
    expect(new Set(a.called).size).toBe(2)
    expect(a.called.every(n => n >= 1 && n <= 90)).toBe(true)
  })

  it('reports when the next number is due', () => {
    const g = make()
    g.tick(FIRST_CALL_MS)
    expect(g.view('1', FIRST_CALL_MS + 2000).nextCallIn).toBe(6000)
  })
})

describe('marking', () => {
  /** Plays on until `id` has a number to cut, with nobody evicted along the way. Returns the clock. */
  function untilDue(g, id, others = []) {
    return run(g, { each: t => others.forEach(x => mark(g, x, t)), done: t => g.view(id, t).due.length > 0 })
  }

  it('only accepts called numbers that are on that ticket', () => {
    const g = make(3, { tickets: 2 })
    expect(g.act('1', { a: 'mark', n: 5, ticket: 0 }, 0).error).toMatch(/not been called/)
    const t = untilDue(g, '1', ['2', '3'])
    const due = g.view('1', t).due[0]
    expect(g.act('1', { a: 'mark', n: due.n, ticket: 9 }, t).error).toMatch(/No such ticket/)
    expect(g.act('1', { a: 'mark', n: 'x', ticket: 0 }, t).error).toMatch(/not been called/)
    const other = due.ticket === 0 ? 1 : 0
    const onOther = g.view('1', t).tickets[other].some(r => r.includes(due.n))
    if (!onOther) expect(g.act('1', { a: 'mark', n: due.n, ticket: other }, t).error).toMatch(/not on that ticket/)
    expect(g.act('1', { a: 'mark', n: due.n, ticket: due.ticket }, t)).toEqual({})
    expect(g.view('1', t).marks[due.ticket]).toContain(due.n)
    expect(g.view('1', t).due.find(d => d.n === due.n && d.ticket === due.ticket)).toBeUndefined()
    expect(g.act('1', { a: 'mark', n: due.n, ticket: due.ticket }, t)).toEqual({}) // marking twice is harmless
    expect(g.act('9', { a: 'mark', n: due.n, ticket: 0 }, t).error).toMatch(/not in this game/)
    expect(g.act('1', { a: 'nope' }, t).error).toBeTruthy()
  })

  it('shows how long is left on a number you still have to cut', () => {
    const g = make(3)
    const t = untilDue(g, '1', ['2', '3'])
    const d = g.view('1', t).due[0]
    expect(d.left).toBeGreaterThan(0)
    expect(d.left).toBeLessThanOrEqual(5000)
    expect(g.view('1', t + 2000).due[0].left).toBe(Math.max(0, d.left - 2000))
  })
})

describe('eviction', () => {
  /** Plays until player `id` is told to cut a number; the others mark everything. Returns { t, due }. */
  function untilDue(g, id) {
    let found
    const t = run(g, {
      each: tt => ['1', '2', '3'].filter(x => x !== id).forEach(x => mark(g, x, tt)),
      done: tt => {
        found = g.view(id, tt).due[0]
        return Boolean(found)
      },
    })
    return { t, due: found }
  }

  it('evicts a player who does not cut a number within the window, and only then', () => {
    const g = make(3, { callSeconds: 8, markSeconds: 5 })
    const { t, due } = untilDue(g, '1')
    g.tick(t + 4000)
    expect(g.view('1', t + 4000).players[0].active).toBe(true) // still inside the window
    // keep the others marking, and let player 1's window close
    run(g, { from: t + 5000, to: t + 6000, each: tt => ['2', '3'].forEach(x => mark(g, x, tt)) })
    const v = g.view('2', t + 7000)
    const p1 = v.players[0]
    expect(p1.active).toBe(false)
    expect(p1.reason).toBe('evicted')
    expect(p1.outAt).toBe(due.n)
    expect(v.feed.some(e => e.k === 'evict' && e.id === '1' && e.n === due.n)).toBe(true)
    expect(v.players[1].active).toBe(true)
    expect(v.players[2].active).toBe(true)
  })

  it('does not evict a player who marks in time, or one for a number that is not on their ticket', () => {
    const g = make(3)
    run(g, { to: 120000, each: t => ['1', '2', '3'].forEach(x => mark(g, x, t)) })
    expect(g.view('1', 0).players.every(p => p.active)).toBe(true)
    expect(g.view('1', 0).called.length).toBeGreaterThan(10)
  })

  it('an evicted player can watch but cannot mark or claim', () => {
    const g = make(3)
    const { t } = untilDue(g, '1')
    run(g, { from: t, to: t + 7000, each: tt => ['2', '3'].forEach(x => mark(g, x, tt)) })
    expect(g.view('1', t + 7000).players[0].active).toBe(false)
    const n = g.view('1', 0).called[0]
    expect(g.act('1', { a: 'mark', n, ticket: 0 }, t + 8000).error).toMatch(/out of this round/)
    expect(g.act('1', { a: 'claim' }, t + 8000).error).toMatch(/out of this round/)
    expect(g.view('1', t + 8000).due).toEqual([])
    expect(g.view('1', t + 8000).called.length).toBeGreaterThan(0) // can still see the board
  })

  it('every window is checked: a late mark is too late', () => {
    const g = make(3, { callSeconds: 8, markSeconds: 3 })
    const { t, due } = untilDue(g, '1')
    const late = t + 3000 + GRACE_MS + 1
    run(g, { from: t, to: late, each: tt => ['2', '3'].forEach(x => mark(g, x, tt)), step: 100 })
    expect(g.act('1', { a: 'mark', n: due.n, ticket: due.ticket }, late).error).toMatch(/out of this round/)
  })

  it('ends the round when only one player is left, and that player is the winner', () => {
    const g = make(2)
    const { t } = untilDue2(g, '1')
    run(g, { from: t, to: t + 7000, each: tt => mark(g, '2', tt) })
    expect(g.phase).toBe('over')
    const v = g.view('2', 0)
    expect(v.reason).toBe('last')
    expect(v.winners).toEqual(['2'])
  })

  it('if nobody marks anything, players drop out one by one and the last one in wins by default', () => {
    const g = make(2)
    run(g, { to: 4000000 })
    expect(g.phase).toBe('over')
    expect(g.view('1', 0).reason).toBe('last')
    expect(g.view('1', 0).winners).toHaveLength(1)
  })

  it('an aborted round has no winner', () => {
    const g = make(2)
    g.abort()
    expect(g.view('1', 0).winners).toEqual([])
    expect(g.view('1', 0).reason).toBe('out')
  })

  function untilDue2(g, id) {
    let found
    const t = run(g, { each: tt => mark(g, '2', tt), done: tt => Boolean((found = g.view(id, tt).due[0])) })
    return { t, due: found }
  }
})

describe('claims and prizes', () => {
  const everyone = n => people(n).map(p => p.id)

  it('a claim that is not complete is refused, with a short lock-out', () => {
    const g = make(3)
    const r = g.act('1', { a: 'claim' }, 10000)
    expect(r.error).toMatch(/not a Early Five yet/)
    expect(g.act('1', { a: 'claim' }, 10000 + CLAIM_LOCK_MS - 1).error).toMatch(/Wait a moment/)
    expect(g.act('1', { a: 'claim' }, 10000 + CLAIM_LOCK_MS).error).toMatch(/not a Early Five yet/)
    expect(g.view('1', 10000).prizes.every(p => p.winner === null)).toBe(true)
  })

  it('cannot claim what you did not mark yourself, even if every number was called', () => {
    const g = make(3)
    const ids = ['2', '3']
    // player 1 never marks anything; players 2 and 3 do
    run(g, { to: 40000, each: t => ids.forEach(x => mark(g, x, t)) })
    const r = g.act('1', { a: 'claim' }, 40000)
    expect(r.error).toBeTruthy()
  })

  it('awards Early Five, then Line, then Full House, each to the first valid claim, and ends the round', () => {
    const g = make(3, { callSeconds: 6, markSeconds: 3 })
    const claimed = []
    run(g, {
      step: 500,
      each: t => {
        for (const id of everyone(3)) {
          mark(g, id, t)
          const before = g.view(id, t).prizes.filter(p => p.winner).length
          if (g.view(id, t).players.find(p => p.id === id).active && g.act(id, { a: 'claim' }, t).error === undefined) claimed.push([id, before])
        }
      },
    })
    expect(g.phase).toBe('over')
    const v = g.view('1', 0)
    expect(v.reason).toBe('fullhouse')
    expect(v.prizes.map(p => p.goal)).toEqual(PRIZES)
    expect(v.prizes.every(p => p.winner)).toBe(true)
    expect(claimed.map(c => c[1])).toEqual([0, 1, 2]) // in order, one winner each
    expect(v.winners).toHaveLength(1)
    const top = v.players.find(p => p.id === v.winners[0])
    expect(top.prizes.length).toBeGreaterThanOrEqual(1)
    expect(v.players.reduce((s, p) => s + p.prizes.length, 0)).toBe(3)
    expect(v.goal).toBeNull()
  })

  it('a prize cannot be won twice and the current goal moves on after a claim', () => {
    const g = make(3, { callSeconds: 6, markSeconds: 3 })
    let first
    run(g, {
      step: 500,
      each: t => {
        for (const id of everyone(3)) {
          mark(g, id, t)
          if (!first && g.act(id, { a: 'claim' }, t).error === undefined) first = { id, t }
        }
      },
      done: () => Boolean(first),
    })
    expect(first).toBeTruthy()
    const v = g.view('1', first.t)
    expect(v.prizes[0].winner).toBe(first.id)
    expect(v.goal).toBe('line')
  })
})

describe('leaving', () => {
  it('a player who leaves is out, keeps their prizes and the last player standing wins', () => {
    const g = make(3)
    g.leave('1')
    expect(g.phase).toBe('play')
    expect(g.view('2', 0).players[0]).toMatchObject({ active: false, reason: 'left' })
    g.leave('2')
    expect(g.phase).toBe('over')
    expect(g.view('3', 0).winners).toEqual(['3'])
    expect(g.view('3', 0).reason).toBe('last')
  })

  it('ignores a second leave and leaves after the end', () => {
    const g = make(3)
    g.leave('1')
    g.leave('1')
    g.abort()
    expect(g.phase).toBe('over')
    g.leave('2')
    expect(g.view('3', 0).players[1].active).toBe(true)
  })
})

// ---- through the hub ----
function client(hub) {
  const handlers = { message: [], close: [] }
  const got = []
  const conn = { on: (e, fn) => handlers[e].push(fn), send: text => got.push(JSON.parse(text)), close: () => handlers.close.forEach(f => f()) }
  hub.handleConnection(conn)
  return {
    got,
    say: msg => handlers.message.forEach(f => f(JSON.stringify(msg))),
    drop: () => handlers.close.forEach(f => f()),
    last: type => [...got].reverse().find(m => m.t === type),
  }
}
const wait = ms => new Promise(r => setTimeout(r, ms))

describe('tambola through the hub', () => {
  let hub
  afterEach(() => hub?.close())
  const clock = { t: 1000 }
  const room = () => {
    clock.t = 1000
    hub = createHub({ now: () => clock.t, random: () => 0.37 })
    const host = client(hub)
    host.say({ t: 'create', name: 'Ann', game: 'tambola' })
    const code = host.last('joined').code
    const guest = client(hub)
    guest.say({ t: 'join', code, name: 'Bob', game: 'tambola' })
    return { host, guest, code }
  }

  it('creates a tambola room with default settings and its limits', () => {
    const { host } = room()
    expect(host.last('room')).toMatchObject({ game: 'tambola', phase: 'lobby', settings: { callSeconds: 8, markSeconds: 5, tickets: 1 } })
    expect(host.last('room').limits).toEqual({ callSeconds: CALL_SECONDS, markSeconds: MARK_SECONDS, tickets: [1, 2, 3] })
  })

  it('only the host changes settings, and a mark window longer than the call gap is shortened', () => {
    const { host, guest } = room()
    guest.say({ t: 'settings', callSeconds: 15 })
    expect(host.last('room').settings.callSeconds).toBe(8)
    host.say({ t: 'settings', callSeconds: 6, markSeconds: 10, tickets: 2 })
    expect(host.last('room').settings).toEqual({ callSeconds: 6, markSeconds: 5, tickets: 2 })
    host.say({ t: 'settings', callSeconds: 99, tickets: 7 })
    expect(host.last('room').settings).toEqual({ callSeconds: 6, markSeconds: 5, tickets: 2 })
  })

  it('needs two players to start, and refuses people from other games', () => {
    hub = createHub({ now: () => clock.t })
    const host = client(hub)
    host.say({ t: 'create', name: 'Ann', game: 'tambola' })
    host.say({ t: 'start' })
    expect(host.last('error').message).toMatch(/at least 2/)
    const other = client(hub)
    other.say({ t: 'join', code: host.last('joined').code, name: 'Zed', game: 'bingo' })
    expect(other.last('error').message).toMatch(/Tambola/)
  })

  it('deals private tickets, calls numbers, takes marks and evicts a sleeper', async () => {
    const { host, guest } = room()
    host.say({ t: 'start' })
    const h0 = host.last('tmstate')
    const g0 = guest.last('tmstate')
    expect(h0.phase).toBe('play')
    expect(h0.tickets).toHaveLength(1)
    expect(h0.tickets).not.toEqual(g0.tickets)

    // step the host's clock and let the room's timer run until the host has a number to cut
    let due
    for (let i = 0; i < 60 && !due; i++) {
      clock.t += 1000
      await wait(220)
      due = host.last('tmstate').due[0]
      const gd = guest.last('tmstate').due[0]
      if (gd) guest.say({ t: 'tb', a: 'mark', n: gd.n, ticket: gd.ticket }) // the guest keeps up; the host sleeps
    }
    expect(due).toBeTruthy()
    // a mark for a number nobody has called is refused and does not hurt anybody
    host.say({ t: 'tb', a: 'mark', n: 91, ticket: 0 })
    expect(host.last('error').message).toMatch(/not been called/)
    expect(host.last('tmstate').players[0].active).toBe(true)

    for (let i = 0; i < 12 && host.last('tmstate').players[0].active; i++) {
      clock.t += 1000
      await wait(220)
      const gd = guest.last('tmstate').due[0]
      if (gd) guest.say({ t: 'tb', a: 'mark', n: gd.n, ticket: gd.ticket })
    }
    const v = guest.last('tmstate')
    expect(v.players[0]).toMatchObject({ active: false, reason: 'evicted' })
    // with only the guest left, the round ends and the room goes back to "over"
    expect(v.phase).toBe('over')
    expect(guest.last('room').phase).toBe('over')
    expect(v.winners).toEqual([guest.last('joined').id])
  }, 30000)

  it('a player who disconnects mid-round is out, and the host can return to the lobby afterwards', async () => {
    const { host, guest } = room()
    host.say({ t: 'start' })
    guest.drop()
    expect(host.last('tmstate').phase).toBe('over')
    expect(host.last('tmstate').reason).toBe('last')
    host.say({ t: 'lobby' })
    expect(host.last('room').phase).toBe('lobby')
    host.say({ t: 'tb', a: 'claim' }) // ignored outside a round
    await wait(10)
  })
})
