// Klondike Solitaire: build the four foundations from Ace to King.
//
// Like Minesweeper, this game has its own small shell instead of LevelGameShell, because its rules don't fit lives:
// undo is unlimited, it runs against a clock and keeps a running score and move count. It still reuses the shared
// platform: progress store, achievements, sound, haptics, share, analytics, the settings / tutorial / modal /
// level-map UI and the lg-* styles.
//
// Separation of concerns:
//   cards.js   card model             rules.js   state, move validation, scoring, win / stuck detection
//   deal.js    seeded dealing         solver.js  search-based solver (deal validation and hints)
//   levels.js  difficulty, progression, deal generation, engine contract
//   store.js   saved stats / games    layout.js  table geometry   SolitaireTable.jsx  drawing and pointer input
// This file only wires them together: it owns the session (clock, history, hints, saving, results).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getProgress, updateProgress, useProgress } from '../../platform/progress'
import { checkAchievements } from '../../platform/achievements'
import { playSound } from '../../platform/sound'
import { vibrate } from '../../platform/haptics'
import { track } from '../../platform/analytics'
import { shareResult } from '../../platform/share'
import { prefersReducedMotion, updateSettings, useSettings } from '../../platform/settings'
import SettingsModal from '../../platform/ui/SettingsModal'
import Tutorial from '../../platform/ui/Tutorial'
import LevelSelect from '../../platform/ui/LevelSelect'
import Modal from '../../platform/ui/Modal'
import Stars from '../../platform/ui/Stars'
import '../../platform/platform.css'
import './SolitaireGame.css'
import { config } from './config'
import { cardLabel } from './cards'
import {
  REASONS, applyMove, createGame, foundationCount, hasUsefulMove, isMovableRun,
  isWon, parsePile, pileCards, replay, smartMove, validateMove,
} from './rules'
import { difficultyBand, difficultyLabel, findHint, generatePuzzle, makeSetup, planFinish, timeBonus } from './levels'
import { GAME_ID, SAVE_VERSION, formatTime, modeKey, readPrefs, readSave, readStats, recordStart, recordWin, summarize } from './store'
import SolitaireTable from './SolitaireTable'

const TITLE = 'Solitaire'
const AUTO_STEP_MS = 170 // a card flying to its pile (the CSS move takes 160 ms)
const AUTO_DRAW_MS = 70 // turning a stock card while finishing

const saves = p => (p.solSaves && typeof p.solSaves === 'object' ? p.solSaves : {})
const clearSave = slot => updateProgress(GAME_ID, p => (saves(p)[slot] ? { ...p, solSaves: { ...saves(p), [slot]: null } } : p))
const setPrefs = patch => updateProgress(GAME_ID, p => ({ ...p, solPrefs: { ...readPrefs(p), ...patch } }))

const pileWords = id => {
  if (id === 'waste') return 'the waste pile'
  if (id[0] === 'f') return 'a foundation'
  return `column ${Number(id[1]) + 1}`
}

