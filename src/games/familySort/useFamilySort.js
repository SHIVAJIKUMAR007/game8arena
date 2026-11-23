// Game state for one Family Sort level: selection, pouring, undo, hints, extra bottles, winning and saving.
// The view (FamilySortGame.jsx) only renders what this hook returns. The rules live in logic.js and solver.js.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { track } from '../../platform/analytics'
import { vibrate } from '../../platform/haptics'
import { prefersReducedMotion } from '../../platform/settings'
import { useStore } from '../../platform/storage'
import { BOTTLE_COST, HINT_COST, MAX_EXTRA_BOTTLES, levelReward, levelScore, starRating } from './economy'
import { buildLevel } from './engine'
import { applyMove, canPour, cloneBottles, isBottleDone, isSolved, legalMoves } from './logic'
import { findHint, solve } from './solver'
import { addCoins, completeLevel, familyStore, recordHint, saveSession } from './store'
import { sfx, unlockAudio } from './audio'

/** Pour animation timing in ms: lift and tilt, pour, then return to the table. */
export const TIMING = { lift: 240, pour: 360, back: 200 }
const MAX_HISTORY = 500

/** Where a level starts: the saved game when it matches this level's puzzle, otherwise the fresh puzzle. */
function initialState(puzzle, session) {
  const same = session
    && session.bottles.length >= puzzle.bottles.length
    && session.bottles.length <= puzzle.bottles.length + MAX_EXTRA_BOTTLES
    && session.bottles.flat().length === puzzle.bottles.flat().length
  if (same) {
    return { bottles: cloneBottles(session.bottles), history: [], moves: session.moves, hints: session.hints, extra: session.bottles.length - puzzle.bottles.length, elapsed: session.elapsed }
  }
  return { bottles: cloneBottles(puzzle.bottles), history: [], moves: 0, hints: 0, extra: 0, elapsed: 0 }
}

