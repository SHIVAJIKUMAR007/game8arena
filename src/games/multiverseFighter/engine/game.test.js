// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { settingsStore } from '../../../platform/settings'
import { ROSTER, fighterById, statsFor } from '../roster'
import { createFx } from './fx'
import { createGame } from './game'
import { drawFighter, createRenderer, drawFighterPreview, drawPortrait } from './render'
import { ENERGY_MAX, INPUT, INTRO_FRAMES, createMatch, step } from './sim'

// jsdom has no canvas, so every 2D call lands on a recording stub. That is enough to catch typos and bad maths in
// the drawing code, which is where a missing variable would otherwise only show up in a real browser.
let calls
function stubContext() {
  const grad = { addColorStop() {} }
  return new Proxy(
    {},
    {
      get(t, k) {
        if (k in t) return t[k]
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad
        if (k === 'measureText') return () => ({ width: 10 })
        return (...a) => {
          calls.push([k, ...a])
          for (const v of a) if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`non-finite argument to ${String(k)}`)
        }
      },
      set(t, k, v) {
        t[k] = v
        return true
      },
    },
  )
}

let q = []
let clock = 0
beforeEach(() => {
  calls = []
  settingsStore.set(s => ({ ...s, sound: false }))
  const ctx = stubContext()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
  q = []
  clock = 1000
  vi.stubGlobal('requestAnimationFrame', cb => {
    q.push(cb)
    return q.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {
    q = []
  })
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const frames = (n, ms = 1000 / 60) => {
  for (let i = 0; i < n; i++) {
    clock += ms
    const cbs = q
    q = []
    cbs.forEach(cb => cb(clock))
  }
}
const canvas = () => document.createElement('canvas')
const setup = (a = 'cap', b = 'paul') => ({ chars: [a, b], stats: [statsFor(fighterById(a)), statsFor(fighterById(b))] })

describe('renderer', () => {
  it('draws every fighter in every state without throwing or producing NaN', () => {
    const ctx = canvas().getContext('2d')
    for (const f of ROSTER) {
      for (const state of ['idle', 'walk', 'jump', 'block', 'hit', 'knock', 'victory', 'attack', 'special']) {
        for (const move of state === 'attack' ? ['punch', 'heavy', 'kick', 'fkick'] : state === 'special' ? ['shield', 'beam', 'storm', 'chain', 'smash', 'web', 'lunge', 'counter', 'combo', 'spin', 'grav'] : ['']) {
          for (const st of [0, 7, 20, 60]) {
            const view = { idx: 0, char: f.id, scale: f.scale, x: 400, y: 20, face: 1, state, move, st, knockT: 54, flash: st % 8 > 4 ? 6 : 0, en: st > 20 ? 100 : 0, counterOn: move === 'counter', parryOn: move === 'combo' }
            drawFighter(ctx, view, st * 3)
            drawFighter(ctx, { ...view, face: -1 }, st * 3)
          }
        }
      }
    }
    expect(calls.length).toBeGreaterThan(1000)
  })

  it('renders whole matches, including all special effects, frame after frame', () => {
    for (const f of ROSTER) {
      const m = createMatch({ seed: 3, chars: [f.id, f.id === 'cap' ? 'paul' : 'cap'], stats: setup(f.id).stats })
      const fx = createFx()
      const r = createRenderer(canvas())
      for (let i = 0; i < INTRO_FRAMES + 1; i++) step(m, 0, 0)
      m.fighters[0].x = 500
      m.fighters[1].x = 760
      m.fighters[0].en = ENERGY_MAX
      for (let i = 0; i < 200; i++) {
        step(m, i === 3 ? INPUT.SPECIAL : i % 50 === 0 ? INPUT.PUNCH : 0, i % 40 === 0 ? INPUT.KICK : 0)
        m.events.forEach(e => fx.onEvent(e))
        m.events = []
        fx.tick()
        r.draw({ ...m, fighters: m.fighters, proj: m.proj, zones: m.zones }, i, fx, 1 + (i % 3) * 0.02)
      }
    }
    expect(calls.length).toBeGreaterThan(1000)
  })

  it('draws portraits and previews', () => {
    for (const f of ROSTER) {
      drawPortrait(canvas(), f.id)
      drawFighterPreview(canvas(), f.id, 10)
    }
    expect(calls.some(c => c[0] === 'drawImage' || c[0] === 'fill')).toBe(true)
  })
})

describe('game loop (local)', () => {
  it('runs a fight, pushes the HUD at about 15Hz, and reaches the match end', () => {
    const huds = []
    const ends = []
    const g = createGame({ canvas: canvas(), mode: 'local', ...setup(), seed: 4, level: 1, me: 0, onHud: h => huds.push(h), onEnd: r => ends.push(r) })
    g.start()
    frames(60)
    expect(huds.length).toBeGreaterThan(5)
    expect(huds.length).toBeLessThan(20)
    expect(huds.at(-1)).toMatchObject({ round: 1, hp: expect.any(Array), banner: expect.any(String) })
    expect(huds[0].banner).toBe('ROUND 1')
    frames(300)
    expect(huds.at(-1).phase).toBe('fight')
    g.dispose()
    expect(ends).toHaveLength(0)
  })

  it('keeps the HUD update rate steady no matter how many ticks run', () => {
    const huds = []
    const g = createGame({ canvas: canvas(), mode: 'local', ...setup(), onHud: h => huds.push(h) })
    g.start()
    frames(120)
    g.dispose()
    expect(huds.length).toBeLessThanOrEqual(34)
  })

  it('moves the player with touch bits and attacks the opponent', () => {
    const huds = []
    const g = createGame({ canvas: canvas(), mode: 'local', ...setup('hulk', 'cap'), onHud: h => huds.push(h) })
    g.start()
    frames(120)
    g.setTouch(INPUT.RIGHT, true)
    frames(90)
    g.setTouch(INPUT.RIGHT, false)
    for (let i = 0; i < 40; i++) {
      g.setTouch(INPUT.HEAVY, true)
      frames(2)
      g.setTouch(INPUT.HEAVY, false)
      frames(25)
    }
    g.dispose()
    expect(Math.min(...huds.at(-1).hp)).toBeLessThan(huds.at(-1).hpMax[0])
  })

  it('pauses and resumes, and the clock stops while paused', () => {
    const g = createGame({ canvas: canvas(), mode: 'local', ...setup() })
    g.start()
    frames(30)
    const t = g.tick
    g.pause()
    expect(g.isPaused()).toBe(true)
    frames(60)
    expect(g.tick).toBe(t)
    g.resume()
    frames(30)
    expect(g.tick).toBeGreaterThan(t)
    g.dispose()
  })

  it('is safe to start twice and to dispose twice, and leaves nothing behind', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const g = createGame({ canvas: canvas(), mode: 'local', ...setup() })
    g.start()
    g.start()
    frames(5)
    g.dispose()
    g.dispose()
    expect(q).toHaveLength(0)
    const added = add.mock.calls.map(c => c[0]).sort()
    const removed = remove.mock.calls.map(c => c[0]).sort()
    for (const type of new Set(added)) expect(removed).toContain(type)
    expect(removed.length).toBe(added.length)
    const before = g.tick
    frames(10)
    expect(g.tick).toBe(before)
  })

  it('survives a StrictMode-style mount, unmount, mount', () => {
    const a = createGame({ canvas: canvas(), mode: 'local', ...setup() })
    a.start()
    a.dispose()
    const b = createGame({ canvas: canvas(), mode: 'local', ...setup() })
    b.start()
    frames(30)
    expect(b.tick).toBeGreaterThan(0)
    expect(a.tick).toBe(0)
    b.dispose()
  })

  it('ignores the pause key online but honours it against the computer', () => {
    const g = createGame({ canvas: canvas(), mode: 'local', ...setup() })
    g.start()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }))
    expect(g.isPaused()).toBe(true)
    g.dispose()
    const pair = linkedPair()
    const h = createGame({ canvas: canvas(), mode: 'host', ...setup(), net: pair.host })
    h.start()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }))
    expect(h.isPaused()).toBe(false)
    h.dispose()
  })
})

