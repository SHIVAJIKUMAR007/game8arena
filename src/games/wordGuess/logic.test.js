import { describe, expect, it } from 'vitest'
import {
  ABSENT, ANSWERS, CORRECT, PRESENT, VALID_WORDS, evaluateGuess, getHint, guessError, hardModeError,
  isValidGuess, keyboardStates, scoreFor, shareGrid, starsFor,
} from './logic'
import { COMMON, EXTRA_GUESSES, FAIR, FAMILIAR } from './dictionary'

const C = CORRECT, P = PRESENT, A = ABSENT
const row = (word, answer) => ({ word, result: evaluateGuess(word, answer) })

describe('evaluateGuess', () => {
  it('marks right spot green, wrong spot yellow, missing grey', () => {
    expect(evaluateGuess('crane', 'crane')).toEqual([C, C, C, C, C])
    expect(evaluateGuess('slate', 'crane')).toEqual([A, A, C, A, C])
    expect(evaluateGuess('nacre', 'crane')).toEqual([P, P, P, P, C])
  })

  it('colours a repeated guess letter only as many times as the answer has it', () => {
    // one E in "abide": the first E in "speed" is yellow, the second is grey (D is yellow too)
    expect(evaluateGuess('speed', 'abide')).toEqual([A, A, P, A, P])
    // "geese" vs "those": the green E at the end uses up the only E, so the other three are grey
    expect(evaluateGuess('geese', 'those')).toEqual([A, A, A, C, C])
  })

  it('a green match claims the letter before an earlier copy can turn yellow', () => {
    // "eerie" vs "crane": the last E is green, so the first two Es are grey, not yellow
    expect(evaluateGuess('eerie', 'crane')).toEqual([A, A, P, A, C])
    // "lever" vs "eater": the E at index 3 is green, so only one other E can be yellow
    expect(evaluateGuess('lever', 'eater')).toEqual([A, P, A, C, C])
    // "eerie" vs "there": two Es in the answer; one is green, so exactly one more E is yellow
    expect(evaluateGuess('eerie', 'there')).toEqual([P, A, P, A, C])
  })

  it('handles repeated letters in the answer', () => {
    expect(evaluateGuess('apple', 'happy')).toEqual([P, P, C, A, A])
    expect(evaluateGuess('papal', 'apple')).toEqual([P, P, C, A, P])
    expect(evaluateGuess('sheep', 'sleep')).toEqual([C, A, C, C, C])
  })

  it('is case-insensitive', () => {
    expect(evaluateGuess('CRANE', 'crane')).toEqual([C, C, C, C, C])
  })
})

describe('word validation', () => {
  it('every list is five lowercase letters with no duplicates', () => {
    for (const list of [COMMON, FAMILIAR, FAIR, EXTRA_GUESSES]) {
      expect(list.filter(w => !/^[a-z]{5}$/.test(w))).toEqual([])
      expect(new Set(list).size).toBe(list.length)
    }
  })

  it('familiarity bands do not overlap', () => {
    const seen = new Map()
    for (const [name, list] of Object.entries({ COMMON, FAMILIAR, FAIR })) {
      for (const w of list) {
        expect(seen.get(w), `${w} is in ${seen.get(w)} and ${name}`).toBeUndefined()
        seen.set(w, name)
      }
    }
  })

  it('every answer is in the approved dictionary', () => {
    for (const w of ANSWERS) expect(VALID_WORDS.has(w), w).toBe(true)
  })

  it('answers are never plurals ending in a lone S', () => {
    expect(ANSWERS.filter(w => /[^siu]s$/.test(w))).toEqual([])
  })

  it('accepts dictionary words and rejects everything else', () => {
    expect(isValidGuess('crane')).toBe(true)
    expect(isValidGuess('apple')).toBe(true)
    expect(isValidGuess('APPLE')).toBe(true)
    expect(isValidGuess(' apple ')).toBe(true)
    expect(isValidGuess('books')).toBe(true) // guess-only plural
    expect(isValidGuess('zzzzz')).toBe(false)
    expect(isValidGuess('aeiou')).toBe(false)
    expect(isValidGuess('appl')).toBe(false)
    expect(isValidGuess('apples')).toBe(false)
    expect(isValidGuess('app1e')).toBe(false)
    expect(isValidGuess('')).toBe(false)
    expect(isValidGuess(null)).toBe(false)
  })

  it('guessError explains why a word can’t be submitted', () => {
    expect(guessError('app')).toBe('Not enough letters')
    expect(guessError('qzxvw')).toBe('Not in word list')
    expect(guessError('apple')).toBeNull()
  })
})

