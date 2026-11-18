// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import WordGame from './WordGame'
import { generateLevel, dailyPuzzle } from './levels'
import { ANSWERS, evaluateGuess, guessError } from './logic'
import { progressStore, getProgress } from '../../platform/progress'
import { settingsStore } from '../../platform/settings'
import { todayKey } from '../../platform/daily'

const fresh = () => ({
  level: 1, best: 0, stars: {}, highScore: 0, extraLives: 0, tutorialSeen: true,
  stats: { cleared: 0, flawless: 0, launches: 0, blocked: 0, bestCombo: 0, hints: 0 },
  achievements: {}, daily: { last: null, streak: 0, best: 0, history: {} },
})

beforeEach(() => {
  progressStore('word').set(fresh)
  settingsStore.set(s => ({ ...s, motion: 'reduce', sound: false })) // instant reveals in tests
})
afterEach(() => { cleanup(); localStorage.clear() })

const key = k => fireEvent.keyDown(window, { key: k })
const type = word => { [...word].forEach(key); key('Enter') }
const msg = () => document.querySelector('.wg-msg').textContent
const board = () => screen.getByRole('group', { name: /Word Guess board/ })
const answer1 = generateLevel(1).answer
/** Valid answers that aren't `answer`, for wrong guesses. */
const wrongWords = answer => ANSWERS.filter(w => w !== answer)

async function startLevels() {
  render(<WordGame />)
  fireEvent.click(screen.getByRole('button', { name: /Play/ }))
  await screen.findByRole('group', { name: /Word Guess board/ })
}

