import { describe, expect, it } from 'vitest'
import {
  CLUE_SECONDS, MAX_PLAYERS, MIN_PLAYERS, createUndercover, defaultSettings, maxInfiltrators, normalize, validateSettings,
} from './undercover.js'
import { WORD_PAIRS } from './words.js'

const seeded = (seed = 3) => {
  let a = seed
  return () => ((a = (a * 16807) % 2147483647) - 1) / 2147483646
}
const names = n => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }))
const make = (n = 6, settings = {}, extra = {}) =>
  createUndercover({ players: names(n), settings: { ...defaultSettings(), ...settings }, random: seeded(), now: 0, pair: ['Coffee', 'Tea'], ...extra })
const roleOf = (g, role) => g.seats.filter(p => p.role === role).map(p => p.id)
const idOf = (g, role, i = 0) => roleOf(g, role)[i]

/** Everyone gets ready, then every player gives a clue. Leaves the game in the vote phase. */
function toVote(g, t = 1000) {
  for (const p of g.seats) g.act(p.id, { a: 'ready' }, t)
  expect(g.phase).toBe('clue')
  for (let i = 0; i < g.seats.length && g.phase === 'clue'; i++) {
    const turn = g.view('p0', t).turnId
    g.act(turn, { a: 'clue', text: `clue${i}` }, t)
  }
  expect(g.phase).toBe('vote')
}
/** Everyone alive votes for `target`, who (not allowed to vote for themselves) votes for someone else. */
const voteAll = (g, target, t = 2000) => {
  const live = g.seats.filter(q => q.alive)
  for (const p of live.filter(q => q.id !== target)) g.act(p.id, { a: 'vote', target }, t)
  g.act(target, { a: 'vote', target: live.find(q => q.id !== target).id }, t)
}

describe('role counts', () => {
  it('allows Undercover plus Mr. White up to half the players, rounded down', () => {
    expect(maxInfiltrators(3)).toBe(1)
    expect(maxInfiltrators(8)).toBe(4)
    expect(maxInfiltrators(9)).toBe(4)
    expect(validateSettings(8, { ...defaultSettings(), undercover: 3, mrwhite: 1 }).ok).toBe(true)
    expect(validateSettings(8, { ...defaultSettings(), undercover: 3, mrwhite: 2 }).ok).toBe(false)
    expect(validateSettings(9, { ...defaultSettings(), undercover: 4, mrwhite: 1 }).ok).toBe(false)
    expect(validateSettings(9, { ...defaultSettings(), undercover: 0, mrwhite: 4 }).ok).toBe(true)
  })

  it('holds for any group size, with a helpful message when it is broken', () => {
    for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
      const max = maxInfiltrators(n)
      for (let x = 0; x <= max + 1; x++) {
        for (let y = 0; y <= max + 1; y++) {
          const r = validateSettings(n, { ...defaultSettings(), undercover: x, mrwhite: y })
          expect(r.ok, `${n} players, ${x}+${y}`).toBe(x + y >= 1 && x + y <= max)
        }
      }
    }
    expect(validateSettings(6, { ...defaultSettings(), undercover: 4, mrwhite: 0 }).error).toMatch(/at most 3/)
  })

  it('needs a sensible group, whole numbers, a clue time and an end rule', () => {
    expect(validateSettings(2, defaultSettings()).ok).toBe(false)
    expect(validateSettings(MAX_PLAYERS + 1, defaultSettings()).ok).toBe(false)
    expect(validateSettings(6, { ...defaultSettings(), undercover: 0, mrwhite: 0 }).error).toMatch(/at least one/)
    expect(validateSettings(6, { ...defaultSettings(), undercover: 1.5 }).ok).toBe(false)
    expect(validateSettings(6, { ...defaultSettings(), undercover: -1 }).ok).toBe(false)
    expect(validateSettings(6, { ...defaultSettings(), clueSeconds: 7 }).ok).toBe(false)
    expect(validateSettings(6, { ...defaultSettings(), endRule: 'never' }).ok).toBe(false)
    expect(CLUE_SECONDS).toContain(defaultSettings().clueSeconds)
    expect(() => make(4, { undercover: 3 })).toThrow(RangeError)
  })
})