/** @param {number} level */
export function useFamilySort(level) {
  const saved = useStore(familyStore)
  const puzzle = useMemo(() => buildLevel(level), [level])
  const par = useMemo(() => {
    const r = solve(puzzle.bottles)
    return r.solved ? r.moves.length : puzzle.solution.length
  }, [puzzle])

  const [g, setG] = useState(() => initialState(puzzle, familyStore.get().session))
  const [selected, setSelected] = useState(null)
  const [hint, setHint] = useState(null) // { from, to }
  const [anim, setAnim] = useState(null) // { from, to, color, amount, phase: 'go' | 'back' }
  const [shake, setShake] = useState(null)
  const [celebrate, setCelebrate] = useState(null)
  const [status, setStatus] = useState('playing') // 'playing' | 'stuck' | 'won'
  const [message, setMessage] = useState('')
  const [result, setResult] = useState(null)

  const timers = useRef(new Set())
  const startedAt = useRef(0) // set when the level mounts, so render stays pure
  const since = () => (startedAt.current ? Date.now() - startedAt.current : 0)
  const finished = useRef(false)
  useEffect(() => {
    startedAt.current = Date.now()
  }, [])
  const later = useCallback((fn, ms) => {
    const t = setTimeout(() => {
      timers.current.delete(t)
      fn()
    }, ms)
    timers.current.add(t)
  }, [])
  useEffect(() => {
    const all = timers.current
    return () => all.forEach(clearTimeout)
  }, [])

  const busy = anim !== null

  const say = useCallback(text => {
    setMessage(text)
    later(() => setMessage(m => (m === text ? '' : m)), 2800)
  }, [later])

  // Keep the unfinished level so a reload picks up where the player left off.
  useEffect(() => {
    if (finished.current || (g.moves === 0 && g.extra === 0)) return
    saveSession({ level, bottles: g.bottles, moves: g.moves, hints: g.hints, elapsed: g.elapsed + since() })
  }, [g, level])

  const reject = useCallback(i => {
    setShake(i)
    sfx('blocked')
    vibrate(30)
    later(() => setShake(s => (s === i ? null : s)), 420)
  }, [later])

  const win = useCallback((moves, hints) => {
    finished.current = true
    const time = g.elapsed + since()
    const stars = starRating({ moves, par, hints })
    const score = levelScore({ moves, par, hints, colors: puzzle.colors })
    // Coins are paid once per level: replaying a cleared level is practice, so it cannot be farmed.
    const first = !familyStore.get().completed[level]
    const reward = first ? levelReward({ level, hints }) : { base: 0, bonus: 0, total: 0 }
    completeLevel(level, { moves, hints, time, stars, score, reward: reward.total })
    track?.('family_level_complete', { level, moves, hints })
    later(() => {
      setStatus('won')
      setResult({ level, moves, hints, time, stars, score, reward })
      sfx('win')
      vibrate([30, 50, 30])
    }, 650)
  }, [g.elapsed, level, later, par, puzzle.colors])

  const commit = useCallback((from, to) => {
    const res = applyMove(g.bottles, from, to)
    if (!res) return
    const next = res.bottles
    const moves = g.moves + 1
    setG(p => ({ ...p, bottles: next, history: [...p.history, p.bottles].slice(-MAX_HISTORY), moves }))
    if (isBottleDone(next[to]) && !isBottleDone(g.bottles[to])) {
      setCelebrate(to)
      sfx('done')
      later(() => setCelebrate(c => (c === to ? null : c)), 1000)
    }
    if (isSolved(next)) win(moves, g.hints)
    else if (!legalMoves(next).length) setStatus('stuck')
  }, [g, later, win])

  const pour = useCallback((from, to) => {
    const res = applyMove(g.bottles, from, to)
    setSelected(null)
    setHint(null)
    sfx('pour')
    if (prefersReducedMotion()) {
      commit(from, to)
      return
    }
    setAnim({ from, to, color: res.color, amount: res.amount, phase: 'go' })
    later(() => commit(from, to), TIMING.lift)
    later(() => setAnim(a => (a ? { ...a, phase: 'back' } : a)), TIMING.lift + TIMING.pour)
    later(() => setAnim(null), TIMING.lift + TIMING.pour + TIMING.back)
  }, [commit, g.bottles, later])

  const select = useCallback(i => {
    if (busy || status === 'won' || finished.current) return
    unlockAudio()
    const b = g.bottles
    if (selected === null) {
      if (!b[i] || !b[i].length) return reject(i)
      setSelected(i)
      setHint(null)
      sfx('select')
      return
    }
    if (selected === i) {
      setSelected(null)
      sfx('deselect')
      return
    }
    if (!canPour(b, selected, i)) return reject(i)
    pour(selected, i)
  }, [busy, g.bottles, pour, reject, selected, status])

  const cancel = useCallback(() => setSelected(null), [])

  const undo = useCallback(() => {
    if (busy || finished.current || !g.history.length) return
    unlockAudio()
    const prev = cloneBottles(g.history[g.history.length - 1])
    while (prev.length < g.bottles.length) prev.push([]) // a bottle added since then stays
    setG(p => ({ ...p, bottles: prev, history: p.history.slice(0, -1), moves: Math.max(0, p.moves - 1) }))
    setSelected(null)
    setHint(null)
    setStatus('playing')
    sfx('undo')
  }, [busy, g.bottles.length, g.history])

  const addBottle = useCallback(() => {
    if (busy || finished.current) return
    unlockAudio()
    if (g.extra >= MAX_EXTRA_BOTTLES) return say('You already have all the extra bottles for this level.')
    if (!addCoins(-BOTTLE_COST)) return say(`An extra bottle costs ${BOTTLE_COST} coins.`)
    setG(p => ({ ...p, bottles: [...p.bottles, []], extra: p.extra + 1 }))
    setStatus('playing')
    sfx('coin')
    say('Extra bottle added.')
  }, [busy, g.extra, say])

  const showHint = useCallback(() => {
    if (busy || finished.current) return
    unlockAudio()
    if (familyStore.get().coins < HINT_COST) return say(`A hint costs ${HINT_COST} coins.`)
    const move = findHint(g.bottles)
    if (!move) return say('No way to finish from here. Try undo or an extra bottle.')
    addCoins(-HINT_COST)
    recordHint()
    setG(p => ({ ...p, hints: p.hints + 1 }))
    setSelected(null)
    setHint({ from: move[0], to: move[1] })
    sfx('hint')
    later(() => setHint(h => (h && h.from === move[0] && h.to === move[1] ? null : h)), 4000)
  }, [busy, g.bottles, later, say])

  const restart = useCallback(() => {
    if (busy || finished.current) return
    setG(p => ({ ...initialState(puzzle, null), hints: p.hints, elapsed: p.elapsed + since() }))
    startedAt.current = Date.now()
    setSelected(null)
    setHint(null)
    setStatus('playing')
    sfx('undo')
  }, [busy, puzzle])

  return {
    bottles: g.bottles, capacity: puzzle.capacity, colors: puzzle.colors, level, par,
    moves: g.moves, hints: g.hints, extra: g.extra, canUndo: g.history.length > 0 && !busy,
    selected, hint, anim, shake, celebrate, status, message, result, coins: saved.coins,
    select, cancel, undo, addBottle, showHint, restart,
  }
}
