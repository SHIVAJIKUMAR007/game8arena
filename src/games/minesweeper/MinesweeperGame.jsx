// Minesweeper: open every safe square, flag the mines, beat the clock.
//
// Like Word Guess, this game has its own small shell instead of LevelGameShell, because its rules don't fit lives:
// one mine ends the round, it runs against a timer, and it keeps per-mode best times. It still reuses the shared
// platform: progress store, daily seed + streak, achievements, sound, haptics, share, analytics, the settings /
// tutorial / modal / level-map UI and the lg-* styles.
//
// What the board shows is built by logic.view(), which reports mines only after the round is over, so the DOM never
// holds hidden information while you play. The board itself is generated on the first click (see generator.js).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getProgress, updateProgress, useProgress } from '../../platform/progress'
import { completeDaily, dailyState, todayKey } from '../../platform/daily'
import { checkAchievements } from '../../platform/achievements'
import { playSound } from '../../platform/sound'
import { vibrate } from '../../platform/haptics'
import { track } from '../../platform/analytics'
import { shareResult } from '../../platform/share'
import { prefersReducedMotion } from '../../platform/settings'
import SettingsModal from '../../platform/ui/SettingsModal'
import Tutorial from '../../platform/ui/Tutorial'
import LevelSelect from '../../platform/ui/LevelSelect'
import Modal from '../../platform/ui/Modal'
import Stars from '../../platform/ui/Stars'
import '../../platform/platform.css'
import './MinesweeperGame.css'
import { config } from './config'
import { chord, minesLeft, newGame, restore, reveal, snapshot, toggleFlag, view, withMines } from './logic'
import { CLASSIC, CLASSIC_IDS, difficultyBand, difficultyLabel, generatePuzzle, makeSetup } from './levels'
import { findHint } from './solver'
import { GAME_ID, formatTime, readSave, readStats, recordResult, summarize } from './store'

const TITLE = 'Minesweeper'
const LONG_PRESS_MS = 380
const MODE_NAME = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert', level: 'Levels', daily: 'Daily' }

const slotOf = mode => (mode === 'campaign' ? 'campaign' : mode === 'daily' ? 'daily' : 'classic')
const statMode = mode => (mode === 'campaign' ? 'level' : mode)
const newSeed = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
const saves = p => (p.msSaves && typeof p.msSaves === 'object' ? p.msSaves : {})

const clearSave = slot => updateProgress(GAME_ID, p => (saves(p)[slot] ? { ...p, msSaves: { ...saves(p), [slot]: null } } : p))

const HINT_TEXT = {
  start: 'Try the glowing square. Your first click is always safe, so any square works too.',
  'safe:basic': 'This square is safe: a number next to it already has all its mines accounted for.',
  'mine:basic': 'This square holds a mine: a number next to it has exactly as many closed squares as mines.',
  'safe:count': 'This square is safe: every mine on the board is already found.',
  'mine:count': 'This square holds a mine: the closed squares left are exactly as many as the mines left.',
  'safe:subset': 'This square is safe. Compare two neighbouring numbers: the squares only one of them touches settle it.',
  'mine:subset': 'This square holds a mine. Compare two neighbouring numbers: the squares only one of them touches settle it.',
  'safe:enum': 'This square is safe: in every mine layout that fits the numbers around it, it stays empty.',
  'mine:enum': 'This square holds a mine: in every mine layout that fits the numbers around it, it is a mine.',
}

/** Three-digit LCD text: 007, 042, or -07 when the player has flagged more squares than there are mines. */
const lcd = n => (n < 0 ? `-${String(Math.min(99, -n)).padStart(2, '0')}` : String(Math.min(999, n)).padStart(3, '0'))

const cellLabel = (r, c, v) => {
  const where = `Row ${r + 1}, column ${c + 1}`
  switch (v.state) {
    case 'flag': return `${where}: flagged`
    case 'open': return `${where}: ${v.n === 0 ? 'empty' : `${v.n} adjacent ${v.n === 1 ? 'mine' : 'mines'}`}`
    case 'mine': return `${where}: mine`
    case 'boom': return `${where}: exploded mine`
    case 'wrong': return `${where}: wrong flag, no mine here`
    default: return `${where}: closed`
  }
}