// An in-memory pair of netcode sessions with instant delivery.
function linkedPair() {
  const mk = () => ({ input: new Set(), snap: new Set(), ctl: new Set(), status: new Set(), sent: { input: 0, snap: 0 } })
  const h = mk()
  const g = mk()
  const sub = (set, fn) => {
    set.add(fn)
    return () => set.delete(fn)
  }
  const fire = (set, v) => set.forEach(fn => fn(JSON.parse(JSON.stringify(v))))
  const host = {
    role: 'host',
    sendSnapshot: s => (h.sent.snap++, fire(g.snap, s), true),
    sendControl: m => (fire(g.ctl, m), true),
    sendInput: () => false,
    onInput: f => sub(h.input, f),
    onSnapshot: f => sub(h.snap, f),
    onControl: f => sub(h.ctl, f),
    onStatus: f => sub(h.status, f),
    getPing: () => 30,
  }
  const guest = {
    role: 'guest',
    sendInput: (seq, mask) => (g.sent.input++, fire(h.input, { seq, mask }), true),
    sendControl: m => (fire(h.ctl, m), true),
    sendSnapshot: () => false,
    onInput: f => sub(g.input, f),
    onSnapshot: f => sub(g.snap, f),
    onControl: f => sub(g.ctl, f),
    onStatus: f => sub(g.status, f),
    getPing: () => 31,
  }
  return { host, guest, h, g }
}

