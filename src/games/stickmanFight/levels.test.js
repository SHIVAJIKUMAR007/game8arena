import { describe, expect, it } from 'vitest'
import { validateEngine } from '../../platform/engine'
import { ARENA_ORDER } from './data'
import { LEVEL_COUNT, MAX_DIFFICULTY, engine, evaluateDifficulty, generateLevel, getHint, levelSeed, rewardFor, targetDifficulty, validateLevel } from './levels'

const lv = n => generateLevel(levelSeed(n), { level: n })

describe('campaign levels', () => {
  it('implements the shared game-engine contract', () => {
    expect(validateEngine(engine).ok).toBe(true)
  })

  it('same seed and level always give the same level', () => {
    expect(lv(7)).toEqual(lv(7))
    expect(lv(45)).toEqual(lv(45))
    expect(generateLevel('other', { level: 7 })).not.toEqual(lv(7))
  })

  it('level 1 is easy: a weak Rookie with a sword on the first arena', () => {
    const l = lv(1)
    expect(l.enemy.weapon).toBe('sword')
    expect(l.arenaId).toBe(ARENA_ORDER[0])
    expect(l.enemy.hpMax).toBeLessThan(70)
    expect(l.enemy.skill).toBeLessThan(0.1)
    expect(l.enemy.dmgMult).toBeLessThan(0.75)
    expect(evaluateDifficulty(l)).toBeLessThan(10)
  })

  it('rises gradually with no big jump between neighbouring levels, boss levels included', () => {
    let prev = evaluateDifficulty(lv(1))
    for (let n = 2; n <= LEVEL_COUNT + 10; n++) {
      const d = evaluateDifficulty(lv(n))
      expect(d - prev, `level ${n}`).toBeLessThan(9)
      prev = d
    }
    expect(evaluateDifficulty(lv(LEVEL_COUNT))).toBeGreaterThan(evaluateDifficulty(lv(5)) + 40)
    for (let n = 2; n < 80; n++) expect(targetDifficulty(n)).toBeGreaterThanOrEqual(targetDifficulty(n - 1))
  })

  it('never goes above the maximum, and keeps making new fights at the cap', () => {
    const late = []
    for (let n = 1; n <= 300; n++) {
      const l = lv(n)
      expect(l.difficulty).toBeLessThanOrEqual(MAX_DIFFICULTY)
      expect(evaluateDifficulty(l)).toBeLessThanOrEqual(MAX_DIFFICULTY)
      expect(validateLevel(l).ok, `level ${n}: ${validateLevel(l).errors}`).toBe(true)
      if (n > LEVEL_COUNT) late.push(l)
    }
    expect(late.every(l => l.difficulty === MAX_DIFFICULTY)).toBe(true)
    const variety = new Set(late.map(l => `${l.arenaId}:${l.variant}:${l.enemy.weapon}`))
    expect(variety.size).toBeGreaterThan(15)
  })

  it('introduces the weapons one at a time and puts a boss on every fifth level', () => {
    expect(lv(2).enemy.weapon).toBe('sword')
    expect(lv(3).enemy.weapon).toBe('spear')
    expect(lv(5).boss).toBe(true)
    expect(lv(5).enemy.name.startsWith('Boss')).toBe(true)
    expect(lv(4).boss).toBe(false)
  })

  it('validateLevel rejects broken levels without throwing', () => {
    expect(validateLevel(null).ok).toBe(false)
    expect(validateLevel({}).ok).toBe(false)
    const bad = { ...lv(3), enemy: { ...lv(3).enemy, weapon: 'laser' }, difficulty: 500 }
    const r = validateLevel(bad)
    expect(r.ok).toBe(false)
    expect(r.errors.length).toBeGreaterThan(1)
    expect(evaluateDifficulty(null)).toBe(0)
  })

  it('offers a hint and pays less for replays', () => {
    expect(getHint(lv(3))).toBeTruthy()
    expect(getHint(null)).toBeNull()
    expect(rewardFor(5, 3, true)).toBeGreaterThan(rewardFor(5, 3, false))
    expect(rewardFor(30, 3, true)).toBeGreaterThan(rewardFor(1, 1, true))
  })
})