export default function MinesweeperGame({ initialMode, dailyPicks }) {
  const progress = useProgress(GAME_ID)
  const [screen, setScreen] = useState('menu') // menu | levels | play
  const [setup, setSetup] = useState(null)
  const [round, setRound] = useState(0)
  const [modal, setModal] = useState(null) // settings | tutorial | achievements | stats

  const start = useCallback((mode, o = {}) => {
    let s
    if (mode === 'campaign') s = makeSetup('campaign', { level: o.level ?? 1 })
    else if (mode === 'daily') s = makeSetup('daily', { date: todayKey() })
    else {
      const save = o.fresh ? null : readSave(getProgress(GAME_ID), 'classic')
      s = makeSetup(mode, { seed: save && save.mode === mode && save.seed ? save.seed : newSeed() })
      if (o.fresh) clearSave('classic')
    }
    setSetup(s)
    setRound(r => r + 1)
    setScreen('play')
    track('level_start', { game: GAME_ID, level: s.level ?? 0, mode })
    if (!getProgress(GAME_ID).tutorialSeen) setModal('tutorial')
  }, [])

  const restart = useCallback(() => {
    if (!setup) return
    clearSave(slotOf(setup.mode))
    setRound(r => r + 1)
  }, [setup])

  useEffect(() => { track('game_open', { game: GAME_ID }) }, [])
  useEffect(() => {
    if (initialMode === 'daily') start('daily')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode])

  const closeTutorial = useCallback(() => {
    updateProgress(GAME_ID, p => (p.tutorialSeen ? p : { ...p, tutorialSeen: true }))
    setModal(null)
  }, [])
  const closeModal = useCallback(() => setModal(null), [])

  const stats = summarize(progress.msStats)
  const ds = dailyState(progress)
  const unlocked = Object.keys(progress.achievements).length
  const classicSave = readSave(progress, 'classic')

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
    const hasProgress = progress.level > 1 || progress.best > 0
    return (
      <div className="lg-root lg-menu ms-menu">
        <h1>{TITLE}</h1>
        <p className="ms-sub">Open every safe square and flag the mines. Levels grow slowly, and each board can be solved by logic.</p>
        <div className="lg-menu-stats">
          <span>Level <b>{progress.level}</b></span>
          <span>Win rate <b>{stats.winPct}%</b></span>
          <span>Streak <b>{stats.streak}</b></span>
        </div>
        <div className="lg-menu-buttons">
          <button className="lg-btn big" onClick={() => start('campaign', { level: progress.level })}>
            {hasProgress || readSave(progress, 'campaign') ? `▶ Continue: Level ${progress.level}` : '▶ Play'}
          </button>
          <button className="lg-btn" onClick={() => start('daily')}>
            📅 Daily board {ds.done ? '✓' : ''} {ds.streak > 0 && `· 🔥${ds.streak}`}
          </button>
          <div className="ms-classic" role="group" aria-label="Classic boards">
            {CLASSIC_IDS.map(id => {
              const c = CLASSIC[id]
              const best = stats.best[id]
              const resumable = classicSave?.mode === id
              return (
                <button key={id} className="lg-btn ms-classic-btn" onClick={() => start(id)}>
                  <b>{c.label}{resumable ? ' (resume)' : ''}</b>
                  <small>{c.w}×{c.h} · {c.mines} mines{best ? ` · best ${formatTime(best)}` : ''}</small>
                </button>
              )
            })}
          </div>
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
    <div className="lg-root ms-root">
      <Round
        key={`${setup.key}-${round}`}
        setup={setup}
        picks={dailyPicks || [GAME_ID]}
        locked={modal !== null}
        onMenu={() => setScreen('menu')}
        onRestart={restart}
        onNext={() => start('campaign', { level: getProgress(GAME_ID).level })}
        onNew={() => start(setup.mode, { fresh: true })}
        onModal={setModal}
      />
      {modals}
    </div>
  )
}

