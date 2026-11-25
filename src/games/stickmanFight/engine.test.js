// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEngine } from './engine'
import { settingsStore } from '../../platform/settings'
import { WEAPONS } from './data'

beforeEach(() => settingsStore.set(s => ({ ...s, sound: false })))
afterEach(() => vi.restoreAllMocks())

const fakeCanvas = () => ({ getContext: () => null, style: {}, width: 0, height: 0 })
const versus = (over = {}) => ({
  mode: 'versus',
  arenaId: 'floating',
  variant: 0,
  fighters: [{ name: 'P1', weapon: 'sword' }, { name: 'P2', weapon: 'sword' }],
  ...over,
})
function boot(config = versus()) {
  const ui = []
  const ends = []
  const eng = createEngine({ canvas: fakeCanvas(), config, onUi: s => ui.push(s), onEnd: r => ends.push(r) })
  const run = seconds => {
    for (let i = 0; i < Math.round(seconds * 60); i++) eng._tick(1 / 60)
  }
  return { eng, ui, ends, run, last: () => ui[ui.length - 1] }
}

describe('fight engine', () => {
  it('counts in before the fight: nobody can move during the countdown', () => {
    const { eng, run, last } = boot()
    expect(last().phase).toBe('intro')
    eng.key('KeyD', true)
    run(1)
    expect(eng.match.fighters[0].x).toBeCloseTo(eng.match.fighters[0].spawn.x, 1)
    run(1.3)
    expect(last().phase).toBe('fight')
  })

  it('both players can move at the same time with their own keys', () => {
    const { eng, run } = boot()
    run(2.2)
    const [a, b] = eng.match.fighters
    const ax = a.x
    const bx = b.x
    eng.key('KeyD', true)
    eng.key('ArrowLeft', true)
    run(0.3)
    expect(a.x).toBeGreaterThan(ax + 30)
    expect(b.x).toBeLessThan(bx - 30)
    eng.key('KeyD', false)
    eng.key('ArrowLeft', false)
  })

  it('player 1 keys do not drive player 2, and arrow keys do not drive player 1 in versus', () => {
    const { eng, run } = boot()
    run(2.2)
    const [a, b] = eng.match.fighters
    const bx = b.x
    const ax = a.x
    eng.key('KeyA', true)
    run(0.3)
    expect(b.x).toBeCloseTo(bx, 1)
    expect(a.x).not.toBeCloseTo(ax, 1)
    eng.key('KeyA', false)
    run(0.5) // let the slide stop
    eng.key('ArrowRight', true)
    const ax2 = a.x
    run(0.3)
    expect(a.x).toBeCloseTo(ax2, 1)
    eng.key('ArrowRight', false)
  })

  it('both players can attack in the same moment', () => {
    const { eng, run } = boot()
    run(2.2)
    const [a, b] = eng.match.fighters
    a.x = 450; b.x = 510; a.y = b.y = 470
    run(0.3)
    eng.key('KeyF', true)
    eng.key('KeyK', true)
    run(0.6)
    expect(a.hp).toBeLessThan(a.hpMax)
    expect(b.hp).toBeLessThan(b.hpMax)
  })

  it('pauses and resumes with P and Escape, and holds the fight still while paused', () => {
    const { eng, run, last } = boot()
    run(2.2)
    eng.key('KeyP', true)
    expect(last().paused).toBe(true)
    const t = eng.match.t
    run(1)
    expect(eng.match.t).toBe(t)
    eng.key('Escape', true)
    expect(last().paused).toBe(false)
    run(0.5)
    expect(eng.match.t).toBeGreaterThan(t)
  })

  it('reports the winner once, after a knockout', () => {
    const { eng, run, ends, last } = boot()
    run(2.2)
    const [a, b] = eng.match.fighters
    a.x = 450; b.x = 510; a.y = b.y = 470
    b.hp = 1
    run(0.2)
    eng.key('KeyF', true)
    run(4)
    expect(last().phase).toBe('over')
    expect(ends).toHaveLength(1)
    expect(ends[0].winner).toBe(0)
    expect(ends[0].reason).toBe('ko')
    run(2)
    expect(ends).toHaveLength(1)
  })

  it('touch buttons act like keys', () => {
    const { eng, run } = boot()
    run(2.2)
    const a = eng.match.fighters[0]
    const x = a.x
    eng.setTouch(0, 'right', true)
    run(0.3)
    eng.setTouch(0, 'right', false)
    expect(a.x).toBeGreaterThan(x + 30)
  })

  it('ignores keys it does not use', () => {
    const { eng } = boot()
    expect(eng.key('KeyQ', true)).toBe(false)
    expect(eng.key('KeyW', true)).toBe(true)
  })

  it('single player: the computer fighter moves by itself and arrow keys also control player 1', () => {
    const cfg = { ...versus(), mode: 'single', skill: 0.8, fighters: [{ name: 'You', weapon: 'sword' }, { name: 'Bot', weapon: 'sword', isAI: true }] }
    const { eng, run } = boot(cfg)
    run(2.2)
    const [a, b] = eng.match.fighters
    const bx = b.x
    const ax = a.x
    eng.key('ArrowRight', true)
    run(0.3)
    eng.key('ArrowRight', false)
    expect(a.x).toBeGreaterThan(ax + 30)
    run(1)
    expect(b.x).not.toBeCloseTo(bx, 0)
  })

  it('the HUD snapshot carries health, special cooldown and names', () => {
    const { run, last } = boot()
    run(2.2)
    const p = last().players[0]
    expect(p.name).toBe('P1')
    expect(p.hp).toBe(100)
    expect(p.special).toBe(WEAPONS.sword.special.name)
    expect(p.cdMax).toBe(WEAPONS.sword.special.cd)
  })
})