describe('online: host and guest engines over a linked pair', () => {
  const start = () => {
    const pair = linkedPair()
    const hh = []
    const gh = []
    const ends = { host: [], guest: [] }
    const host = createGame({ canvas: canvas(), mode: 'host', ...setup('cap', 'paul'), seed: 9, me: 0, net: pair.host, onHud: h => hh.push(h), onEnd: r => ends.host.push(r) })
    const guest = createGame({ canvas: canvas(), mode: 'guest', ...setup('cap', 'paul'), seed: 9, me: 1, net: pair.guest, onHud: h => gh.push(h), onEnd: r => ends.guest.push(r) })
    host.start()
    guest.start()
    return { pair, host, guest, hh, gh, ends }
  }

  it('waits for the guest, then runs; the guest sees the same round, timer and health', () => {
    const { pair, host, guest, hh, gh } = start()
    frames(400)
    expect(pair.g.sent.input).toBeGreaterThan(300)
    expect(pair.h.sent.snap).toBeGreaterThan(100)
    const a = hh.at(-1)
    const b = gh.at(-1)
    expect(b.phase).toBe('fight')
    expect(b.round).toBe(a.round)
    expect(Math.abs(b.timer - a.timer)).toBeLessThanOrEqual(1)
    expect(b.hp).toEqual(a.hp)
    expect(b.ping).toBe(31)
    expect(a.ping).toBe(30)
    host.dispose()
    guest.dispose()
  })

  it('moves the guest fighter from the guest input, and the host agrees', () => {
    const { host, guest, gh, hh } = start()
    frames(200)
    guest.setTouch(INPUT.LEFT, true)
    frames(60)
    guest.setTouch(INPUT.LEFT, false)
    frames(30)
    // Fighter 1 started on the right; walking left brings the fighters closer and eventually they trade blows.
    guest.setTouch(INPUT.PUNCH, true)
    frames(2)
    guest.setTouch(INPUT.PUNCH, false)
    frames(200)
    expect(hh.at(-1).hp).toEqual(gh.at(-1).hp)
    host.dispose()
    guest.dispose()
  })

  it('shows a countdown when the opponent drops, and awards the win after 10 seconds', () => {
    const { pair, host, guest, hh, ends } = start()
    frames(200)
    pair.h.status.forEach(f => f({ type: 'lost' }))
    frames(30)
    expect(hh.at(-1).lost).toBeGreaterThan(0)
    expect(hh.at(-1).lost).toBeLessThanOrEqual(10)
    const t = host.tick
    frames(30)
    expect(host.tick).toBe(t) // the simulation is held while we wait
    frames(60 * 11)
    expect(ends.host).toHaveLength(1)
    expect(ends.host[0]).toMatchObject({ winner: 0, me: 0, reason: 'disconnect' })
    host.dispose()
    guest.dispose()
  })

  it('carries on if the opponent comes back inside the window', () => {
    const { pair, host, guest, hh, ends } = start()
    frames(200)
    pair.h.status.forEach(f => f({ type: 'lost' }))
    frames(120)
    pair.h.status.forEach(f => f({ type: 'back' }))
    frames(120)
    expect(hh.at(-1).lost).toBe(0)
    expect(ends.host).toHaveLength(0)
    host.dispose()
    guest.dispose()
  })

  it('ends at once with a win when the opponent leaves on purpose', () => {
    const { pair, host, guest, ends } = start()
    frames(100)
    pair.g.status.forEach(f => f({ type: 'left' }))
    expect(ends.guest[0]).toMatchObject({ winner: 1, me: 1, reason: 'left' })
    host.dispose()
    guest.dispose()
  })

  it('stops listening to the session when disposed', () => {
    const { pair, host, guest } = start()
    frames(10)
    host.dispose()
    guest.dispose()
    expect(pair.h.input.size).toBe(0)
    expect(pair.h.status.size).toBe(0)
    expect(pair.g.snap.size).toBe(0)
    expect(pair.g.ctl.size).toBe(0)
  })
})