describe('Word Guess end-to-end', () => {
  it('scores a guess with the physical keyboard, then wins and advances', async () => {
    await startLevels()
    const wrong = wrongWords(answer1)[0]
    type(wrong)
    expect(within(board()).getByText(new RegExp(`^Guess 1: ${wrong.toUpperCase()}\\.`))).toBeTruthy()
    // The keyboard picks up the clue colours.
    const first = evaluateGuess(wrong, answer1)[0]
    expect(screen.getByRole('button', { name: new RegExp(`^${wrong[0].toUpperCase()}(,|$)`) }).className).toContain(first)

    type(answer1)
    const result = await screen.findByRole('dialog', { name: 'You found the word' })
    expect(result.textContent).toContain('Solved in 2/6')
    expect(screen.getByLabelText(answer1.toUpperCase())).toBeTruthy()
    const p = getProgress('word')
    expect(p.level).toBe(2)
    expect(p.best).toBe(1)
    expect(p.stars[1]).toBe(3)
    expect(p.wordStats).toMatchObject({ played: 1, wins: 1, streak: 1, dist: [0, 1, 0, 0, 0, 0] })

    fireEvent.click(screen.getByRole('button', { name: /Next word/ }))
    expect(screen.getByText('Level 2')).toBeTruthy()
  })

  it('rejects short and unknown words without using a guess', async () => {
    await startLevels()
    type('abc')
    expect(msg()).toBe('Not enough letters')
    key('Backspace'); key('Backspace'); key('Backspace')
    type('qzxvw')
    expect(msg()).toBe('Not in word list')
    expect(document.querySelector('.wg-row.shake')).toBeTruthy()
    expect(screen.getByRole('group', { name: /0 of 6 guesses used/ })).toBeTruthy()
  })

  it('six wrong guesses lose the word and reveal the answer', async () => {
    await startLevels()
    wrongWords(answer1).slice(0, 6).forEach(type)
    const result = await screen.findByRole('dialog', { name: 'Out of guesses' })
    expect(result.textContent).toContain('The word was')
    expect(screen.getByLabelText(answer1.toUpperCase())).toBeTruthy()
    expect(getProgress('word').wordStats).toMatchObject({ played: 1, wins: 0, streak: 0 })
    expect(getProgress('word').level).toBe(2) // a lost word still moves on to a new one
    fireEvent.click(screen.getByRole('button', { name: 'See board' }))
    expect(screen.getByText(/The word was/).textContent).toContain(answer1.toUpperCase())
  })

  it('hard mode makes later guesses reuse revealed letters', async () => {
    render(<WordGame />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Hard mode/ }))
    expect(getProgress('word').wordHard).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Play/ }))
    await screen.findByText('Hard')
    // A first guess that reveals something, then a second that ignores it.
    const words = wrongWords(answer1)
    const g1 = words.find(w => evaluateGuess(w, answer1).some(s => s !== 'absent'))
    const rows = [{ word: g1, result: evaluateGuess(g1, answer1) }]
    const g2 = words.find(w => guessError(w, { rows, hard: true, answer: answer1 }))
    type(g1)
    type(g2)
    expect(msg()).toBe(guessError(g2, { rows, hard: true, answer: answer1 }))
    expect(screen.getByRole('group', { name: /1 of 6 guesses used/ })).toBeTruthy()
  })

  it('a hint reveals a letter and caps the stars', async () => {
    await startLevels()
    fireEvent.click(screen.getByRole('button', { name: /Hint, 2 left/ }))
    expect(msg()).toBe(`Hint: letter 1 is ${answer1[0].toUpperCase()}`)
    expect(screen.getByRole('button', { name: /Hint, 1 left/ })).toBeTruthy()
    type(answer1)
    await screen.findByRole('dialog', { name: 'You found the word' })
    expect(getProgress('word').stars[1]).toBe(2)
  })

  it('on-screen keys type, delete and submit', async () => {
    await startLevels()
    const click = name => fireEvent.click(screen.getByRole('button', { name }))
    click('Q'); click('Delete letter')
    for (const c of answer1) click(new RegExp(`^${c.toUpperCase()}$`))
    click('Enter, submit guess')
    const result = await screen.findByRole('dialog', { name: 'You found the word' })
    expect(result.textContent).toContain('Solved in 1/6')
  })

  it('resumes a word in progress after a reload', async () => {
    await startLevels()
    const wrong = wrongWords(answer1)[3]
    type(wrong)
    cleanup()
    render(<WordGame />)
    fireEvent.click(screen.getByRole('button', { name: /Continue — Level 1/ }))
    expect(within(board()).getByText(new RegExp(`^Guess 1: ${wrong.toUpperCase()}\\.`))).toBeTruthy()
    expect(screen.getByRole('group', { name: /1 of 6 guesses used/ })).toBeTruthy()
  })

  it('the daily word is the date’s word and is marked done afterwards', async () => {
    const daily = dailyPuzzle(todayKey()).answer
    render(<WordGame initialMode="daily" />)
    await screen.findByText('Daily word')
    type(daily)
    await screen.findByRole('dialog', { name: 'You found the word' })
    expect(getProgress('word').daily.last).toBe(todayKey())
    expect(getProgress('word').level).toBe(1) // the daily doesn't move the level on
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('button', { name: /Daily word ✓/ })).toBeTruthy()
    // Reopening today's daily shows the finished word instead of a fresh board.
    fireEvent.click(screen.getByRole('button', { name: /Daily word/ }))
    expect(await screen.findByRole('dialog', { name: 'You found the word' })).toBeTruthy()
  })

  it('statistics show played, win %, streaks and average guesses', async () => {
    progressStore('word').set(p => ({ ...p, wordStats: { played: 4, wins: 3, streak: 2, maxStreak: 2, guessTotal: 12, dist: [0, 0, 1, 1, 1, 0] } }))
    render(<WordGame />)
    fireEvent.click(screen.getByRole('button', { name: /Statistics/ }))
    const dialog = screen.getByRole('dialog', { name: 'Statistics' })
    const value = name => [...dialog.querySelectorAll('dt')].find(d => d.textContent === name).nextSibling.textContent
    expect(value('Played')).toBe('4')
    expect(value('Win %')).toBe('75')
    expect(value('Current streak')).toBe('2')
    expect(value('Avg guesses')).toBe('4')
  })
})