describe('dealing roles and words', () => {
  it('gives exactly x Undercover and y Mr. White, with civilians for the rest', () => {
    for (const [n, x, y] of [[3, 1, 0], [4, 1, 1], [6, 2, 1], [10, 3, 2], [20, 5, 5], [7, 0, 3]]) {
      const g = make(n, { undercover: x, mrwhite: y })
      expect(roleOf(g, 'undercover')).toHaveLength(x)
      expect(roleOf(g, 'mrwhite')).toHaveLength(y)
      expect(roleOf(g, 'civilian')).toHaveLength(n - x - y)
    }
  })

  it('gives civilians one word, Undercover the other, and Mr. White nothing', () => {
    const g = make(6, { undercover: 1, mrwhite: 1 })
    const civ = g.view(idOf(g, 'civilian'))
    const und = g.view(idOf(g, 'undercover'))
    const mw = g.view(idOf(g, 'mrwhite'))
    expect(new Set([civ.you.word, und.you.word])).toEqual(new Set(['Coffee', 'Tea']))
    expect(civ.you.word).not.toBe(und.you.word)
    expect(g.view(idOf(g, 'civilian', 1)).you.word).toBe(civ.you.word)
    expect(mw.you.word).toBeNull()
    expect(mw.you.mrWhite).toBe(true)
  })

  it('never tells anyone their role is Undercover, or shows other roles and words', () => {
    const g = make(6, { undercover: 1, mrwhite: 1 })
    const v = g.view(idOf(g, 'undercover'))
    expect(v.you.role).toBeUndefined()
    expect(v.words).toBeUndefined()
    expect(v.players.every(p => p.role === undefined)).toBe(true)
    expect(JSON.stringify(v)).not.toContain('"role":"undercover"')
    expect(v.counts).toEqual({ civilian: 4, undercover: 1, mrwhite: 1 })
  })

  it('uses real word pairs that are different words', () => {
    expect(WORD_PAIRS.length).toBeGreaterThanOrEqual(50)
    for (const [a, b] of WORD_PAIRS) expect(normalize(a)).not.toBe(normalize(b))
    const g = createUndercover({ players: names(4), settings: defaultSettings(), random: seeded(11) })
    expect(g.words.civilian).not.toBe(g.words.undercover)
  })

  it('gives different roles to the same seats on different seeds', () => {
    const seen = new Set()
    for (let s = 1; s <= 30; s++) seen.add(idOf(createUndercover({ players: names(6), settings: defaultSettings(), random: seeded(s) }), 'undercover'))
    expect(seen.size).toBeGreaterThan(2)
  })
})

describe('the clue round', () => {
  it('starts after everyone is ready, or when the reveal time runs out', () => {
    const g = make(4)
    g.act('p0', { a: 'ready' }, 10)
    expect(g.phase).toBe('reveal')
    g.tick(29000)
    expect(g.phase).toBe('reveal')
    g.tick(30000)
    expect(g.phase).toBe('clue')
    const h = make(3)
    for (const p of h.seats) h.act(p.id, { a: 'ready' }, 5)
    expect(h.phase).toBe('clue')
  })

  it('goes round the players in turn, and only the player whose turn it is can give a clue', () => {
    const g = make(4)
    for (const p of g.seats) g.act(p.id, { a: 'ready' }, 0)
    const first = g.view('p0').turnId
    const other = g.seats.find(p => p.id !== first).id
    expect(g.act(other, { a: 'clue', text: 'hot' }, 1)).toEqual({ error: 'It is not your turn.' })
    expect(g.act(first, { a: 'clue', text: '   ' }, 1)).toEqual({ error: 'Type a clue first.' })
    expect(g.act(first, { a: 'clue', text: 'warm' }, 1)).toBeUndefined()
    expect(g.view('p0').turnId).not.toBe(first)
    expect(g.view('p0').rounds[0].items).toEqual([{ id: first, text: 'warm' }])
  })

  it('does not let a player say their own word, but does for Mr. White who has none', () => {
    const g = make(6, { mrwhite: 1 })
    for (const p of g.seats) g.act(p.id, { a: 'ready' }, 0)
    const turnId = g.view('p0').turnId
    const me = g.seats.find(p => p.id === turnId)
    const mine = me.role === 'mrwhite' ? 'Coffee' : g.view(turnId).you.word
    const result = g.act(turnId, { a: 'clue', text: `I love ${mine.toUpperCase()}` }, 1)
    if (me.role === 'mrwhite') expect(result).toBeUndefined()
    else expect(result).toEqual({ error: 'You cannot say your own word.' })
  })

  it('skips a player who runs out of time, and trims long or messy clues', () => {
    const g = make(4, { clueSeconds: 20 })
    for (const p of g.seats) g.act(p.id, { a: 'ready' }, 0)
    const first = g.view('p0').turnId
    g.tick(20000)
    expect(g.view('p0').rounds[0].items[0]).toEqual({ id: first, text: '(no clue)' })
    const second = g.view('p0').turnId
    g.act(second, { a: 'clue', text: `<b>  x\n${'y'.repeat(80)}` }, 20001)
    const text = g.view('p0').rounds[0].items[1].text
    expect(text.length).toBeLessThanOrEqual(30)
    expect(text).not.toMatch(/[<>\n]/)
  })

  it('moves to voting after everyone has had a turn', () => {
    const g = make(5)
    toVote(g)
    expect(g.view('p0').rounds[0].items).toHaveLength(5)
  })
})

