// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import SolitaireGame from './SolitaireGame'
import { generatePuzzle, makeSetup } from './levels'
import { applyMove, canAutoFinish, createGame, hiddenCount, isWon, pileCards, replay, topOf, validateMove } from './rules'
import { columnOffsets, tableMetrics } from './layout'
import { SAVE_VERSION, readStats } from './store'
import { getProgress, progressStore } from '../../platform/progress'
import { settingsStore } from '../../platform/settings'

const fresh = () => ({
  level: 1, best: 0, stars: {}, highScore: 0, extraLives: 0, tutorialSeen: true,
  stats: { cleared: 0, flawless: 0, launches: 0, blocked: 0, bestCombo: 0, hints: 0 },
  achievements: {}, daily: { last: null, streak: 0, best: 0, history: {} },
})

beforeEach(() => {
  progressStore('solitaire').set(fresh)
  settingsStore.set(s => ({ ...s, motion: 'reduce', sound: false, haptics: false })) // instant results, silent tests
})
afterEach(() => { cleanup(); localStorage.clear() })

const level1 = () => generatePuzzle(makeSetup('campaign', { level: 1, draw: 1 }))
const movesShown = () => screen.getByTestId('moves').textContent
const scoreShown = () => screen.getByTestId('score').textContent
const cardEl = c => document.querySelector(`[data-card="${c}"]`)
const slotEl = id => document.querySelector(`.sol-slot[data-pile="${id}"]`)
const stockEl = () => screen.getByRole('button', { name: /^Stock/ })

async function startLevel(prefs) {
  if (prefs) progressStore('solitaire').set(p => ({ ...p, solPrefs: prefs }))
  render(<SolitaireGame />)
  fireEvent.click(screen.getByRole('button', { name: /Play|Continue/ }))
  await screen.findByTestId('moves')
}

/** Plays one move the way a player would: tap the stock, or tap the card and then where it goes. */
function clickMove(state, move) {
  if (move.type === 'draw') {
    fireEvent.click(stockEl())
  } else {
    const count = move.count || 1
    fireEvent.click(cardEl(pileCards(state, move.from).at(-count)))
    const to = validateMove(state, move).to
    const target = pileCards(state, to)
    fireEvent.click(target.length ? cardEl(topOf(target)) : slotEl(to))
  }
  return applyMove(state, move).state
}

/** From `state`, the solution moves up to and including the first one that matches `pred`. */
function prefixUntil(solution, pred, state) {
  let s = state
  for (let i = 0; i < solution.length; i++) {
    if (pred(solution[i], s)) return { moves: solution.slice(0, i + 1), at: i, before: s }
    s = applyMove(s, solution[i]).state
  }
  return null
}

