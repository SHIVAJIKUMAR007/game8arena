import { describe, expect, it } from 'vitest'
import { MAX_UPGRADE, ROSTER, START_UNLOCKED, beltIndex, fighterById, statsFor, upgradeCost } from './roster'
import { DAILY_COOLDOWN_MS, DEFAULT_SAVE, START_COINS, XP_PER_LEVEL, addCoins, aiProfile, applyFightResult, buyFighter, buyUpgrade, claimDaily, dailyRemaining, pickOpponent, sanitizeSave, selectFighter } from './store'

const fresh = () => sanitizeSave(null)

describe('roster', () => {
  it('has twelve fighters, six per universe, with unique ids', () => {
    expect(ROSTER).toHaveLength(12)
    expect(new Set(ROSTER.map(f => f.id)).size).toBe(12)
    expect(ROSTER.filter(f => f.universe === 'MCU')).toHaveLength(6)
    expect(ROSTER.filter(f => f.universe === 'Dune')).toHaveLength(6)
  })
  it('keeps every stat from 1 to 10 and prices the locked ones from 100 to 500', () => {
    for (const f of ROSTER) {
      for (const k of ['power', 'health', 'speed']) {
        expect(f[k]).toBeGreaterThanOrEqual(1)
        expect(f[k]).toBeLessThanOrEqual(10)
      }
      if (START_UNLOCKED.includes(f.id)) expect(f.price).toBe(0)
      else {
        expect(f.price).toBeGreaterThanOrEqual(100)
        expect(f.price).toBeLessThanOrEqual(500)
      }
      expect(f.special.name).toBeTruthy()
    }
    expect(START_UNLOCKED).toEqual(['cap', 'paul'])
  })
  it('makes Hulk the slowest with the most power and health', () => {
    const hulk = fighterById('hulk')
    for (const f of ROSTER) {
      expect(hulk.power).toBeGreaterThanOrEqual(f.power)
      expect(hulk.health).toBeGreaterThanOrEqual(f.health)
      expect(hulk.speed).toBeLessThanOrEqual(f.speed)
    }
  })
  it('scales stats with upgrades and the AI multiplier', () => {
    const f = fighterById('cap')
    const base = statsFor(f)
    expect(statsFor(f, { power: 3, health: 3 }).hpMax).toBeGreaterThan(base.hpMax)
    expect(statsFor(f, { power: 3 }).dmgMult).toBeGreaterThan(base.dmgMult)
    expect(statsFor(f, {}, 1.5).hpMax).toBe(Math.round(base.hpMax * 1.5))
    expect(statsFor(f, { power: 99, health: 99 }).hpMax).toBe(statsFor(f, { power: MAX_UPGRADE, health: MAX_UPGRADE }).hpMax)
  })
  it('makes each upgrade cost more than the last', () => {
    for (let i = 0; i < MAX_UPGRADE; i++) expect(upgradeCost(i + 1)).toBeGreaterThan(upgradeCost(i))
    expect(upgradeCost(0)).toBe(50)
  })
  it('moves up a belt every two levels, capped at the last belt', () => {
    expect(beltIndex(1)).toBe(0)
    expect(beltIndex(3)).toBe(1)
    expect(beltIndex(9999)).toBe(6)
  })
})

describe('save sanitising', () => {
  it('starts a new player with 65 coins at level 1 and two fighters', () => {
    expect(fresh()).toMatchObject({ coins: START_COINS, level: 1, unlocked: ['cap', 'paul'], selected: 'cap', lastDaily: 0 })
    expect(START_COINS).toBe(65)
  })
  it.each([[null], [undefined], [42], ['junk'], [[]], [{}], [{ v: 99, coins: 5000 }]])('falls back to defaults for %j', raw => {
    expect(sanitizeSave(raw)).toEqual(fresh())
  })
  it('repairs a hand-edited or damaged save field by field', () => {
    const s = sanitizeSave({ v: 1, coins: -50, level: 'high', xp: 5000, selected: 'nobody', unlocked: ['thor', 'ghost', 7], upgrades: { cap: { power: 99, health: -2 }, ghost: { power: 1 } }, lastDaily: 'x', wins: NaN })
    expect(s.coins).toBe(0)
    expect(s.level).toBe(1)
    expect(s.xp).toBe(XP_PER_LEVEL - 1)
    expect(s.selected).toBe('cap')
    expect(s.unlocked.sort()).toEqual(['cap', 'paul', 'thor'])
    expect(s.upgrades).toEqual({ cap: { power: MAX_UPGRADE, health: 0 } })
    expect(s.lastDaily).toBe(0)
    expect(s.wins).toBe(0)
  })
  it('never lets the selected fighter be a locked one', () => {
    expect(sanitizeSave({ ...DEFAULT_SAVE, selected: 'hulk' }).selected).toBe('cap')
    expect(sanitizeSave({ ...DEFAULT_SAVE, unlocked: ['hulk'], selected: 'hulk' }).selected).toBe('hulk')
  })
  it('round-trips through JSON unchanged', () => {
    const s = { ...fresh(), coins: 300, level: 4, xp: 40, unlocked: ['cap', 'paul', 'thor'], upgrades: { cap: { power: 2, health: 1 } }, lastDaily: 12345 }
    expect(sanitizeSave(JSON.parse(JSON.stringify(s)))).toEqual(s)
  })
})

