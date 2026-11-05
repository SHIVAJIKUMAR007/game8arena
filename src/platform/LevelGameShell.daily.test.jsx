// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import LevelGameShell from './LevelGameShell'
import { getProgress, progressStore } from './progress'
import { todayKey } from './daily'
import { config as mergeConfig } from '../games/merge/config'

afterEach(() => { cleanup(); localStorage.clear() })

// A stand-in game whose Board can lose a life on demand: enough to drive the shell.
function Board({ session, mode }) {
  return <button onClick={() => session.loseLife()}>lose ({mode})</button>
}
const config = { daily: true, dailyLevel: 4, endless: (level, mode) => mode === 'daily', tutorial: [] }
const seen = () => progressStore('fake').set(p => ({ ...p, tutorialSeen: true, level: 2, best: 1 }))

describe('daily challenge in the shell', () => {
  it('an endless daily (like Merge Rush) counts as done when the run ends, whatever the score', async () => {
    seen()
    render(<LevelGameShell gameId="fake" title="Fake" config={config} Board={Board} initialMode="daily" dailyPicks={['fake', 'x', 'y']} />)
    const lose = await screen.findByRole('button', { name: 'lose (daily)' })
    for (let i = 0; i < 3; i++) act(() => { fireEvent.click(lose) })
    await screen.findByRole('heading', { name: /Run over/ })
    expect(screen.getByText(/Daily challenge complete/)).toBeTruthy()
    expect(getProgress('fake').daily.last).toBe(todayKey())
    expect(getProgress('fake').level).toBe(2) // a daily run never moves the campaign on
  })

  it('only offers the daily when the game is one of today\'s picks', () => {
    seen()
    render(<LevelGameShell gameId="fake" title="Fake" config={config} Board={Board} initialMode="daily" dailyPicks={['x', 'y', 'z']} />)
    expect(screen.queryByRole('button', { name: /Daily challenge/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /lose/ })).toBeNull() // ?mode=daily ignored: stays on the menu
  })

  it('Merge Rush: the daily level is endless', () => {
    expect(mergeConfig.endless(mergeConfig.dailyLevel, 'daily')).toBe(true)
    expect(mergeConfig.endless(mergeConfig.dailyLevel, 'campaign')).toBe(false)
  })
})