export default function SolitaireGame() {
  const progress = useProgress(GAME_ID)
  const prefs = readPrefs(progress)
  const [screen, setScreen] = useState('menu') // menu | levels | play
  const [setup, setSetup] = useState(null)
  const [round, setRound] = useState(0)
  const [modal, setModal] = useState(null) // settings | tutorial | achievements | stats

  const start = useCallback((mode, o = {}) => {
    const p = getProgress(GAME_ID)
    const draw = readPrefs(p).draw
    let s
    if (mode === 'campaign') s = makeSetup('campaign', { level: o.level ?? p.level, draw })
    else {
      const save = o.fresh ? null : readSave(p, 'random')
      const resumable = save && save.key.startsWith(`random:d${draw}:`) && save.seed
      if (o.fresh) clearSave('random')
      s = makeSetup('random', { draw, seed: resumable ? save.seed : undefined })
    }
    setSetup(s)
    setRound(r => r + 1)
    setScreen('play')
    track('level_start', { game: GAME_ID, level: s.level, mode, draw })
    if (!p.tutorialSeen) setModal('tutorial')
  }, [])

  const restart = useCallback(() => {
    if (!setup) return
    clearSave(setup.mode)
    setRound(r => r + 1)
  }, [setup])

  useEffect(() => { track('game_open', { game: GAME_ID }) }, [])

  const closeTutorial = useCallback(() => {
    updateProgress(GAME_ID, p => (p.tutorialSeen ? p : { ...p, tutorialSeen: true }))
    setModal(null)
  }, [])
  const closeModal = useCallback(() => setModal(null), [])

  const stats = summarize(progress.solStats)
  const unlocked = Object.keys(progress.achievements).length
  const randomSave = readSave(progress, 'random')
  const campaignSave = readSave(progress, 'campaign')

  const modals = (
    <>
      {modal === 'settings' && <SettingsModal onClose={closeModal} />}
      {modal === 'tutorial' && <Tutorial steps={config.tutorial} onClose={closeTutorial} />}
      {modal === 'stats' && (
        <Modal title="Statistics" onClose={closeModal}>
          <StatsView stats={stats} />
        </Modal>
      )}
      {modal === 'achievements' && (
        <Modal title="Achievements" onClose={closeModal}>
          <ul className="ach-list">
            {config.achievements.map(a => {
              const done = Boolean(progress.achievements[a.id])
              return (
                <li key={a.id} className={done ? 'done' : ''}>
                  <span className="ach-icon" aria-hidden="true">{done ? a.icon : '🔒'}</span>
                  <div><b>{a.title}</b><div>{a.description}</div></div>
                </li>
              )
            })}
          </ul>
        </Modal>
      )}
    </>
  )

  if (screen === 'levels') {
    return (
      <div className="lg-root">
        <LevelSelect
          best={progress.best} stars={progress.stars} maxStars={3}
          onPick={level => start('campaign', { level })} onBack={() => setScreen('menu')}
        />
      </div>
    )
  }

  if (screen === 'menu' || !setup) {
    const hasProgress = progress.level > 1 || progress.best > 0 || Boolean(campaignSave)
    const randomResumable = randomSave?.key.startsWith(`random:d${prefs.draw}:`)
    return (
      <div className="lg-root lg-menu sol-menu">
        <h1>{TITLE}</h1>
        <p className="sol-sub">Klondike, the classic. Every deal can be won, and the levels get harder slowly.</p>
        <div className="lg-menu-stats">
          <span>Level <b>{progress.level}</b></span>
          <span>Win rate <b>{stats.winPct}%</b></span>
          <span>Streak <b>{stats.streak}</b></span>
          <span>High score <b>{progress.highScore}</b></span>
        </div>
        <div className="sol-draw" role="radiogroup" aria-label="Cards to draw from the stock">
          {[1, 3].map(d => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={prefs.draw === d}
              className={`sol-draw-btn${prefs.draw === d ? ' on' : ''}`}
              onClick={() => setPrefs({ draw: d })}
            >
              <b>Draw {d === 1 ? 'one' : 'three'}</b>
              <small>{d === 1 ? 'Relaxed' : 'Classic challenge'}</small>
            </button>
          ))}
        </div>
        <div className="lg-menu-buttons">
          <button className="lg-btn big" onClick={() => start('campaign')}>
            {hasProgress ? `▶ Continue: Level ${progress.level}` : '▶ Play'}
          </button>
          <button className="lg-btn" onClick={() => start('random')}>
            🎲 {randomResumable ? 'Resume random deal' : 'Random deal'}
          </button>
          <button className="lg-btn" onClick={() => setScreen('levels')}>🗺️ Level map</button>
          <button className="lg-btn" onClick={() => setModal('stats')}>📊 Statistics</button>
          <div className="lg-menu-row">
            <button className="lg-btn ghost" onClick={() => setModal('tutorial')}>❓ How to play</button>
            <button className="lg-btn ghost" onClick={() => setModal('achievements')}>🏆 {unlocked}/{config.achievements.length}</button>
            <button className="lg-btn ghost" onClick={() => setModal('settings')}>⚙️ Settings</button>
          </div>
        </div>
        {modals}
      </div>
    )
  }

  return (
    <div className="lg-root sol-root">
      <Round
        key={`${setup.key}-${round}`}
        setup={setup}
        prefs={prefs}
        locked={modal !== null}
        onMenu={() => setScreen('menu')}
        onRestart={restart}
        onNext={() => start('campaign', { level: getProgress(GAME_ID).level })}
        onNew={() => start('random', { fresh: true })}
        onModal={setModal}
      />
      {modals}
    </div>
  )
}