describe('voting', () => {
  it('eliminates the player with the most votes and reveals their role', () => {
    const g = make(6, { undercover: 1 })
    toVote(g)
    const target = idOf(g, 'civilian')
    voteAll(g, target)
    expect(g.phase).toBe('result')
    const v = g.view('p0')
    expect(v.result.eliminated).toEqual({ id: target, name: g.seats.find(p => p.id === target).name, role: 'civilian' })
    expect(v.players.find(p => p.id === target)).toMatchObject({ alive: false, role: 'civilian' })
    expect(v.result.votes).toHaveLength(6)
  })

  it('refuses votes for yourself, for someone out, for the wrong person in a revote, and from the dead', () => {
    const g = make(6)
    toVote(g)
    expect(g.act('p0', { a: 'vote', target: 'p0' }, 1)).toEqual({ error: 'Pick another player who is still in.' })
    expect(g.act('p0', { a: 'vote', target: 'nobody' }, 1).error).toBeTruthy()
    expect(g.act('p0', { a: 'clue', text: 'late' }, 1).error).toBeTruthy()
  })

  it('shows who has voted but not who for, until the vote is over', () => {
    const g = make(6)
    toVote(g)
    g.act('p0', { a: 'vote', target: 'p1' }, 5)
    const v = g.view('p2')
    expect(v.players.find(p => p.id === 'p0').voted).toBe(true)
    expect(v.players.find(p => p.id === 'p1').voted).toBe(false)
    expect(v.result?.votes).toBeUndefined()
    expect(g.view('p0').you.vote).toBe('p1')
    expect(g.view('p2').you.vote).toBeNull()
  })

  it('holds a revote between tied players, and eliminates nobody if it ties again', () => {
    const g = make(6, { undercover: 1 })
    toVote(g)
    // 3 votes for p1, 3 for p2
    ;['p0', 'p2', 'p3'].forEach(id => g.act(id, { a: 'vote', target: 'p1' }, 5))
    ;['p1', 'p4', 'p5'].forEach(id => g.act(id, { a: 'vote', target: id === 'p1' ? 'p2' : 'p2' }, 5))
    expect(g.phase).toBe('vote')
    expect(g.view('p0').candidates.sort()).toEqual(['p1', 'p2'])
    expect(g.act('p0', { a: 'vote', target: 'p3' }, 6).error).toMatch(/tied/)
    ;['p0', 'p2', 'p3'].forEach(id => g.act(id, { a: 'vote', target: 'p1' }, 6))
    ;['p1', 'p4', 'p5'].forEach(id => g.act(id, { a: 'vote', target: 'p2' }, 6))
    expect(g.phase).toBe('result')
    expect(g.view('p0').result).toMatchObject({ eliminated: null, tie: true })
    expect(g.seats.every(p => p.alive)).toBe(true)
  })

  it('settles a revote and counts silence as no vote when time runs out', () => {
    const g = make(5)
    toVote(g)
    g.act('p0', { a: 'vote', target: 'p1' }, 5)
    g.act('p2', { a: 'vote', target: 'p1' }, 5)
    g.tick(1000 + 60001 + 1000) // vote timer
    expect(g.phase).toBe('result')
    expect(g.view('p0').result.eliminated.id).toBe('p1')
  })

  it('goes on to the next round after the result, with a rotated first speaker', () => {
    const g = make(6, { undercover: 1 })
    toVote(g)
    const first1 = g.view('p0').rounds[0].items[0].id
    voteAll(g, idOf(g, 'civilian'))
    g.tick(100000)
    expect(g.phase).toBe('clue')
    expect(g.view('p0').round).toBe(2)
    expect(g.view('p0').rounds).toHaveLength(2)
    const eliminated = g.view('p0').result.eliminated.id
    expect(g.view('p0').turnId).not.toBe(eliminated)
    expect(first1).toBeTruthy()
  })
})

