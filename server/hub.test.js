import { afterEach, describe, expect, it } from 'vitest'
import { DURATIONS, cleanName, createHub } from './hub.js'
import { MAX_PLAYERS } from './hideSeekSim.js'

/** A fake connection: records what the server sends and lets a test "type" messages. */
function client(hub) {
  const handlers = { message: [], close: [] }
  const got = []
  const conn = {
    on: (e, fn) => handlers[e].push(fn),
    send: text => got.push(JSON.parse(text)),
    close: () => handlers.close.forEach(f => f()),
  }
  hub.handleConnection(conn)
  return {
    got,
    say: msg => handlers.message.forEach(f => f(typeof msg === 'string' ? msg : JSON.stringify(msg))),
    drop: () => handlers.close.forEach(f => f()),
    last: type => [...got].reverse().find(m => m.t === type),
    all: type => got.filter(m => m.t === type),
  }
}

let hub
afterEach(() => hub?.close())
const fresh = (opts = {}) => (hub = createHub({ tickHz: 100, hideSeconds: 0.05, ...opts }))
const wait = ms => new Promise(r => setTimeout(r, ms))

function twoPlayers() {
  const host = client(fresh())
  host.say({ t: 'create', name: 'Ann' })
  const code = host.last('joined').code
  const guest = client(hub)
  guest.say({ t: 'join', code, name: 'Bob' })
  return { host, guest, code }
}

describe('names', () => {
  it('cleans control characters, tags and length, with a fallback', () => {
    expect(cleanName('  <b>Zed</b>\n  ', 'x')).toBe('bZed/b')
    expect(cleanName('a'.repeat(40), 'x')).toHaveLength(14)
    expect(cleanName('', 'Player 3')).toBe('Player 3')
    expect(cleanName(undefined, 'Player 4')).toBe('Player 4')
    expect(cleanName({}, 'P')).toBe('[object Object]'.slice(0, 14))
  })
})

describe('rooms', () => {
  it('creates a room with a 4-letter code and makes the creator the host', () => {
    const host = client(fresh())
    host.say({ t: 'create', name: 'Ann' })
    const joined = host.last('joined')
    expect(joined.code).toMatch(/^[A-HJ-NP-Z]{4}$/)
    expect(host.last('room')).toMatchObject({ code: joined.code, hostId: joined.id, phase: 'lobby', settings: { duration: 180, map: 'random' } })
    expect(host.last('room').players).toEqual([{ id: joined.id, name: 'Ann' }])
  })

  it('lets others join by code (any case), gives repeated names a number, and tells everyone', () => {
    const { host, guest, code } = twoPlayers()
    const third = client(hub)
    third.say({ t: 'join', code: code.toLowerCase(), name: 'Bob' })
    const names = host.last('room').players.map(p => p.name)
    expect(names).toEqual(['Ann', 'Bob', 'Bob 2'])
    expect(guest.last('room').players).toHaveLength(3)
  })

  it('refuses unknown codes, a second room, a full room and a started game', async () => {
    const { host, guest, code } = twoPlayers()
    const lost = client(hub)
    lost.say({ t: 'join', code: 'ZZZZ', name: 'X' })
    expect(lost.last('error').message).toMatch(/not found/)
    host.say({ t: 'create', name: 'again' })
    expect(host.last('error').message).toMatch(/already in a room/)
    for (let i = 0; i < MAX_PLAYERS - 2; i++) client(hub).say({ t: 'join', code, name: `n${i}` })
    const extra = client(hub)
    extra.say({ t: 'join', code, name: 'late' })
    expect(extra.last('error').message).toMatch(/full/)
    host.say({ t: 'start' })
    const latecomer = client(hub)
    latecomer.say({ t: 'join', code, name: 'late2' })
    expect(latecomer.last('error').message).toMatch(/already started/)
    expect(guest.last('start')).toBeTruthy()
  })

  it('limits the number of rooms', () => {
    fresh({ maxRooms: 1 })
    client(hub).say({ t: 'create', name: 'a' })
    const b = client(hub)
    b.say({ t: 'create', name: 'b' })
    expect(b.last('error').message).toMatch(/full/)
  })

  it('ignores junk messages without crashing', () => {
    const c = client(fresh())
    for (const junk of ['not json', '42', 'null', '{"t":"nope"}', JSON.stringify({ t: 'start' }), 'x'.repeat(5000)]) c.say(junk)
    expect(c.got).toEqual([])
  })

  it('only the host can change the time, and only to allowed values', () => {
    const { host, guest } = twoPlayers()
    guest.say({ t: 'settings', duration: 60 })
    expect(host.last('room').settings.duration).toBe(180)
    host.say({ t: 'settings', duration: 61 })
    expect(host.last('room').settings.duration).toBe(180)
    host.say({ t: 'settings', duration: DURATIONS[0] })
    expect(guest.last('room').settings.duration).toBe(DURATIONS[0])
  })

  it('lets the host pick a map from the list or random, and ignores unknown maps', () => {
    const { host, guest } = twoPlayers()
    expect(host.last('room').maps.map(m => m.id)).toEqual(['crates', 'town', 'maze', 'plaza', 'forest'])
    host.say({ t: 'settings', map: 'maze' })
    expect(guest.last('room').settings.map).toBe('maze')
    host.say({ t: 'settings', map: 'moon' })
    guest.say({ t: 'settings', map: 'forest' })
    expect(host.last('room').settings.map).toBe('maze')
    host.say({ t: 'settings', map: 'random' })
    expect(host.last('room').settings.map).toBe('random')
  })

  it('plays on the chosen map, or on any of the maps when random', () => {
    const { host, guest } = twoPlayers()
    host.say({ t: 'settings', map: 'town' })
    host.say({ t: 'start' })
    const start = guest.last('start')
    expect(start).toMatchObject({ map: 'town', mapName: 'Town', world: { w: 2100, h: 1400 } })
    expect(start.walls.length).toBeGreaterThan(15)
    const seen = new Set()
    for (let i = 0; i < 40; i++) {
      const h = client(fresh())
      h.say({ t: 'create', name: 'a' })
      const g = client(hub)
      g.say({ t: 'join', code: h.last('joined').code, name: 'b' })
      h.say({ t: 'start' })
      seen.add(h.last('start').map)
    }
    expect(seen.size).toBeGreaterThan(2)
  })

  it('moves the host on when the host leaves, and removes an empty room', () => {
    const { host, guest, code } = twoPlayers()
    host.drop()
    expect(guest.last('room').players).toHaveLength(1)
    expect(guest.last('room').hostId).toBe(guest.last('joined').id)
    guest.say({ t: 'leave' })
    expect(hub.rooms.has(code)).toBe(false)
  })
})