describe('hard mode', () => {
  const rows = [row('crane', 'cigar')] // C green, R yellow, A yellow

  it('requires green letters in place', () => {
    expect(hardModeError(rows, 'arise')).toBe('1st letter must be C')
  })

  it('requires yellow letters somewhere', () => {
    expect(hardModeError(rows, 'chord')).toBe('Guess must contain A')
    expect(hardModeError(rows, 'chant')).toBe('Guess must contain R')
    expect(hardModeError(rows, 'cigar')).toBeNull()
    expect(hardModeError(rows, 'carry')).toBeNull()
  })

  it('counts repeated revealed letters', () => {
    const r = [row('eerie', 'there')] // E yellow, R yellow, E green: two Es and an R must be reused
    expect(hardModeError(r, 'store')).toBe('Guess must contain 2 Es')
    expect(hardModeError(r, 'three')).toBeNull()
    expect(hardModeError(r, 'there')).toBeNull()
  })

  it('applies only when hard mode is on, and enforces hint letters', () => {
    expect(guessError('arise', { rows, hard: false, answer: 'cigar' })).toBeNull()
    expect(guessError('arise', { rows, hard: true, answer: 'cigar' })).toBe('1st letter must be C')
    expect(guessError('carry', { rows, hard: true, given: [1], answer: 'cigar' })).toBe('2nd letter must be I')
  })
})

describe('keyboard, hints and scoring', () => {
  it('keyboard keeps each letter’s best clue', () => {
    const k = keyboardStates([row('stare', 'crane'), row('crane', 'crane')])
    expect(k).toMatchObject({ s: A, t: A, a: C, r: C, e: C, c: C, n: C })
    expect(keyboardStates([row('crane', 'cigar')]).r).toBe(P)
    expect(keyboardStates([row('crane', 'cigar'), row('cigar', 'cigar')]).r).toBe(C) // yellow upgrades to green
    expect(keyboardStates([row('cigar', 'cigar'), row('crane', 'cigar')]).r).toBe(C) // and never downgrades
  })

  it('hints reveal unknown positions left to right and never the whole word', () => {
    expect(getHint('cigar', [], [])).toEqual({ index: 0, letter: 'c' })
    expect(getHint('cigar', [row('crane', 'cigar')], [])).toEqual({ index: 1, letter: 'i' })
    expect(getHint('cigar', [], [0, 1, 2])).toEqual({ index: 3, letter: 'a' })
    expect(getHint('cigar', [], [0, 1, 2, 3])).toBeNull()
  })

  it('stars and score reward fewer guesses', () => {
    expect([1, 2, 3, 4, 5, 6].map(n => starsFor(n))).toEqual([3, 3, 3, 2, 2, 1])
    expect(starsFor(2, 1)).toBe(2)
    expect(scoreFor(1)).toBe(600)
    expect(scoreFor(6)).toBe(100)
    expect(scoreFor(3, { hard: true })).toBe(600)
    expect(scoreFor(6, { hintsUsed: 2 })).toBe(50)
  })

  it('share grid hides the letters', () => {
    expect(shareGrid([row('crane', 'cigar'), row('cigar', 'cigar')])).toBe('🟩🟨🟨⬜⬜\n🟩🟩🟩🟩🟩')
  })
})
