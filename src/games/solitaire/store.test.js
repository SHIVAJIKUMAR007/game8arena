import { describe, expect, it } from 'vitest'
import { SAVE_VERSION, formatTime, readPrefs, readSave, readStats, recordStart, recordWin, summarize } from './store'
import { columnOffsets, dropRects, dropTarget, tableMetrics } from './layout'

const emptyMode = { played: 0, won: 0, times: [], fewestMoves: null, bestScore: 0 }
const empty = { played: 0, won: 0, streak: 0, maxStreak: 0, open: false, totalTime: 0, modes: { d1: emptyMode, d3: emptyMode } }

describe('saved statistics', () => {
  it('start empty and survive missing or corrupted data', () => {
    expect(readStats({})).toEqual(empty)
    expect(readStats(null)).toEqual(empty)
    expect(readStats(undefined)).toEqual(empty)
    expect(readStats({ solStats: 'oops' })).toEqual(empty)
    expect(readStats({ solStats: [] })).toEqual(empty)
    expect(readStats({ solStats: { streak: -3, maxStreak: NaN, totalTime: Infinity, modes: 'x', open: 'yes' } })).toEqual(empty)
    expect(readStats({ solStats: { modes: { d1: { played: -1, won: 'a', times: 'fast', fewestMoves: -9 } } } })).toEqual(empty)
  })

  it('clamps impossible values', () => {
    const s = readStats({ solStats: { streak: 9, maxStreak: 2, modes: { d1: { played: 1, won: 4, times: [300, -5, 'x', 0, NaN, 120, 1e9], fewestMoves: 88.6 } } } })
    expect(s.modes.d1).toEqual({ played: 4, won: 4, times: [120, 300], fewestMoves: 88, bestScore: 0 })
    expect(s.streak).toBe(4)
    expect(s.maxStreak).toBe(4)
  })

  it('records starts, wins, streaks and personal bests per draw mode', () => {
    let s = {}
    s = recordStart(s, { draw: 1 })
    s = recordWin(s, { draw: 1, time: 400, moves: 120, score: 700 })
    s = recordStart(s, { draw: 1 })
    s = recordWin(s, { draw: 1, time: 300, moves: 140, score: 600 })
    s = recordStart(s, { draw: 3 })
    expect(s.streak).toBe(2)
    expect(s.open).toBe(true)
    s = recordStart(s, { draw: 3 }) // gave up the last game: the streak ends
    expect(s.streak).toBe(0)
    expect(s.maxStreak).toBe(2)
    expect(s.modes.d1).toEqual({ played: 2, won: 2, times: [300, 400], fewestMoves: 120, bestScore: 700 })
    expect(s.modes.d3).toMatchObject({ played: 2, won: 0 })
    const sum = summarize(s)
    expect(sum.winPct).toBe(50)
    expect(sum.averageTime).toBe(350)
    expect(sum.bestTime).toEqual({ d1: 300, d3: null })
  })
})

describe('saved games', () => {
  const good = { v: SAVE_VERSION, key: 'campaign:d1:L3', seed: '', moves: [{ type: 'draw' }, { type: 'move', from: 'waste', to: 't2', count: 1 }], elapsed: 42, hints: 1, undos: 2 }

  it('read back a good save', () => {
    expect(readSave({ solSaves: { campaign: good } }, 'campaign', 'campaign:d1:L3')).toEqual(good)
    expect(readSave({ solSaves: { campaign: good } }, 'campaign')).toEqual(good)
  })

  it('ignore a save for another level, draw mode or slot', () => {
    expect(readSave({ solSaves: { campaign: good } }, 'campaign', 'campaign:d1:L4')).toBeNull()
    expect(readSave({ solSaves: { campaign: good } }, 'campaign', 'campaign:d3:L3')).toBeNull()
    expect(readSave({ solSaves: { campaign: good } }, 'random')).toBeNull()
  })

  it('fall back safely on missing, corrupted or old-version saves', () => {
    expect(readSave({}, 'campaign')).toBeNull()
    expect(readSave(null, 'campaign')).toBeNull()
    expect(readSave({ solSaves: 'x' }, 'campaign')).toBeNull()
    expect(readSave({ solSaves: { campaign: { ...good, v: 0 } } }, 'campaign')).toBeNull()
    expect(readSave({ solSaves: { campaign: { ...good, v: 2 } } }, 'campaign')).toBeNull()
    expect(readSave({ solSaves: { campaign: { ...good, key: 7 } } }, 'campaign')).toBeNull()
    expect(readSave({ solSaves: { campaign: { ...good, moves: 'draw' } } }, 'campaign')).toBeNull()
    expect(readSave({ solSaves: { campaign: { ...good, moves: [{ type: 'teleport' }] } } }, 'campaign')).toBeNull()
    expect(readSave({ solSaves: { campaign: { ...good, moves: new Array(6000).fill({ type: 'draw' }) } } }, 'campaign')).toBeNull()
  })

  it('clamp silly numbers', () => {
    const s = readSave({ solSaves: { campaign: { ...good, elapsed: -5, hints: 'x', undos: 1e12 } } }, 'campaign')
    expect(s).toMatchObject({ elapsed: 0, hints: 0, undos: 99999 })
  })

  it('read preferences with defaults', () => {
    expect(readPrefs({})).toEqual({ draw: 1, autoFinish: true })
    expect(readPrefs({ solPrefs: { draw: 3, autoFinish: false } })).toEqual({ draw: 3, autoFinish: false })
    expect(readPrefs({ solPrefs: { draw: 7 } })).toEqual({ draw: 1, autoFinish: true })
    expect(readPrefs({ solPrefs: 'x' })).toEqual({ draw: 1, autoFinish: true })
  })

  it('format times', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(539)).toBe('8:59')
    expect(formatTime(3725)).toBe('1:02:05')
    expect(formatTime(-3)).toBe('0:00')
  })
})

describe('table layout', () => {
  it('fits seven columns across the table and keeps cards card-shaped', () => {
    for (const [w, h] of [[360, 560], [720, 520], [1100, 800]]) {
      const m = tableMetrics(w, h)
      expect(m.colX(6) + m.cw).toBeLessThanOrEqual(w)
      expect(m.colX(0)).toBeGreaterThanOrEqual(0)
      expect(m.ch / m.cw).toBeCloseTo(1.4, 1)
      expect(m.cw).toBeGreaterThanOrEqual(30)
    }
  })

  it('squeezes long columns so they stay on the table', () => {
    const m = tableMetrics(400, 420)
    const long = [Array.from({ length: 19 }, (_, i) => i)]
    const ys = columnOffsets(m, long, [6])[0]
    expect(ys[0]).toBe(0)
    expect(m.tableauY + ys.at(-1) + m.ch).toBeLessThanOrEqual(m.height + 2)
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1])
  })

  it('finds the pile a dragged card is dropped on', () => {
    const m = tableMetrics(720, 520)
    const rects = dropRects(m)
    const at = (x, y) => dropTarget(rects, { left: x, top: y, right: x + m.cw, bottom: y + m.ch })
    expect(at(m.colX(2), m.tableauY + 40)).toBe('t2')
    expect(at(m.colX(4), m.rowY)).toBe('f1')
    expect(at(m.colX(3) + m.cw * 0.7, m.tableauY + 300)).toBe('t4') // mostly over column 5
    expect(at(-500, -500)).toBeNull()
  })
})