describe('Solitaire end-to-end', { timeout: 30000 }, () => {
  it('deals level 1 with the HUD, and never reveals face-down cards', async () => {
    await startLevel()
    const p = level1()
    expect(screen.getByText('Level 1')).toBeTruthy()
    expect(screen.getByText(/Gentle · Draw 1/)).toBeTruthy()
    expect(movesShown()).toBe('0')
    expect(scoreShown()).toBe('0')
    // 21 face-down tableau cards + 24 stock cards are drawn as backs, with nothing that identifies them
    expect(document.querySelectorAll('.sol-card.back')).toHaveLength(45)
    const faceUp = [...document.querySelectorAll('[data-card]')].map(el => Number(el.dataset.card))
    expect(faceUp.sort((a, b) => a - b)).toEqual(p.deal.tableau.map(col => col.at(-1)).sort((a, b) => a - b))
    const hiddenCards = [...p.deal.tableau.flatMap(col => col.slice(0, -1)), ...p.deal.stock]
    for (const c of hiddenCards) expect(cardEl(c)).toBeNull()
  })

  it('draws from the stock and counts the move; undo puts it back', async () => {
    await startLevel()
    const p = level1()
    fireEvent.click(stockEl())
    expect(movesShown()).toBe('1')
    expect(cardEl(p.deal.stock.at(-1))).toBeTruthy() // the old top of the stock is now the waste card
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    expect(movesShown()).toBe('0')
    expect(cardEl(p.deal.stock.at(-1))).toBeNull()
    expect(screen.getAllByText('Move undone.').length).toBeGreaterThan(0)
  })

  it('moves cards by tapping, and rejects an illegal move with the reason', async () => {
    await startLevel()
    const p = level1()
    let state = createGame(p.deal, 1)
    // play the winning line up to its first card move
    const first = prefixUntil(p.analysis.solution, m => m.type === 'move', state)
    for (const m of first.moves) state = clickMove(state, m)
    expect(movesShown()).toBe(String(first.moves.length))

    // now try every illegal column-to-column tap until one is found, and check it is refused
    let bad = null
    for (let i = 0; i < 7 && !bad; i++) {
      for (let j = 0; j < 7 && !bad; j++) {
        const move = { type: 'move', from: `t${i}`, to: `t${j}`, count: 1 }
        const r = validateMove(state, move)
        if (i !== j && state.tableau[i].length && state.tableau[j].length && !r.ok) bad = { move, reason: r.reason }
      }
    }
    expect(bad).not.toBeNull()
    const before = movesShown()
    fireEvent.click(cardEl(topOf(state.tableau[Number(bad.move.from[1])])))
    fireEvent.click(cardEl(topOf(state.tableau[Number(bad.move.to[1])])))
    expect(movesShown()).toBe(before)
    expect(screen.getAllByText(bad.reason).length).toBeGreaterThan(0)
  })

  it('moves cards by dragging, with touch as well as the mouse', async () => {
    await startLevel()
    const p = level1()
    const m = tableMetrics(720, 520) // the table's size before it is measured (jsdom has no layout)
    let state = createGame(p.deal, 1)
    const table = document.querySelector('.sol-table')

    const drag = (move, pointerType) => {
      const count = move.count || 1
      const lead = pileCards(state, move.from).at(-count)
      const from = move.from
      // where the lead card is drawn, and where it should land
      let x
      let y
      if (from === 'waste') { x = m.colX(1); y = m.rowY } else {
        const i = Number(from[1])
        x = m.colX(i)
        y = m.tableauY + columnOffsets(m, state.tableau, state.hidden)[i][state.tableau[i].length - count]
      }
      const to = validateMove(state, move).to
      const tx = to[0] === 'f' ? m.colX(3 + Number(to[1])) : m.colX(Number(to[1]))
      const ty = to[0] === 'f' ? m.rowY : m.tableauY + 20
      const el = cardEl(lead)
      fireEvent.pointerDown(el, { clientX: x + 10, clientY: y + 10, pointerId: 1, pointerType, button: 0 })
      fireEvent.pointerMove(table, { clientX: x + 30, clientY: y + 30, pointerId: 1, pointerType })
      fireEvent.pointerMove(table, { clientX: tx + 10, clientY: ty + 10, pointerId: 1, pointerType })
      fireEvent.pointerUp(table, { clientX: tx + 10, clientY: ty + 10, pointerId: 1, pointerType })
      fireEvent.click(el) // browsers send a click after a mouse drag; it must not count as a tap
      state = applyMove(state, move).state
    }

    const moves = p.analysis.solution
    let done = 0
    let dragged = 0
    for (const move of moves) {
      if (dragged >= 2) break
      if (move.type === 'draw') { state = clickMove(state, move); done++; continue }
      drag(move, dragged === 0 ? 'mouse' : 'touch')
      done++
      dragged++
      expect(movesShown()).toBe(String(done))
    }
    expect(dragged).toBe(2)
    expect(document.querySelector('.sol-card.sel')).toBeNull() // the trailing click did not pick anything up
  })

  it('a hint points at a move and uses one up', async () => {
    await startLevel()
    expect(screen.getByRole('button', { name: 'Hint, 5 left' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Hint/ }))
    expect(screen.getByRole('button', { name: 'Hint, 4 left' })).toBeTruthy()
    expect(document.querySelector('.hint, .hint-from, .hint-to')).toBeTruthy()
    expect(screen.getAllByText(/Move the|Draw from the stock/).length).toBeGreaterThan(0)
  })

  it('keyboard: D draws, U undoes', async () => {
    await startLevel()
    fireEvent.keyDown(window, { key: 'd' })
    expect(movesShown()).toBe('1')
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(movesShown()).toBe('0')
    fireEvent.keyDown(window, { key: 'd' })
    fireEvent.keyDown(window, { key: 'u' })
    expect(movesShown()).toBe('0')
  })

  it('wins level 1 by playing the whole winning line, and saves the result', async () => {
    await startLevel({ draw: 1, autoFinish: false })
    const p = level1()
    let state = createGame(p.deal, 1)
    for (const move of p.analysis.solution) state = clickMove(state, move)
    expect(isWon(state)).toBe(true)
    const dialog = await screen.findByRole('dialog', { name: 'You won' })
    expect(dialog.textContent).toMatch(/Moves/)
    expect(movesShown()).toBe(String(p.analysis.solution.length))
    const saved = getProgress('solitaire')
    expect(saved.level).toBe(2)
    expect(saved.best).toBe(1)
    expect(saved.stars[1]).toBeGreaterThanOrEqual(2) // no hints used
    expect(saved.highScore).toBeGreaterThan(0)
    const stats = readStats(saved)
    expect(stats.won).toBe(1)
    expect(stats.modes.d1.fewestMoves).toBe(p.analysis.solution.length)
    expect(saved.solSaves.campaign).toBeNull()
    expect(saved.achievements.first_win).toBeTruthy()
  }, 60000)

  it('resumes a saved game, and auto-finishes once every card is face up', async () => {
    const p = level1()
    const start = createGame(p.deal, 1)
    const cut = prefixUntil(p.analysis.solution, (m, s) => canAutoFinish(applyMove(s, m).state), start)
    expect(cut).not.toBeNull()
    progressStore('solitaire').set(prog => ({
      ...prog,
      solSaves: { campaign: { v: SAVE_VERSION, key: 'campaign:d1:L1', seed: '', moves: cut.moves, elapsed: 75, hints: 0, undos: 0 } },
    }))
    render(<SolitaireGame />)
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    await screen.findByRole('dialog', { name: 'You won' }, { timeout: 5000 })
    expect(getProgress('solitaire').level).toBe(2)
  })

  it('finishes the game by itself once every card is face up, even with cards left in the stock', async () => {
    const p = level1()
    const start = createGame(p.deal, 1)
    // the first point on the winning line where nothing in the columns is face down but the stock/waste still hold cards
    const cut = prefixUntil(p.analysis.solution, (m, s) => {
      const next = applyMove(s, m).state
      return hiddenCount(next) === 0 && next.stock.length + next.waste.length > 0
    }, start)
    expect(cut).not.toBeNull()
    progressStore('solitaire').set(prog => ({
      ...prog,
      solSaves: { campaign: { v: SAVE_VERSION, key: 'campaign:d1:L1', seed: '', moves: cut.moves, elapsed: 120, hints: 0, undos: 0 } },
    }))
    render(<SolitaireGame />)
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    await screen.findByRole('dialog', { name: 'You won' }, { timeout: 8000 })
    const saved = getProgress('solitaire')
    expect(saved.level).toBe(2)
    expect(document.querySelectorAll('.sol-card.face[data-pile^="f"]')).toHaveLength(52)
  })

  it('ignores a corrupted save and deals afresh', async () => {
    progressStore('solitaire').set(prog => ({
      ...prog,
      solSaves: { campaign: { v: SAVE_VERSION, key: 'campaign:d1:L1', moves: [{ type: 'move', from: 't0', to: 't0', count: 1 }], elapsed: 9 } },
    }))
    await startLevel()
    expect(movesShown()).toBe('0')
  })

  it('saves the game in progress when leaving it', async () => {
    await startLevel()
    fireEvent.click(stockEl())
    fireEvent.click(stockEl())
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }))
    const save = getProgress('solitaire').solSaves.campaign
    expect(save.moves).toEqual([{ type: 'draw' }, { type: 'draw' }])
    expect(replay(level1().deal, 1, save.moves)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    await screen.findByTestId('moves')
    expect(movesShown()).toBe('2')
  })

  it('plays draw three when chosen on the menu', async () => {
    render(<SolitaireGame />)
    fireEvent.click(screen.getByRole('radio', { name: /Draw three/ }))
    expect(getProgress('solitaire').solPrefs.draw).toBe(3)
    fireEvent.click(screen.getByRole('button', { name: /Play/ }))
    await screen.findByTestId('moves')
    expect(screen.getByText(/· Draw 3/)).toBeTruthy()
    const p = generatePuzzle(makeSetup('campaign', { level: 1, draw: 3 }))
    fireEvent.click(stockEl())
    // three cards turned; only the last of them (third from the old top) can be played
    const turned = p.deal.stock.slice(-3)
    expect(document.querySelectorAll('.sol-card.face[data-pile="waste"]')).toHaveLength(3)
    expect(cardEl(turned[0])).toBeTruthy()
    expect(cardEl(turned[2])).toBeNull()
  })

  it('pauses the game', async () => {
    await startLevel()
    fireEvent.click(stockEl())
    fireEvent.click(screen.getByRole('button', { name: /Pause/ }))
    expect(screen.getByText('Paused')).toBeTruthy()
    fireEvent.click(stockEl()) // the table ignores input while paused
    expect(movesShown()).toBe('1')
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: /Resume/ })[0]) })
    expect(screen.queryByText('Paused')).toBeNull()
  })
})