/** Builds the deal (off the first render, so "Dealing…" shows at once), then mounts the game. */
function Round(props) {
  const { setup } = props
  const [puzzle, setPuzzle] = useState(null)
  useEffect(() => {
    const id = setTimeout(() => setPuzzle(generatePuzzle(setup)), 0)
    return () => clearTimeout(id)
  }, [setup])
  if (!puzzle) {
    return <div className="sol-dealing" role="status">Dealing…</div>
  }
  return <Play {...props} puzzle={puzzle} />
}

/** One deal, from the first move to the result. Remounted (by key) for every new deal. */
function Play({ setup, puzzle, prefs, locked, onMenu, onRestart, onNext, onNew, onModal }) {
  const { mode, draw } = setup
  const slot = mode
  const settings = useSettings()

  // Resume a saved game if there is one for this exact deal; a save whose moves don't replay is ignored.
  const init = useMemo(() => {
    const save = readSave(getProgress(GAME_ID), slot, setup.key)
    const r = save ? replay(puzzle.deal, draw, save.moves) : null
    if (save && r) return { game: r.state, history: r.history, moves: save.moves, hints: save.hints, undos: save.undos, elapsed: save.elapsed }
    return { game: createGame(puzzle.deal, draw), history: [], moves: [], hints: 0, undos: 0, elapsed: 0 }
  }, [puzzle, draw, slot, setup.key])

  const [play, setPlay] = useState({ game: init.game, history: init.history, moves: init.moves })
  const { game } = play
  const [hints, setHints] = useState(init.hints)
  const [undos, setUndos] = useState(init.undos)
  const [, setTick] = useState(0)
  const [paused, setPaused] = useState(false)
  const [selection, setSelection] = useState(null) // { pile, count }
  const [hint, setHint] = useState(null) // { from, count, to }
  const [shake, setShake] = useState(null)
  const [msg, setMsg] = useState('')
  const [stuck, setStuck] = useState(false)
  const [auto, setAuto] = useState(false)
  const [celebrate, setCelebrate] = useState(false)
  const [outcome, setOutcome] = useState(null)
  const [showResult, setShowResult] = useState(false)

  const clock = useRef({ elapsed: init.elapsed, last: 0, running: false })
  const latest = useRef({})
  const discard = useRef(false) // set when restarting or dealing again, so the unmount save doesn't bring the old game back
  const timers = useRef([])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const won = isWon(game)
  const started = play.moves.length > 0
  const running = started && !won && !paused && !locked
  const elapsedNow = () => clock.current.elapsed + (clock.current.running ? (Date.now() - clock.current.last) / 1000 : 0)

  // Clock: runs once the first move is made, while the game is on, not paused and no dialog is open.
  useEffect(() => {
    if (!running) return undefined
    const c = clock.current
    c.last = Date.now()
    c.running = true
    const id = setInterval(() => {
      const now = Date.now()
      c.elapsed += (now - c.last) / 1000
      c.last = now
      setTick(t => t + 1)
    }, 500)
    return () => {
      clearInterval(id)
      c.elapsed += (Date.now() - c.last) / 1000
      c.running = false
    }
  }, [running])

  const persist = useCallback((moves, hintCount, undoCount) => {
    if (!moves.length) return
    const entry = { v: SAVE_VERSION, key: setup.key, seed: setup.seedId || '', moves, elapsed: Math.round(elapsedNow()), hints: hintCount, undos: undoCount }
    updateProgress(GAME_ID, p => ({ ...p, solSaves: { ...saves(p), [slot]: entry } }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup, slot])

  // Leaving mid-game keeps your place and your time.
  latest.current = { play, hints, undos, persist, won }
  useEffect(() => () => {
    const l = latest.current
    if (!discard.current && !l.won) l.persist(l.play.moves, l.hints, l.undos)
  }, [])

  const finish = useCallback((final, hintCount, undoCount, moveCount) => {
    const time = Math.max(1, Math.round(elapsedNow()))
    const before = getProgress(GAME_ID)
    const stars = 1 + (hintCount === 0 ? 1 : 0) + (time <= puzzle.par ? 1 : 0)
    const bonus = timeBonus(time, puzzle.par)
    const score = final.score + bonus
    const prevMode = readStats(before).modes[modeKey(draw)]
    updateProgress(GAME_ID, p => ({
      ...p,
      level: mode === 'campaign' ? Math.max(p.level, setup.level + 1) : p.level,
      best: mode === 'campaign' ? Math.max(p.best, setup.level) : p.best,
      stars: mode === 'campaign' ? { ...p.stars, [setup.level]: Math.max(p.stars[setup.level] || 0, stars) } : p.stars,
      highScore: Math.max(p.highScore, score),
      stats: { ...p.stats, cleared: p.stats.cleared + 1, flawless: p.stats.flawless + (hintCount === 0 ? 1 : 0), hints: p.stats.hints + hintCount },
      solStats: recordWin(p.solStats, { draw, time, moves: moveCount, score }),
      solSaves: { ...saves(p), [slot]: null },
    }))
    checkAchievements(GAME_ID, config.achievements, { won: true, mode, level: setup.level, draw, hints: hintCount, undos: undoCount, time })
    const reduced = prefersReducedMotion()
    setOutcome({
      time, stars, score, bonus, moves: moveCount,
      newBest: score > before.highScore,
      newBestTime: prevMode.times.length === 0 || time < prevMode.times[0],
      fewest: prevMode.fewestMoves === null || moveCount < prevMode.fewestMoves,
    })
    setCelebrate(!reduced)
    later(() => setShowResult(true), reduced ? 0 : 2600)
    setMsg('You won!')
    playSound('win')
    vibrate([60, 40, 60])
    track('level_win', { game: GAME_ID, level: setup.level, mode, draw, time, stars, score })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, setup, slot, draw, puzzle.par])

  /* ───── making moves ───── */

  const reject = (reason, pile, count) => {
    setMsg(reason)
    playSound('blocked')
    vibrate(60)
    if (pile) {
      const nonce = Date.now()
      setShake({ pile, count: Math.max(1, count || 1), nonce })
      later(() => setShake(s => (s && s.nonce === nonce ? null : s)), 450)
    }
  }

  const doMove = (move, { silent = false } = {}) => {
    const r = applyMove(game, move)
    if (!r.ok) {
      if (!silent) reject(r.reason, move.from, move.count)
      return false
    }
    const next = r.state
    const moves = [...play.moves, move]
    if (!play.moves.length) updateProgress(GAME_ID, p => ({ ...p, solStats: recordStart(p.solStats, { draw }) }))
    setPlay({ game: next, history: [...play.history, game], moves })
    setSelection(null)
    setHint(null)
    const toFoundation = foundationCount(next) > foundationCount(game)
    if (toFoundation) playSound('combo', foundationCount(next) % 14)
    else if (r.flipped) playSound('launch')
    else playSound('tap')
    if (r.recycled) setMsg('Waste turned back over.')
    else if (!silent) setMsg('')
    if (isWon(next)) {
      finish(next, hints, undos, moves.length)
      return true
    }
    persist(moves, hints, undos)
    if (!hasUsefulMove(next)) {
      setStuck(true)
      playSound('lose')
    }
    return true
  }

  const blocked = () => won || paused || locked || auto

  const onDraw = () => {
    if (blocked()) return
    setSelection(null)
    doMove({ type: 'draw' })
  }

  const onTap = (pile, count) => {
    if (blocked()) return
    if (selection) {
      if (selection.pile === pile && selection.count === count) {
        const move = smartMove(game, pile, count)
        setSelection(null)
        if (move) doMove(move)
        else reject('There is nowhere to move that right now.', pile, count)
        return
      }
      if (selection.pile === pile && count > 0) {
        return select(pile, count)
      }
      const from = selection
      setSelection(null)
      doMove({ type: 'move', from: from.pile, to: pile, count: from.count })
      return
    }
    if (count > 0) select(pile, count)
  }

  const select = (pile, count) => {
    const p = parsePile(pile)
    if (p.kind === 'tableau') {
      const col = game.tableau[p.index]
      if (!isMovableRun(game, p.index, col.length - count)) {
        reject(REASONS.notRun, pile, count)
        return
      }
    }
    setSelection({ pile, count })
    setHint(null)
    const lead = pileCards(game, pile).at(-count)
    setMsg(`${cardLabel(lead)}${count > 1 ? ` and ${count - 1} more` : ''} picked up. Tap where it goes, or tap it again to send it to the best spot.`)
    playSound('tap')
  }

  const onDrop = (from, count, to) => {
    if (blocked()) return
    setSelection(null)
    doMove({ type: 'move', from, to, count })
  }

  const undo = () => {
    if (won || locked || auto) return
    if (!play.history.length) { setMsg('Nothing to undo.'); return }
    const prev = play.history[play.history.length - 1]
    const moves = play.moves.slice(0, -1)
    const n = undos + 1
    setPlay({ game: prev, history: play.history.slice(0, -1), moves })
    setUndos(n)
    setSelection(null)
    setHint(null)
    setStuck(false)
    setPaused(false)
    setMsg('Move undone.')
    playSound('undo')
    if (moves.length) persist(moves, hints, n)
    else clearSave(slot)
  }

  const showHint = () => {
    if (blocked()) return
    if (hints >= config.hints) { setMsg('No hints left for this deal.'); return }
    const found = findHint(game)
    if (!found) { setMsg('No useful moves left. Try undo, or start the deal again.'); return }
    const { move, winnable } = found
    const n = hints + 1
    setHints(n)
    setSelection(null)
    let text
    if (move.type === 'draw') {
      setHint({ from: 'stock', count: 0, to: null })
      text = game.stock.length ? 'Draw from the stock.' : 'Turn the waste back over by tapping the stock.'
    } else {
      const to = validateMove(game, move).to
      const lead = pileCards(game, move.from).at(-(move.count || 1))
      setHint({ from: move.from, count: move.count || 1, to })
      text = `Move the ${cardLabel(lead)}${move.count > 1 ? ` and the cards on it` : ''} to ${pileWords(to)}.`
    }
    if (winnable === false) text += ' This deal can no longer be won from here, though. Undo a few moves.'
    setMsg(text)
    playSound('hint')
    persist(play.moves, n, undos)
  }

  const togglePause = () => {
    if (!started || won) return
    setPaused(p => !p)
  }

  const restartHere = () => { discard.current = true; onRestart() }
  const newHere = () => { discard.current = true; onNew() }

  /* ───── auto-finish: once every column card is face up and a win is certain, play the rest out ───── */
  // planFinish proves the win (with the solver when cards are left in the stock or waste) and returns the moves.
  const finishPlan = useMemo(() => (won || auto ? null : planFinish(game)), [game, won, auto])
  const plan = useRef(null)
  const startAuto = useCallback(line => {
    plan.current = [...line]
    setSelection(null)
    setHint(null)
    setMsg('Every card is face up. Finishing the game for you…')
    setAuto(true)
  }, [])
  useEffect(() => {
    if (finishPlan && prefs.autoFinish && !auto && !locked && !paused) startAuto(finishPlan)
  }, [finishPlan, prefs.autoFinish, auto, locked, paused, startAuto])
  useEffect(() => {
    if (!auto) return undefined
    if (won) { setAuto(false); return undefined }
    const next = plan.current?.[0]
    const reduced = prefersReducedMotion()
    // One card at a time; turning stock cards goes quicker so a long pass through the stock doesn't drag.
    const delay = reduced ? 0 : next?.type === 'draw' ? AUTO_DRAW_MS : AUTO_STEP_MS
    const id = setTimeout(() => {
      const move = plan.current?.shift()
      if (!move || !doMove(move, { silent: true })) {
        plan.current = null
        setAuto(false)
      }
    }, delay)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, game, won])

  /* ───── keyboard shortcuts ───── */
  const keys = useRef(null)
  keys.current = { onDraw, showHint, undo, togglePause, clear: () => setSelection(null), locked }
  useEffect(() => {
    const onKey = e => {
      const k = keys.current
      if (k.locked || e.altKey) return
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return
      const key = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); k.undo(); return }
      if (e.ctrlKey || e.metaKey) return
      if (key === 'd') k.onDraw()
      else if (key === 'h') k.showHint()
      else if (key === 'u') k.undo()
      else if (key === 'p') k.togglePause()
      else if (key === 'escape') k.clear()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const label = mode === 'campaign' ? `Level ${setup.level}` : 'Random deal'
  const seconds = Math.floor(elapsedNow())
  const hintsLeft = Math.max(0, config.hints - hints)

  const share = () => {
    const stars = '★'.repeat(outcome.stars) + '☆'.repeat(3 - outcome.stars)
    shareResult({
      title: TITLE,
      text: `${TITLE} (draw ${draw}) ${label.toLowerCase()} won in ${formatTime(outcome.time)} and ${outcome.moves} moves ${stars} · ${outcome.score} pts`,
      url: window.location.origin + window.location.pathname,
    })
  }

  return (
    <>
      <div className="lg-hud sol-hud">
        <button className="lg-icon" aria-label="Back to menu" onClick={onMenu}>☰</button>
        <span className="lg-title">{label}</span>
        <span className="sol-diff" title={`Difficulty ${Math.round(puzzle.difficulty)} of 100`}>
          <span className="sol-diff-dots" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => <i key={i} className={i < difficultyBand(puzzle.difficulty) ? 'on' : ''} />)}
          </span>
          <span>{difficultyLabel(puzzle.difficulty)} · Draw {draw}</span>
        </span>
        <span className="sol-stats">
          <span>Score <b data-testid="score">{game.score}</b></span>
          <span>Moves <b data-testid="moves">{game.moves}</b></span>
          <span role="timer" aria-label={`Time ${formatTime(seconds)}`}>⏱ <b>{formatTime(seconds)}</b></span>
        </span>
        <span className="sol-hud-actions">
          <button className="lg-icon" aria-label={settings.sound ? 'Mute sound' : 'Turn sound on'} aria-pressed={!settings.sound} onClick={() => updateSettings({ sound: !settings.sound })}>
            {settings.sound ? '🔊' : '🔇'}
          </button>
          <button className="lg-icon" aria-label="Statistics" onClick={() => onModal('stats')}>📊</button>
          <button className="lg-icon" aria-label="How to play" onClick={() => onModal('tutorial')}>❓</button>
        </span>
      </div>

      <div className="sol-felt">
        <SolitaireTable
          game={game}
          selection={selection}
          hint={hint}
          shake={shake}
          disabled={won || paused || locked || auto}
          celebrate={celebrate}
          onTap={onTap}
          onDrop={onDrop}
          onDraw={onDraw}
        />
        {paused && (
          <div className="sol-paused">
            <b>Paused</b>
            <button className="lg-btn big" autoFocus onClick={togglePause}>Resume</button>
          </div>
        )}
      </div>

      <p className="sol-msg" aria-hidden="true">{msg}</p>

      <div className="lg-toolbar sol-toolbar">
        <button className="lg-btn small" onClick={undo} disabled={won || !play.history.length || auto}>↶ Undo</button>
        <button className="lg-btn small" onClick={showHint} disabled={won || paused || auto || hintsLeft === 0} aria-label={`Hint, ${hintsLeft} left`}>💡 Hint {hintsLeft}</button>
        <button className="lg-btn small" onClick={togglePause} disabled={!started || won}>{paused ? '▶ Resume' : '⏸ Pause'}</button>
        <button className="lg-btn small" onClick={restartHere}>⟳ Restart</button>
        {mode === 'random' && <button className="lg-btn small" onClick={newHere}>🎲 New deal</button>}
        {finishPlan && !prefs.autoFinish && !auto && (
          <button className="lg-btn small sol-auto" onClick={() => startAuto(finishPlan)}>⚡ Auto-finish</button>
        )}
      </div>

      <div className="sr-only" aria-live="polite">{msg}</div>

      {stuck && !won && (
        <div className="lg-overlay sol-result" role="dialog" aria-label="No more moves">
          <h2>No more moves 🤔</h2>
          <p>There is nothing left that gets you closer to a win. Undo some moves to try another way, or start again.</p>
          <div className="lg-overlay-buttons">
            <button className="lg-btn big" autoFocus onClick={undo}>↶ Undo</button>
            <button className="lg-btn" onClick={restartHere}>⟳ Restart deal</button>
            {mode === 'random' && <button className="lg-btn" onClick={newHere}>🎲 New deal</button>}
            <button className="lg-btn ghost" onClick={() => setStuck(false)}>Keep looking</button>
            <button className="lg-btn ghost" onClick={onMenu}>Menu</button>
          </div>
        </div>
      )}

      {showResult && outcome && (
        <div className="lg-overlay sol-result" role="dialog" aria-label="You won">
          <h2>You won! 🎉</h2>
          <Stars value={outcome.stars} max={3} size="2em" />
          <p>
            Time <b>{formatTime(outcome.time)}</b> · Moves <b>{outcome.moves}</b> · Score <b>{outcome.score}</b>
            {outcome.newBest && <span className="lg-badge">New best!</span>}
          </p>
          <p className="sol-result-sub">
            Time bonus +{outcome.bonus} · Par time {formatTime(puzzle.par)} · {hints} {hints === 1 ? 'hint' : 'hints'}
            {outcome.newBestTime && ' · fastest win yet'}
            {outcome.fewest && ' · fewest moves yet'}
          </p>
          <div className="lg-overlay-buttons">
            {mode === 'campaign' && <button className="lg-btn big" autoFocus onClick={onNext}>Next level →</button>}
            {mode === 'random' && <button className="lg-btn big" autoFocus onClick={newHere}>🎲 New deal</button>}
            <button className="lg-btn" onClick={share}>Share</button>
            <button className="lg-btn" onClick={() => onModal('stats')}>📊 Stats</button>
            <button className="lg-btn ghost" onClick={() => setShowResult(false)}>See table</button>
            <button className="lg-btn ghost" onClick={onMenu}>Menu</button>
          </div>
        </div>
      )}
    </>
  )
}

function StatsView({ stats }) {
  const cells = [
    ['Played', stats.played],
    ['Won', stats.won],
    ['Win %', stats.winPct],
    ['Current streak', stats.streak],
    ['Best streak', stats.maxStreak],
    ['Avg win time', stats.won ? formatTime(stats.averageTime) : '–'],
  ]
  return (
    <div className="sol-statsview">
      <dl className="sol-stat-grid">
        {cells.map(([name, value]) => (
          <div key={name}><dt>{name}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      <h3>Personal bests</h3>
      <table className="sol-bests">
        <thead><tr><th scope="col">Mode</th><th scope="col">Won</th><th scope="col">Fastest</th><th scope="col">Fewest moves</th><th scope="col">Best score</th></tr></thead>
        <tbody>
          {[['d1', 'Draw one'], ['d3', 'Draw three']].map(([k, name]) => {
            const m = stats.modes[k]
            return (
              <tr key={k}>
                <th scope="row">{name}</th>
                <td>{m.won}/{m.played}</td>
                <td>{m.times.length ? formatTime(m.times[0]) : '–'}</td>
                <td>{m.fewestMoves ?? '–'}</td>
                <td>{m.bestScore || '–'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
