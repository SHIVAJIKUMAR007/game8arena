import { describe, expect, it } from 'vitest'
import { createRng } from '../../platform/rng'
import {
  COLS, columnOf, columnRange, completionCall, generateTicket, isGoalMet, positionsOf, ticketNumbers, validateTicket, winningNumbers,
} from './ticket'

const tickets = n => Array.from({ length: n }, (_, i) => generateTicket(createRng(`t${i}`)))

describe('tambola tickets', () => {
  it('follow every ticket rule across many random tickets', () => {
    for (const t of tickets(300)) {
      expect(validateTicket(t)).toEqual({ ok: true, errors: [] })
      expect(t).toHaveLength(3)
      t.forEach(row => {
        expect(row).toHaveLength(9)
        expect(row.filter(n => n !== null)).toHaveLength(5) // 5 numbers, 4 blanks
      })
      const nums = ticketNumbers(t)
      expect(nums).toHaveLength(15)
      expect(new Set(nums).size).toBe(15)
      expect(nums.every(n => n >= 1 && n <= 90)).toBe(true)
    }
  })

  it('keep numbers ascending left to right in each row and in their own column range', () => {
    for (const t of tickets(100)) {
      t.forEach(row => {
        const nums = row.filter(n => n !== null)
        expect(nums).toEqual(nums.slice().sort((a, b) => a - b))
        row.forEach((n, c) => { if (n !== null) expect(columnOf(n)).toBe(c) })
      })
    }
  })

  it('have the standard column ranges', () => {
    expect(columnRange(0)).toEqual([1, 9])
    expect(columnRange(4)).toEqual([40, 49])
    expect(columnRange(COLS - 1)).toEqual([80, 90])
    expect(columnOf(90)).toBe(8)
    expect(columnOf(9)).toBe(0)
    expect(columnOf(10)).toBe(1)
  })

  it('are identical for the same seed and different for another', () => {
    expect(generateTicket(createRng('a'))).toEqual(generateTicket(createRng('a')))
    expect(generateTicket(createRng('a'))).not.toEqual(generateTicket(createRng('b')))
  })

  it('are rejected by validateTicket when they break a rule', () => {
    const good = generateTicket(createRng('x'))
    expect(validateTicket(null).ok).toBe(false)
    expect(validateTicket([[1]]).ok).toBe(false)
    const sixInRow = good.map(r => r.slice())
    const blank = sixInRow[0].findIndex(n => n === null)
    sixInRow[0][blank] = columnRange(blank)[0]
    expect(validateTicket(sixInRow).ok).toBe(false)
    const dup = good.map(r => r.slice())
    const c = dup[0].findIndex(n => n !== null)
    dup[1][c] = dup[0][c]
    expect(validateTicket(dup).ok).toBe(false)
    const wrongColumn = good.map(r => r.slice())
    wrongColumn[0][c] = 90
    expect(validateTicket(wrongColumn).ok).toBe(false)
  })
})

describe('tambola goals', () => {
  const t = generateTicket(createRng('goals'))
  const nums = ticketNumbers(t)

  it('earlyFive needs any five marked numbers', () => {
    expect(isGoalMet('earlyFive', t, new Set(nums.slice(0, 4)))).toBe(false)
    expect(isGoalMet('earlyFive', t, new Set(nums.slice(0, 5)))).toBe(true)
    expect(isGoalMet('earlyFive', t, new Set([91, 92, 93, 94, 95]))).toBe(false)
  })

  it('line needs a whole row', () => {
    const row = t[1].filter(n => n !== null)
    expect(isGoalMet('line', t, new Set(row.slice(1)))).toBe(false)
    expect(isGoalMet('line', t, new Set(row))).toBe(true)
  })

  it('fullHouse needs all fifteen', () => {
    expect(isGoalMet('fullHouse', t, new Set(nums.slice(1)))).toBe(false)
    expect(isGoalMet('fullHouse', t, new Set(nums))).toBe(true)
  })

  it('an unknown goal is never met', () => {
    expect(isGoalMet('nope', t, new Set(nums))).toBe(false)
  })

  it('completionCall and winningNumbers agree with a simulated game', () => {
    const calls = createRng('order').shuffle(Array.from({ length: 90 }, (_, i) => i + 1))
    const position = positionsOf(calls)
    for (const goal of ['earlyFive', 'line', 'fullHouse']) {
      const at = completionCall(goal, t, position)
      const marked = new Set()
      let first = Infinity
      calls.forEach((n, i) => {
        marked.add(n)
        if (first === Infinity && isGoalMet(goal, t, marked)) first = i + 1
      })
      expect(at).toBe(first)
      const need = winningNumbers(goal, t, position)
      expect(Math.max(...need.map(n => position[n]))).toBe(at)
    }
  })
})
