import { describe, expect, it } from 'vitest'
import { avatarAt, cellsInLines, clearCell, emptyBoard, isComplete, lineNames, nextEmpty, placeNumber, shuffledBoard, unusedNumbers } from './boardSetup'
import { isValidBoard } from '../../../server/bingo'

describe('board setup', () => {
  it('starts empty with every number still to place', () => {
    const b = emptyBoard()
    expect(b).toHaveLength(25)
    expect(unusedNumbers(b)).toHaveLength(25)
    expect(isComplete(b)).toBe(false)
  })

  it('places a number, moves it if it was elsewhere, and returns a replaced number to the tray', () => {
    let b = placeNumber(emptyBoard(), 0, 7)
    expect(b[0]).toBe(7)
    b = placeNumber(b, 3, 7)
    expect(b[0]).toBeNull()
    expect(b[3]).toBe(7)
    b = placeNumber(b, 3, 9)
    expect(unusedNumbers(b)).toContain(7)
    expect(b.filter(c => c === 9)).toHaveLength(1)
  })

  it('ignores numbers and cells that do not exist, without changing the board', () => {
    const b = emptyBoard()
    expect(placeNumber(b, 0, 26)).toBe(b)
    expect(placeNumber(b, 0, 0)).toBe(b)
    expect(placeNumber(b, 25, 3)).toBe(b)
    expect(placeNumber(b, 0, 1.5)).toBe(b)
  })

  it('clears a cell, and leaves an empty one alone', () => {
    const b = placeNumber(emptyBoard(), 2, 5)
    expect(clearCell(b, 2)[2]).toBeNull()
    expect(clearCell(b, 4)).toBe(b)
  })

  it('finds the next empty cell, wrapping round, and -1 when full', () => {
    let b = emptyBoard()
    expect(nextEmpty(b)).toBe(0)
    b = placeNumber(b, 0, 1)
    expect(nextEmpty(b, 0)).toBe(1)
    b = placeNumber(placeNumber(b, 24, 2), 23, 3)
    expect(nextEmpty(b, 22)).toBe(1) // 23 and 24 are full, so it wraps to the first free cell
    expect(nextEmpty(shuffledBoard(() => 0.3))).toBe(-1)
  })

  it('shuffles into a complete, valid board', () => {
    const b = shuffledBoard(Math.random)
    expect(isComplete(b)).toBe(true)
    expect(isValidBoard(b)).toBe(true)
  })

  it('names lines and finds the cells they cover', () => {
    expect(lineNames([0, 7, 10, 11])).toEqual(['Row 1', 'Column 3', 'Diagonal ↘', 'Diagonal ↙'])
    expect([...cellsInLines([0, 5])].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 10, 15, 20])
  })

  it('gives each lobby place its own face and colour', () => {
    const faces = Array.from({ length: 8 }, (_, i) => avatarAt(i))
    expect(new Set(faces.map(f => f.emoji)).size).toBe(8)
    expect(new Set(faces.map(f => f.color)).size).toBe(8)
  })
})