describe('winning', () => {
  it('civilians win when the Undercover and Mr. White are both out', () => {
    const g = make(6, { undercover: 1, mrwhite: 1 })
    toVote(g)
    voteAll(g, idOf(g, 'undercover'))
    expect(g.phase).toBe('result')
    g.tick(100000)
    for (const p of g.seats.filter(q => q.alive)) g.act(p.id, { a: 'ready' }, 1)
    // second round
    while (g.phase === 'clue') g.act(g.view('p0').turnId, { a: 'clue', text: 'ok' }, 100001)
    voteAll(g, idOf(g, 'mrwhite'), 100002)
    expect(g.phase).toBe('guess')
    g.act(idOf(g, 'mrwhite'), { a: 'guess', text: 'nope' }, 100003)
    expect(g.phase).toBe('over')
    expect(g.winner).toBe('civilians')
    expect(g.view('p0').winners.every(id => g.seats.find(p => p.id === id).role === 'civilian')).toBe(true)
  })

  it('Mr. White wins at once by guessing the civilians’ word when voted out', () => {
    const g = make(6, { undercover: 1, mrwhite: 1 })
    toVote(g)
    const mw = idOf(g, 'mrwhite')
    voteAll(g, mw)
    expect(g.phase).toBe('guess')
    expect(g.view('p0').guessFor).toBe(mw)
    expect(g.act('p0', { a: 'guess', text: g.words.civilian }, 5).error).toBeTruthy() // someone else cannot guess
    g.act(mw, { a: 'guess', text: `  ${g.words.civilian.toUpperCase()}! ` }, 5)
    expect(g.phase).toBe('over')
    expect(g.winner).toBe('mrwhite')
    expect(g.view('p0').winners).toEqual([mw])
    expect(g.view('p0').words).toEqual(g.words)
  })

  it('a wrong guess, or no guess in time, lets the game go on', () => {
    const g = make(7, { undercover: 1, mrwhite: 1 })
    toVote(g)
    const mw = idOf(g, 'mrwhite')
    voteAll(g, mw)
    g.act(mw, { a: 'guess', text: g.words.undercover }, 5) // the undercover word is wrong
    expect(g.phase).toBe('result')
    expect(g.view('p0').result.guess).toMatchObject({ id: mw, correct: false })
    const h = make(7, { undercover: 1, mrwhite: 1 })
    toVote(h)
    voteAll(h, idOf(h, 'mrwhite'))
    h.tick(1000 + 60000 + 30001 + 1000)
    expect(h.phase).toBe('result')
  })

  it('infiltrators win when civilians are no more than them (default rule)', () => {
    const g = make(4, { undercover: 1 }) // 3 civilians, 1 undercover
    toVote(g)
    voteAll(g, idOf(g, 'civilian'))
    expect(g.phase).toBe('result') // 2 civilians vs 1: not yet
    g.tick(100000)
    while (g.phase === 'clue') g.act(g.view('p0').turnId, { a: 'clue', text: 'ok' }, 100001)
    const civ = g.seats.find(p => p.alive && p.role === 'civilian').id
    voteAll(g, civ, 100002)
    expect(g.phase).toBe('over') // 1 civilian vs 1 undercover
    expect(g.winner).toBe('undercover')
    expect(g.view('p0').winners).toEqual([idOf(g, 'undercover')])
  })

  it('the "last civilian" rule keeps the game going until one civilian is left', () => {
    const g = make(6, { undercover: 2, endRule: 'last' })
    toVote(g)
    voteAll(g, idOf(g, 'civilian'))
    expect(g.phase).toBe('result') // 3 civilians vs 2: parity would not end it either
    g.tick(100000)
    while (g.phase === 'clue') g.act(g.view('p0').turnId, { a: 'clue', text: 'ok' }, 100001)
    voteAll(g, g.seats.find(p => p.alive && p.role === 'civilian').id, 100002)
    expect(g.phase).toBe('result') // 2 civilians vs 2: parity would end here, this rule does not
    expect(g.winner).toBeNull()
  })

  it('both infiltrator types win together when they outlast the civilians', () => {
    const g = make(6, { undercover: 1, mrwhite: 1, endRule: 'parity' })
    toVote(g)
    let clock = 1e6
    for (let round = 0; round < 3 && g.phase !== 'over'; round++) {
      if (g.phase === 'result') {
        clock += 1e6
        g.tick(clock) // the result screen times out
        while (g.phase === 'clue') g.act(g.view('p0').turnId, { a: 'clue', text: 'ok' }, clock)
      }
      voteAll(g, g.seats.find(p => p.alive && p.role === 'civilian').id, clock)
    }
    expect(g.phase).toBe('over')
    expect(g.winner).toBe('infiltrators')
    expect(g.view('p0').winners.sort()).toEqual([idOf(g, 'undercover'), idOf(g, 'mrwhite')].sort())
  })
})