describe('progression', () => {
  it('pays 30 coins and XP for a win and 10 for a loss', () => {
    const w = applyFightResult(fresh(), { won: true })
    expect(w).toMatchObject({ coins: 30, xp: 30, levelUp: false })
    expect(w.save.coins).toBe(START_COINS + 30)
    const l = applyFightResult(fresh(), { won: false })
    expect(l.save.coins).toBe(START_COINS + 10)
    expect(l.save.losses).toBe(1)
  })
  it('levels up after a few wins and carries leftover XP', () => {
    let s = fresh()
    const ups = []
    for (let i = 0; i < 4; i++) {
      const r = applyFightResult(s, { won: true })
      ups.push(r.levelUp)
      s = r.save
    }
    expect(ups).toEqual([false, false, false, true])
    expect(s.level).toBe(2)
    expect(s.xp).toBe(20)
  })
  it('makes the computer tougher with the level, but never past x1.6', () => {
    expect(aiProfile(1).scale).toBe(1)
    expect(aiProfile(5).scale).toBeGreaterThan(aiProfile(2).scale)
    expect(aiProfile(500).scale).toBe(1.6)
    expect(aiProfile(500).card).toBe(MAX_UPGRADE)
  })
  it('picks a random opponent that is never the player', () => {
    for (let i = 0; i < 40; i++) expect(pickOpponent('cap')).not.toBe('cap')
    expect(pickOpponent('cap', () => 0)).toBe('ironman')
  })
})

describe('shop', () => {
  it('buys a fighter only with enough coins', () => {
    const poor = fresh()
    expect(buyFighter(poor, 'hulk')).toMatchObject({ ok: false, reason: 'coins' })
    const rich = addCoins(poor, 1000)
    const r = buyFighter(rich, 'hulk')
    expect(r.ok).toBe(true)
    expect(r.save.coins).toBe(rich.coins - 500)
    expect(r.save.unlocked).toContain('hulk')
    expect(buyFighter(r.save, 'hulk').reason).toBe('owned')
    expect(buyFighter(poor, 'nobody').ok).toBe(false)
  })
  it('buys upgrades at a rising price and stops at the maximum', () => {
    let s = addCoins(fresh(), 100000)
    let last = s.coins
    for (let i = 0; i < MAX_UPGRADE; i++) {
      const r = buyUpgrade(s, 'cap', 'power')
      expect(r.ok).toBe(true)
      expect(last - r.save.coins).toBe(upgradeCost(i))
      last = r.save.coins
      s = r.save
    }
    expect(buyUpgrade(s, 'cap', 'power')).toMatchObject({ ok: false, reason: 'max' })
    expect(buyUpgrade(s, 'hulk', 'power').ok).toBe(false)
    expect(buyUpgrade(s, 'cap', 'speed').ok).toBe(false)
  })
  it('selects only fighters you own', () => {
    expect(selectFighter(fresh(), 'paul').selected).toBe('paul')
    expect(selectFighter(fresh(), 'hulk').selected).toBe('cap')
  })
})

describe('daily reward', () => {
  it('can be claimed once, then again after 24 hours', () => {
    const t0 = 1_700_000_000_000
    const a = claimDaily(fresh(), t0)
    expect(a.ok).toBe(true)
    expect(a.save.coins).toBe(START_COINS + 50)
    const b = claimDaily(a.save, t0 + 1000)
    expect(b.ok).toBe(false)
    expect(b.remainingMs).toBe(DAILY_COOLDOWN_MS - 1000)
    expect(claimDaily(a.save, t0 + DAILY_COOLDOWN_MS - 1).ok).toBe(false)
    expect(claimDaily(a.save, t0 + DAILY_COOLDOWN_MS).ok).toBe(true)
    expect(dailyRemaining(fresh(), t0)).toBe(0)
  })
})