/** One board, from the first click to the result. Remounted (by key) for every new board. */
function Round({ setup, picks, locked, onMenu, onRestart, onNext, onNew, onModal }) {
  const { mode, w, h } = setup
  const slot = slotOf(mode)
  const classic = Boolean(CLASSIC[mode])

  // Resume a saved game if there is one for this exact board.
  const init = useMemo(() => {
    const save = readSave(getProgress(GAME_ID), slot, setup.key)
    if (save) {
      const puzzle = generatePuzzle(setup, save.firstIdx)
      const game = restore(w, h, puzzle.mineCount, puzzle.mines, save)
      if (game) return { game, puzzle, hints: save.hints, elapsed: save.elapsed }
    }
    return { game: newGame(w, h, setup.mines), puzzle: null, hints: 0, elapsed: 0 }
  }, [setup, slot, w, h])

  const [game, setGame] = useState(init.game)
  const [hints, setHints] = useState(init.hints)
  const [, setTick] = useState(0) // re-render for the clock
  const [flagMode, setFlagMode] = useState(false)
  const [paused, setPaused] = useState(false)
  const [hintInfo, setHintInfo] = useState(null)
  const [msg, setMsg] = useState('')
  const [outcome, setOutcome] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [focus, setFocus] = useState(setup.start)

  const puzzleRef = useRef(init.puzzle)
  const clock = useRef({ elapsed: init.elapsed, last: 0, running: false })
  const latest = useRef({})
  const discard = useRef(false) // set when restarting or starting a new board, so the unmount save doesn't bring the old game back
  const press = useRef({ timer: null, fired: false, type: 'mouse' })
  const timers = useRef([])
  const gridRef = useRef(null)
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => { timers.current.forEach(clearTimeout); clearTimeout(press.current.timer) }, [])

  const over = game.status === 'won' || game.status === 'lost'
  const running = game.status === 'playing' && !paused && !locked
  const elapsedNow = () => clock.current.elapsed + (clock.current.running ? (Date.now() - clock.current.last) / 1000 : 0)

  // Clock: counts only while a game is on, it isn't paused and no dialog is open.
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
    }, 250)
    return () => {
      clearInterval(id)
      c.elapsed += (Date.now() - c.last) / 1000
      c.running = false
    }
  }, [running])

  const persist = useCallback((g, hintCount) => {
    const puzzle = puzzleRef.current
    if (g.status !== 'playing' || !puzzle) return
    const entry = { key: setup.key, mode, seed: setup.seed, firstIdx: puzzle.firstIdx, ...snapshot(g), elapsed: Math.round(elapsedNow() * 10) / 10, hints: hintCount }
    updateProgress(GAME_ID, p => ({ ...p, msSaves: { ...saves(p), [slot]: entry } }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup, mode, slot])

  // Keep the newest game around for the unmount save (leaving mid-game keeps your place and your time).
  latest.current = { game, hints, persist }
  useEffect(() => () => {
    const l = latest.current
    if (!discard.current) l.persist(l.game, l.hints)
  }, [])

  const finish = useCallback((g, hintCount) => {
    const won = g.status === 'won'
    const time = Math.max(1, Math.round(elapsedNow()))
    const puzzle = puzzleRef.current
    const before = getProgress(GAME_ID)
    const sm = statMode(mode)
    const countsForDaily = mode === 'daily' && won && before.daily.last !== todayKey()
    const stars = won ? 1 + (hintCount === 0 ? 1 : 0) + (time <= setup.par ? 1 : 0) : 0
    const score = won
      ? Math.max(10, Math.round(200 + 10 * puzzle.difficulty + Math.max(0, 2 * setup.par - time) * 2 - 50 * hintCount))
      : 0
    const bestBefore = summarize(before.msStats).best[sm]
    const newBestTime = won && (bestBefore === null || time < bestBefore)
    if (countsForDaily) completeDaily(GAME_ID, { stars, score }, picks)
    updateProgress(GAME_ID, p => ({
      ...p,
      level: mode === 'campaign' && won ? Math.max(p.level, setup.level + 1) : p.level,
      best: mode === 'campaign' && won ? Math.max(p.best, setup.level) : p.best,
      stars: mode === 'campaign' && won ? { ...p.stars, [setup.level]: Math.max(p.stars[setup.level] || 0, stars) } : p.stars,
      highScore: Math.max(p.highScore, score),
      stats: { ...p.stats, cleared: p.stats.cleared + (won ? 1 : 0), flawless: p.stats.flawless + (won && hintCount === 0 ? 1 : 0), hints: p.stats.hints + hintCount },
      msStats: recordResult(p.msStats, { mode: sm, won, time }),
      msSaves: { ...saves(p), [slot]: null },
    }))
    if (won) checkAchievements(GAME_ID, config.achievements, { mode, level: setup.level, won, time, hints: hintCount })
    setOutcome({ won, time, stars, score, newBest: score > before.highScore, newBestTime, practice: mode === 'daily' && won && !countsForDaily, streak: readStats(getProgress(GAME_ID)).streak })
    track(won ? 'level_win' : 'level_fail', { game: GAME_ID, level: setup.level ?? 0, mode, time, stars, score })
    setMsg(won ? 'Board cleared.' : 'You opened a mine.')
    later(() => setShowResult(true), prefersReducedMotion() ? 0 : won ? 500 : 800)
    playSound(won ? 'win' : 'lose')
    vibrate(won ? [60, 40, 60] : 200)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, setup, picks, slot])

  const commit = useCallback((next, hintCount = hints) => {
    setGame(next)
    setHintInfo(null)
    if (next.status === 'won' || next.status === 'lost') finish(next, hintCount)
    else persist(next, hintCount)
  }, [finish, persist, hints])

  const blocked = () => over || paused || locked
  const restartHere = () => { discard.current = true; onRestart() }
  const newHere = () => { discard.current = true; onNew() }

  const dig = idx => {
    if (blocked()) return
    let g = game
    if (g.status === 'ready') {
      if (g.flags[idx]) return
      // The board is built from the seed and this first click, with the click's neighbourhood kept clear.
      puzzleRef.current = generatePuzzle(setup, idx)
      g = withMines(g, puzzleRef.current.mines)
    }
    const next = g.revealed[idx] ? chord(g, idx) : reveal(g, idx)
    if (next === game) return
    playSound('tap')
    if (next.status === 'lost') vibrate(120)
    commit(next)
  }

  const flag = idx => {
    if (blocked()) return
    const next = toggleFlag(game, idx)
    if (next === game) return
    playSound('tap')
    vibrate(20)
    commit(next)
  }

  const hint = () => {
    if (blocked()) return
    if (game.status === 'ready') {
      setHintInfo({ idx: setup.start, type: 'start' })
      setMsg(HINT_TEXT.start)
      playSound('hint')
      return
    }
    if (hints >= config.hints) { setMsg('No hints left on this board.'); return }
    const found = findHint(game)
    if (!found) { setMsg('No square is certain from here. Compare two neighbouring numbers.'); return }
    const n = hints + 1
    setHints(n)
    setHintInfo(found)
    setMsg(found.type === 'safe' && game.flags[found.idx] ? 'The flagged square is actually safe. Remove the flag and open it.' : HINT_TEXT[`${found.type}:${found.tech}`])
    playSound('hint')
    persist(game, n)
  }

  const togglePause = () => {
    if (game.status !== 'playing') return
    setPaused(p => !p)
  }

  // ----- input on cells -----
  const onPointerDown = (e, i) => {
    press.current.type = e.pointerType || 'mouse'
    press.current.fired = false
    clearTimeout(press.current.timer)
    if (press.current.type !== 'mouse') {
      press.current.timer = setTimeout(() => { press.current.fired = true; flag(i) }, LONG_PRESS_MS)
    }
  }
  const cancelPress = () => clearTimeout(press.current.timer)
  const onClick = i => {
    cancelPress()
    if (press.current.fired) { press.current.fired = false; return }
    setFocus(i)
    if (flagMode && !game.revealed[i]) flag(i)
    else dig(i)
  }
  const onContextMenu = (e, i) => {
    e.preventDefault()
    if (press.current.type !== 'mouse') return // touch: the long-press timer already flagged it
    setFocus(i)
    flag(i)
  }
  const onAuxClick = (e, i) => {
    if (e.button !== 1) return
    e.preventDefault()
    if (game.revealed[i]) dig(i)
  }

  const onKeyDown = e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const move = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key]
    if (move) {
      e.preventDefault()
      const r = Math.min(h - 1, Math.max(0, Math.floor(focus / w) + move[0]))
      const c = Math.min(w - 1, Math.max(0, (focus % w) + move[1]))
      const n = r * w + c
      setFocus(n)
      gridRef.current?.querySelector(`[data-i="${n}"]`)?.focus()
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault()
      flag(focus)
    }
  }

  const cells = view(game)
  const label = mode === 'daily' ? 'Daily board' : mode === 'campaign' ? `Level ${setup.level}` : setup.title
  const score = puzzleRef.current ? puzzleRef.current.difficulty : setup.difficulty
  const left = minesLeft(game)
  const hintsLeft = Math.max(0, config.hints - hints)
  const seconds = game.status === 'ready' ? 0 : Math.min(999, Math.max(game.status === 'playing' ? 1 : 0, Math.floor(elapsedNow())))
  const face = game.status === 'won' ? '😎' : game.status === 'lost' ? '😵' : '🙂'
  const solvable = puzzleRef.current?.solvable

  const share = () => {
    const stars = '★'.repeat(outcome.stars) + '☆'.repeat(3 - outcome.stars)
    shareResult({
      title: TITLE,
      text: `${TITLE} ${label.toLowerCase()} cleared in ${formatTime(outcome.time)} ${stars}${hints ? ` · ${hints} hint${hints > 1 ? 's' : ''}` : ''}`,
      url: window.location.origin + window.location.pathname,
    })
  }

  return (
    <>
      <div className="lg-hud ms-hud">
        <button className="lg-icon" aria-label="Back to menu" onClick={onMenu}>☰</button>
        <span className="lg-title">{label}</span>
        <span className="ms-diff" title={`Difficulty ${Math.round(score)} of 100`}>
          <span className="ms-diff-dots" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => <i key={i} className={i < difficultyBand(score) ? 'on' : ''} />)}
          </span>
          <span>Difficulty: {difficultyLabel(score)}</span>
        </span>
        <span className="ms-hud-actions">
          <button className="lg-icon" aria-label="Statistics" onClick={() => onModal('stats')}>📊</button>
          <button className="lg-icon" aria-label="How to play" onClick={() => onModal('tutorial')}>❓</button>
        </span>
      </div>

      <div className="ms-panel">
        <span className="ms-lcd" role="img" aria-label={`${left} mines left`}>{lcd(left)}</span>
        <button className="ms-face" aria-label="Restart" onClick={restartHere}>{face}</button>
        <span className="ms-lcd" role="timer" aria-label={`${seconds} seconds`}>{lcd(seconds)}</span>
      </div>

      <p className="ms-msg" aria-hidden="true">{msg}</p>

      <div className="ms-field">
        <div
          ref={gridRef}
          className={`ms-grid${paused ? ' paused' : ''}${over ? ' over' : ''}`}
          style={{ '--cols': w, '--rows': h }}
          role="grid"
          aria-label={`${TITLE} board, ${w} by ${h}, ${setup.mines} mines`}
          onKeyDown={onKeyDown}
        >
          {Array.from({ length: h }, (_, r) => (
            <div className="ms-row" role="row" key={r}>
              {Array.from({ length: w }, (_, c) => {
                const i = r * w + c
                const v = cells[i]
                const hinted = hintInfo?.idx === i
                const cls = [
                  'ms-cell', v.state,
                  v.state === 'open' && v.n > 0 && `n${v.n}`,
                  game.status === 'ready' && i === setup.start && 'start',
                  hinted && (hintInfo.type === 'mine' ? 'hint-mine' : 'hint-safe'),
                ].filter(Boolean).join(' ')
                return (
                  <button
                    key={i}
                    type="button"
                    role="gridcell"
                    data-i={i}
                    className={cls}
                    tabIndex={focus === i ? 0 : -1}
                    aria-label={cellLabel(r, c, v)}
                    onPointerDown={e => onPointerDown(e, i)}
                    onPointerUp={cancelPress}
                    onPointerLeave={cancelPress}
                    onPointerCancel={cancelPress}
                    onClick={() => onClick(i)}
                    onContextMenu={e => onContextMenu(e, i)}
                    onAuxClick={e => onAuxClick(e, i)}
                  >
                    {v.state === 'open' ? (v.n > 0 ? v.n : '') : v.state === 'flag' ? '🚩' : v.state === 'mine' ? '💣' : v.state === 'boom' ? '💥' : v.state === 'wrong' ? '🚩' : ''}
                  </button>
                )
              })}
            </div>
          ))}
          {paused && (
            <div className="ms-paused">
              <b>Paused</b>
              <button className="lg-btn big" autoFocus onClick={togglePause}>Resume</button>
            </div>
          )}
        </div>
      </div>

      <div className="lg-toolbar ms-toolbar">
        <button className="lg-btn small" onClick={hint} disabled={over || paused} aria-label={`Hint, ${hintsLeft} left`}>💡 Hint {hintsLeft}</button>
        <button className="lg-btn small" aria-pressed={flagMode} onClick={() => setFlagMode(f => !f)} disabled={over}>
          {flagMode ? '🚩 Flag mode' : '⛏️ Dig mode'}
        </button>
        <button className="lg-btn small" onClick={togglePause} disabled={game.status !== 'playing'}>{paused ? '▶ Resume' : '⏸ Pause'}</button>
        {classic && <button className="lg-btn small" onClick={newHere}>New board</button>}
        <span className="ms-note">
          {solvable === true ? 'No guessing needed' : solvable === false ? 'May need a guess' : ''}
        </span>
      </div>

      <div className="sr-only" aria-live="polite">{msg}</div>

      {showResult && outcome && (
        <div className="lg-overlay ms-result" role="dialog" aria-label={outcome.won ? 'Board cleared' : 'You hit a mine'}>
          <h2>{outcome.won ? 'Board cleared 🎉' : 'Boom 💥'}</h2>
          {outcome.won ? (
            <>
              <Stars value={outcome.stars} max={3} size="2em" />
              <p>
                Time <b>{formatTime(outcome.time)}</b> · Score <b>{outcome.score}</b>
                {outcome.newBest && <span className="lg-badge">New best!</span>}
              </p>
              {outcome.newBestTime && classic && <p>New best time for {setup.title}.</p>}
              {outcome.practice && <p>Today’s daily was already counted. This one was practice.</p>}
              <p className="ms-result-sub">Par time {formatTime(setup.par)} · {hints} {hints === 1 ? 'hint' : 'hints'} used</p>
            </>
          ) : (
            <p>You opened a mine after {formatTime(outcome.time)}. The board shows where the mines were.</p>
          )}
          <div className="lg-overlay-buttons">
            {mode === 'campaign' && outcome.won && <button className="lg-btn big" autoFocus onClick={onNext}>Next level →</button>}
            {mode === 'campaign' && !outcome.won && <button className="lg-btn big" autoFocus onClick={restartHere}>Try again</button>}
            {mode === 'daily' && <button className="lg-btn big" autoFocus onClick={outcome.won ? onNext : restartHere}>{outcome.won ? 'Play levels →' : 'Try again'}</button>}
            {classic && <button className="lg-btn big" autoFocus onClick={newHere}>New board</button>}
            {classic && !outcome.won && <button className="lg-btn" onClick={restartHere}>Same board again</button>}
            {outcome.won && <button className="lg-btn" onClick={share}>Share</button>}
            <button className="lg-btn" onClick={() => onModal('stats')}>📊 Stats</button>
            <button className="lg-btn ghost" onClick={() => setShowResult(false)}>See board</button>
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
    ['Win %', stats.winPct],
    ['Current streak', stats.streak],
    ['Max streak', stats.maxStreak],
    ['Avg win time', stats.won ? formatTime(stats.averageTime) : '–'],
  ]
  return (
    <div className="ms-stats">
      <dl className="ms-stat-grid">
        {cells.map(([name, value]) => (
          <div key={name}><dt>{name}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      <h3>Best times</h3>
      <table className="ms-times">
        <thead><tr><th scope="col">Mode</th><th scope="col">Won</th><th scope="col">Fastest</th></tr></thead>
        <tbody>
          {Object.entries(MODE_NAME).map(([id, name]) => {
            const m = stats.modes[id]
            return (
              <tr key={id}>
                <th scope="row">{name}</th>
                <td>{m.won}/{m.played}</td>
                <td>{m.times.length ? m.times.slice(0, 3).map(formatTime).join(' · ') : '–'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