describe('players leaving', () => {
  it('a player who leaves is out; their turn is skipped; the vote does not wait for them', () => {
    const g = make(6)
    for (const p of g.seats) g.act(p.id, { a: 'ready' }, 0)
    const turn = g.view('p0').turnId
    g.leave(turn, 5)
    expect(g.view('p0').turnId).not.toBe(turn)
    const t2 = make(6)
    toVote(t2)
    const civs = roleOf(t2, 'civilian')
    const [target, leaver] = civs
    const rest = t2.seats.filter(p => p.id !== target && p.id !== leaver)
    rest.forEach(p => t2.act(p.id, { a: 'vote', target }, 5))
    t2.act(target, { a: 'vote', target: rest[0].id }, 5)
    expect(t2.phase).toBe('vote') // still waiting for the one who has not voted
    t2.leave(leaver, 6)
    expect(t2.phase).toBe('result')
    expect(t2.view('p0').result.eliminated.id).toBe(target)
  })

  it('a Mr. White who leaves while guessing just ends their guess', () => {
    const g = make(6, { undercover: 1, mrwhite: 1 })
    toVote(g)
    const mw = idOf(g, 'mrwhite')
    voteAll(g, mw)
    g.leave(mw, 5)
    expect(g.phase).toBe('result')
  })

  it('can end in a win for the other side, or be dropped when too few are left', () => {
    const g = make(3, { undercover: 1 })
    toVote(g)
    g.leave(idOf(g, 'undercover'), 5)
    expect(g.phase).toBe('over')
    expect(g.winner).toBe('civilians')
    const h = make(4)
    h.abort()
    expect(h.winner).toBe('none')
    h.leave('p1', 1) // leaving a finished game changes nothing
    expect(h.phase).toBe('over')
  })
})

describe('views', () => {
  it('count down in seconds from the server clock', () => {
    const g = make(4)
    expect(g.view('p0', 0).left).toBe(30)
    expect(g.view('p0', 12500).left).toBe(18)
    expect(g.view('ghost', 0)).toBeNull()
  })

  it('reveal every role and both words once the game is over', () => {
    const g = make(4, { undercover: 1 })
    g.abort()
    const v = g.view('p1')
    expect(v.players.every(p => p.role)).toBe(true)
    expect(v.words).toBeTruthy()
    expect(v.you.role).toBeTruthy()
  })

  it('ignores junk actions', () => {
    const g = make(4)
    expect(g.act('p0', null, 0)).toBeUndefined()
    expect(g.act('nobody', { a: 'ready' }, 0)).toBeUndefined()
    expect(g.act('p0', { a: 'dance' }, 0)).toBeUndefined()
    expect(g.act('p0', { a: 'vote', target: 'p1' }, 0).error).toBeTruthy()
    expect(g.phase).toBe('reveal')
  })
})

describe('normalize', () => {
  it('ignores case, accents, spaces and punctuation', () => {
    expect(normalize('  Café-Au Lait! ')).toBe('cafeaulait')
    expect(normalize(null)).toBe('')
    expect(normalize('Ice cream')).toBe(normalize('ICECREAM'))
  })
})