describe('playing', () => {
  it('needs two players and the host to start', () => {
    const host = client(fresh())
    host.say({ t: 'create', name: 'Ann' })
    host.say({ t: 'start' })
    expect(host.last('error').message).toMatch(/at least 2/)
    const guest = client(hub)
    guest.say({ t: 'join', code: host.last('joined').code, name: 'Bob' })
    guest.say({ t: 'start' })
    expect(guest.last('start')).toBeUndefined()
  })

  it('starts the game: everyone learns the mafia and the map, and gets private snapshots', async () => {
    const { host, guest } = twoPlayers()
    host.say({ t: 'start' })
    const a = host.last('start')
    const b = guest.last('start')
    expect(a.mafiaId).toBe(b.mafiaId)
    expect([host.last('joined').id, guest.last('joined').id]).toContain(a.mafiaId)
    expect(a.walls.length).toBeGreaterThan(0)
    expect(a.you).not.toBe(b.you)
    await wait(120)
    const mine = host.last('state')
    expect(mine.me.role).toBe(a.mafiaId === a.you ? 'mafia' : 'villager')
    expect(host.last('room').phase).toBe('game')
  })

  it('runs to the end when the mafia leaves, tells everyone who won, and goes back to the lobby', async () => {
    const { host, guest } = twoPlayers()
    host.say({ t: 'start' })
    const mafiaId = host.last('start').mafiaId
    const mafia = host.last('joined').id === mafiaId ? host : guest
    const other = mafia === host ? guest : host
    mafia.drop()
    await wait(150)
    expect(other.last('over')).toMatchObject({ winner: 'villagers', mafiaId })
    other.say({ t: 'lobby' }) // the remaining player is now host
    expect(other.last('room').phase).toBe('lobby')
  })

  it('lets the host, not others, return to the lobby after a game', async () => {
    const { host, guest } = twoPlayers()
    host.say({ t: 'settings', duration: 60 })
    host.say({ t: 'start' })
    host.say({ t: 'lobby' })
    expect(host.last('room').phase).toBe('game') // too early
    const sim = [...hub.rooms.values()][0].sim
    sim.finish('villagers')
    await wait(80)
    guest.say({ t: 'lobby' })
    expect(host.last('room').phase).toBe('over')
    host.say({ t: 'lobby' })
    expect(guest.last('room').phase).toBe('lobby')
  })

  it('applies input to the right player', async () => {
    const { host, guest } = twoPlayers()
    host.say({ t: 'start' })
    const sim = [...hub.rooms.values()][0].sim
    const id = guest.last('joined').id
    guest.say({ t: 'input', dx: 1, dy: 0, aim: 1.5, fire: 0 })
    expect(sim.players.get(id).input).toMatchObject({ dx: 1, aim: 1.5 })
  })
})
