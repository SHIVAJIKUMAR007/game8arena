// Word Guess: find the hidden five-letter word in six tries.
//
// This game has its own small shell instead of LevelGameShell, because its rules don't fit lives:
// a word is won or lost outright, the loss screen must reveal the answer, and it keeps word-game
// statistics (played, win %, streak, guess distribution) and a hard-mode setting. It still reuses the
// shared platform: progress store, daily seed + streak, achievements, sound, haptics, share, analytics,
// settings/tutorial/modal UI and the lg-* styles.
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
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
import Modal from '../../platform/ui/Modal'
import Stars from '../../platform/ui/Stars'
import '../../platform/platform.css'
import './WordGame.css'
import { config } from './config'
import { dailyPuzzle, generateLevel } from './levels'
import {
  ABSENT, CORRECT, MAX_GUESSES, PRESENT, WORD_LENGTH, evaluateGuess, getHint, guessError, isWin,
  keyboardStates, normalize, scoreFor, shareGrid, starsFor,
} from './logic'
import { GAME_ID, readHard, readSave, readStats, recordResult, summarize } from './store'

const TITLE = 'Word Guess'
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
const TILE_STAGGER_MS = 300
const FLIP_MS = 500
const PRAISE = ['Incredible!', 'Brilliant!', 'Excellent!', 'Great job!', 'Nice!', 'Just in time!']
const STATE_NAME = { [CORRECT]: 'correct', [PRESENT]: 'in the word, wrong spot', [ABSENT]: 'not in the word' }

function makePuzzle(mode, level) {
  if (mode === 'daily') {
    const date = todayKey()
    return { ...dailyPuzzle(date), key: date, slot: 'daily' }
  }
  return { ...generateLevel(level), key: `L${level}`, slot: 'campaign' }
}

const describeRow = (n, { word, result }) =>
  `Guess ${n}: ${word.toUpperCase()}. ${[...word].map((c, i) => `${c.toUpperCase()} ${STATE_NAME[result[i]]}`).join(', ')}.`

export default function WordGame({ initialMode, dailyPicks }) {
  const progress = useProgress(GAME_ID)
  const [screen, setScreen] = useState('menu') // menu | play
  const [puzzle, setPuzzle] = useState(null)
  const [round, setRound] = useState(0)
  const [modal, setModal] = useState(null) // settings | tutorial | achievements | stats

  const start = useCallback((mode, level = 1) => {
    const p = makePuzzle(mode, level)
    setPuzzle(p)
    setRound(r => r + 1)
    setScreen('play')
    track('level_start', { game: GAME_ID, level: p.level ?? 0, mode })
    if (!getProgress(GAME_ID).tutorialSeen) setModal('tutorial')
  }, [])

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

  const hard = readHard(progress)
  const stats = summarize(progress.wordStats)
  const today = todayKey()
  const dailyDone = Boolean(readSave(progress, 'daily', today)?.recorded)
  const ds = dailyState(progress)
  const campaignSave = readSave(progress, 'campaign', `L${progress.level}`)
  const inProgress = Boolean(campaignSave?.guesses.length && !campaignSave.recorded)

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

  if (screen === 'menu' || !puzzle) {
    const unlocked = Object.keys(progress.achievements).length
    return (
      <div className="lg-root lg-menu wg-menu">
        <h1>{TITLE}</h1>
        <p className="wg-sub">Six tries to find the five-letter word. Unlimited levels, one daily word.</p>
        <div className="lg-menu-stats">
          <span>Level <b>{progress.level}</b></span>
          <span>Win rate <b>{stats.winPct}%</b></span>
          <span>Streak <b>{stats.streak}</b></span>
          {stats.wins > 0 && <span>Avg guesses <b>{stats.average}</b></span>}
        </div>
        <div className="lg-menu-buttons">
          <button className="lg-btn big" onClick={() => start('campaign', progress.level)}>
            {progress.level > 1 || inProgress ? `▶ Continue — Level ${progress.level}` : '▶ Play'}
          </button>
          <button className="lg-btn" onClick={() => start('daily')}>
            📅 Daily word {dailyDone ? '✓' : ''} {ds.streak > 0 && `· 🔥${ds.streak}`}
          </button>
          <button className="lg-btn" onClick={() => setModal('stats')}>📊 Statistics</button>
          <label className="wg-toggle">
            <input
              type="checkbox"
              checked={hard}
              onChange={e => { const v = e.target.checked; updateProgress(GAME_ID, p => ({ ...p, wordHard: v })) }}
            />
            <span><b>Hard mode</b><small>Green and yellow letters must be used in later guesses{inProgress ? '. Starts with your next word.' : '.'}</small></span>
          </label>
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
    <div className="lg-root wg-root">
      <Round
        key={round}
        puzzle={puzzle}
        picks={dailyPicks || [GAME_ID]}
        paused={modal !== null}
        onMenu={() => setScreen('menu')}
        onNext={() => start('campaign', getProgress(GAME_ID).level)}
        onModal={setModal}
      />
      {modals}
    </div>
  )
}

/** One word, from first guess to result. Remounted (by key) for every new word. */
function Round({ puzzle, picks, paused, onMenu, onNext, onModal }) {
  const { answer, mode, slot, key } = puzzle

  // Resume a saved word if there is one for this exact puzzle.
  const init = useMemo(() => {
    const p = getProgress(GAME_ID)
    const save = readSave(p, slot, key)
    const rows = []
    for (const word of save?.guesses ?? []) {
      const result = evaluateGuess(word, answer)
      rows.push({ word, result })
      if (isWin(result)) break
    }
    const won = rows.length > 0 && isWin(rows[rows.length - 1].result)
    return {
      rows,
      current: '',
      given: save?.given ?? [],
      hard: rows.length ? save.hard : readHard(p),
      recorded: save?.recorded ?? false,
      status: won ? 'won' : rows.length >= MAX_GUESSES ? 'lost' : 'playing',
      revealing: false,
      shaking: false,
      msg: null,
      pressed: null,
      outcome: null,
      showResult: false,
    }
  }, [answer, slot, key])

  // All round state lives in one mutable object so the window key handler never reads stale values.
  const g = useRef(init)
  const [, rerender] = useReducer(x => x + 1, 0)
  const set = useCallback(patch => { Object.assign(g.current, patch); rerender() }, [])
  const timers = useRef([])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const [announcement, setAnnouncement] = useState('')

  const hard = g.current.hard
  const pausedRef = useRef(paused)
  useLayoutEffect(() => { pausedRef.current = paused })

  const flash = useCallback((text, ms = 1600) => {
    const id = Math.random()
    set({ msg: { text, id } })
    setAnnouncement(text)
    if (ms) later(() => g.current.msg?.id === id && set({ msg: null }), ms)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set])

  const persist = (rows, given, recorded = false) =>
    updateProgress(GAME_ID, p => ({
      ...p,
      wordSaves: { ...(p.wordSaves && typeof p.wordSaves === 'object' ? p.wordSaves : {}), [slot]: { key, guesses: rows.map(r => r.word), given, hard, recorded } },
    }))

  const finish = useCallback((won, rows, given) => {
    const guesses = rows.length
    const hintsUsed = given.length
    const stars = won ? starsFor(guesses, hintsUsed) : 0
    const score = won ? scoreFor(guesses, { hard, hintsUsed }) : 0
    const before = getProgress(GAME_ID)
    if (!readSave(before, slot, key)?.recorded) {
      if (mode === 'daily') completeDaily(GAME_ID, { stars, score }, picks)
      updateProgress(GAME_ID, p => ({
        ...p,
        level: mode === 'campaign' ? Math.max(p.level, puzzle.level + 1) : p.level,
        best: mode === 'campaign' && won ? Math.max(p.best, puzzle.level) : p.best,
        stars: mode === 'campaign' && won ? { ...p.stars, [puzzle.level]: Math.max(p.stars[puzzle.level] || 0, stars) } : p.stars,
        highScore: Math.max(p.highScore, score),
        stats: {
          ...p.stats,
          cleared: p.stats.cleared + (won ? 1 : 0),
          flawless: p.stats.flawless + (stars === 3 ? 1 : 0),
          hints: p.stats.hints + hintsUsed,
        },
        wordStats: recordResult(p.wordStats, { won, guesses }),
        wordSaves: { ...(p.wordSaves && typeof p.wordSaves === 'object' ? p.wordSaves : {}), [slot]: { key, guesses: rows.map(r => r.word), given, hard, recorded: true } },
      }))
      checkAchievements(GAME_ID, config.achievements, { level: puzzle.level, mode, won, guesses: won ? guesses : 0, hard, hints: hintsUsed })
      track(won ? 'level_win' : 'level_fail', { game: GAME_ID, level: puzzle.level ?? 0, mode, guesses, stars, score })
    }
    set({ outcome: { won, guesses, stars, score, newBest: score > before.highScore, streak: readStats(getProgress(GAME_ID)).streak } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hard, slot, key, mode, picks, puzzle.level, set])

  // A finished word that was never recorded (e.g. the tab closed mid-reveal) is recorded on load.
  useEffect(() => {
    const s = g.current
    if (s.status !== 'playing') {
      finish(s.status === 'won', s.rows, s.given)
      set({ showResult: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const busy = () => g.current.status !== 'playing' || g.current.revealing || pausedRef.current

  const type = letter => {
    if (busy() || g.current.current.length >= WORD_LENGTH) return
    set({ current: g.current.current + letter })
    playSound('tap')
  }
  const erase = () => {
    if (busy() || !g.current.current) return
    set({ current: g.current.current.slice(0, -1) })
  }

  const submit = () => {
    if (busy()) return
    const { rows, current, given } = g.current
    const err = guessError(current, { rows, hard, given, answer })
    if (err) {
      flash(err)
      set({ shaking: true })
      later(() => set({ shaking: false }), 600)
      playSound('blocked')
      vibrate(60)
      return
    }
    const word = normalize(current)
    const result = evaluateGuess(word, answer)
    const next = [...rows, { word, result }]
    const won = isWin(result)
    const over = won || next.length >= MAX_GUESSES
    set({ rows: next, current: '' })
    if (!over) persist(next, given)
    setAnnouncement(describeRow(next.length, next[next.length - 1]))

    const done = () => {
      set({ revealing: false })
      if (won) {
        set({ status: 'won' })
        flash(PRAISE[next.length - 1], 0)
        finish(true, next, given)
        later(() => set({ showResult: true }), prefersReducedMotion() ? 0 : 1100)
      } else if (over) {
        set({ status: 'lost' })
        flash(answer.toUpperCase(), 0)
        finish(false, next, given)
        playSound('lose')
        vibrate(200)
        later(() => set({ showResult: true }), prefersReducedMotion() ? 0 : 900)
      } else {
        playSound('combo', result.filter(s => s === CORRECT).length * 2 + 1)
      }
      if (won) { playSound('win'); vibrate([60, 40, 60]) }
    }
    const ms = prefersReducedMotion() ? 0 : TILE_STAGGER_MS * (WORD_LENGTH - 1) + FLIP_MS
    if (ms) { set({ revealing: true }); later(done, ms) } else done()
  }

  const hint = () => {
    if (busy()) return
    const { rows, given } = g.current
    if (given.length >= config.hints) { flash('No hints left for this word'); return }
    const h = getHint(answer, rows, given)
    if (!h) { flash('You already know enough letters for a hint'); return }
    const nextGiven = [...given, h.index]
    set({ given: nextGiven })
    persist(rows, nextGiven)
    flash(`Hint: letter ${h.index + 1} is ${h.letter.toUpperCase()}`, 2600)
    playSound('hint')
  }

  const press = k => {
    if (k === 'enter') submit()
    else if (k === 'back') erase()
    else type(k)
  }

  // Physical keyboard. Ignored while a modal is open, with modifier keys, or when typing in a form field.
  const pressRef = useRef(press)
  useLayoutEffect(() => { pressRef.current = press })
  useEffect(() => {
    const onKey = e => {
      if (e.ctrlKey || e.metaKey || e.altKey || pausedRef.current) return
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]')) return
      let k = null
      if (e.key === 'Enter') {
        if (e.target instanceof Element && e.target.closest('button')) return // the focused button handles it
        k = 'enter'
      } else if (e.key === 'Backspace' || e.key === 'Delete') k = 'back'
      else if (/^[a-zA-Z]$/.test(e.key)) k = e.key.toLowerCase()
      if (!k) return
      e.preventDefault()
      pressRef.current(k)
      set({ pressed: k })
      later(() => g.current.pressed === k && set({ pressed: null }), 130)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set])

  const { rows, current, given, status, revealing, shaking, msg, pressed, outcome, showResult } = g.current
  const keys = keyboardStates(revealing ? rows.slice(0, -1) : rows)
  const hintsLeft = Math.max(0, config.hints - given.length)
  const done = status !== 'playing'
  const label = mode === 'daily' ? `daily ${puzzle.date}` : `level ${puzzle.level}`

  const share = () => {
    const tries = outcome?.won ? rows.length : 'X'
    shareResult({
      title: TITLE,
      text: `${TITLE} ${label} ${tries}/${MAX_GUESSES}${hard ? ' (hard)' : ''}\n${shareGrid(rows)}`,
      url: window.location.origin + window.location.pathname,
    })
  }

  const keyButton = (k, content, extra = '', aria) => (
    <button
      key={k}
      type="button"
      className={`wg-key ${extra}${pressed === k ? ' pressed' : ''}`}
      aria-label={aria}
      disabled={done}
      onClick={e => { e.currentTarget.blur(); press(k) }}
    >
      {content}
    </button>
  )

  return (
    <>
      <div className="lg-hud wg-hud">
        <button className="lg-icon" aria-label="Back to menu" onClick={onMenu}>☰</button>
        <span className="lg-title">
          {mode === 'daily' ? 'Daily word' : `Level ${puzzle.level}`}
          {hard && <span className="wg-badge" title="Hard mode">Hard</span>}
        </span>
        <span className="wg-hud-actions">
          <button className="lg-btn small" onClick={hint} disabled={done || hintsLeft === 0} aria-label={`Hint, ${hintsLeft} left`}>💡 {hintsLeft}</button>
          <button className="lg-icon" aria-label="Statistics" onClick={() => onModal('stats')}>📊</button>
          <button className="lg-icon" aria-label="How to play" onClick={() => onModal('tutorial')}>❓</button>
        </span>
      </div>

      <div className="wg-play">
        <p className="wg-msg" aria-hidden="true">{msg ? <span key={msg.id}>{msg.text}</span> : null}</p>

        {given.length > 0 && (
          <p className="wg-given" aria-label={`Hint letters: ${given.map(i => `letter ${i + 1} is ${answer[i].toUpperCase()}`).join(', ')}`}>
            {Array.from({ length: WORD_LENGTH }, (_, i) => (
              <span key={i} className={given.includes(i) ? 'on' : ''} aria-hidden="true">{given.includes(i) ? answer[i] : '·'}</span>
            ))}
          </p>
        )}

        <div className="wg-board" role="group" aria-label={`${TITLE} board, ${rows.length} of ${MAX_GUESSES} guesses used`}>
          {Array.from({ length: MAX_GUESSES }, (_, r) => {
            const row = rows[r]
            const isCurrent = !row && r === rows.length && !done
            const letters = row ? row.word : isCurrent ? current : ''
            const flipping = revealing && r === rows.length - 1
            const winning = status === 'won' && !revealing && r === rows.length - 1
            const cls = `wg-row${isCurrent && shaking ? ' shake' : ''}${winning ? ' win' : ''}`
            return (
              <div key={r} className={cls}>
                {Array.from({ length: WORD_LENGTH }, (_, i) => {
                  const ch = letters[i] || ''
                  const state = row ? row.result[i] : ''
                  const tile = ['wg-tile', ch && 'filled', state, state && (flipping ? 'flip' : 'shown')].filter(Boolean).join(' ')
                  return <div key={i} className={tile} style={{ '--i': i }} aria-hidden="true">{ch}</div>
                })}
                <span className="sr-only">
                  {row && !flipping ? describeRow(r + 1, row) : isCurrent ? `Current guess: ${current.toUpperCase() || 'empty'}` : ''}
                </span>
              </div>
            )
          })}
        </div>

        {done && !showResult ? (
          <div className="wg-endbar">
            <span>The word was <b>{answer.toUpperCase()}</b></span>
            <button className="lg-btn small" onClick={() => set({ showResult: true })}>Results</button>
            {mode === 'campaign' && <button className="lg-btn small wg-primary" onClick={onNext}>Next word →</button>}
          </div>
        ) : (
          <div className="wg-kb" role="group" aria-label="Keyboard">
            {KEY_ROWS.map((row, ri) => (
              <div className="wg-kb-row" key={ri}>
                {ri === 2 && keyButton('enter', 'Enter', 'wide', 'Enter, submit guess')}
                {[...row].map(c => keyButton(c, c, keys[c] || '', keys[c] ? `${c.toUpperCase()}, ${STATE_NAME[keys[c]]}` : c.toUpperCase()))}
                {ri === 2 && keyButton('back', '⌫', 'wide', 'Delete letter')}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sr-only" aria-live="polite">{announcement}</div>

      {showResult && outcome && (
        <div className="lg-overlay wg-result" role="dialog" aria-label={outcome.won ? 'You found the word' : 'Out of guesses'}>
          <h2>{outcome.won ? `${PRAISE[outcome.guesses - 1]} 🎉` : 'Out of guesses'}</h2>
          <p className="wg-result-label">The word was</p>
          <div className="wg-answer" aria-label={answer.toUpperCase()}>
            {[...answer].map((c, i) => <span key={i} className={`wg-tile shown ${outcome.won ? CORRECT : 'reveal'}`} aria-hidden="true">{c}</span>)}
          </div>
          {outcome.won ? (
            <>
              <Stars value={outcome.stars} max={3} size="2em" />
              <p>Solved in <b>{outcome.guesses}</b>/{MAX_GUESSES} · Score <b>{outcome.score}</b>{outcome.newBest && <span className="lg-badge">New best!</span>}</p>
            </>
          ) : (
            <p>{mode === 'daily' ? 'A new daily word arrives tomorrow.' : 'This level still counts. On to the next word!'}</p>
          )}
          <p className="wg-result-streak">🔥 Win streak <b>{outcome.streak}</b></p>
          <div className="lg-overlay-buttons">
            {mode === 'campaign' && <button className="lg-btn big" autoFocus onClick={onNext}>Next word →</button>}
            {mode === 'daily' && <button className="lg-btn big" autoFocus onClick={onNext}>Play levels →</button>}
            <button className="lg-btn" onClick={share}>Share</button>
            <button className="lg-btn" onClick={() => onModal('stats')}>📊 Stats</button>
            <button className="lg-btn ghost" onClick={() => set({ showResult: false })}>See board</button>
            <button className="lg-btn ghost" onClick={onMenu}>Menu</button>
          </div>
        </div>
      )}
    </>
  )
}

function StatsView({ stats }) {
  const top = Math.max(1, ...stats.dist)
  const cells = [
    ['Played', stats.played],
    ['Win %', stats.winPct],
    ['Current streak', stats.streak],
    ['Max streak', stats.maxStreak],
    ['Avg guesses', stats.wins ? stats.average : '–'],
  ]
  return (
    <div className="wg-stats">
      <dl className="wg-stat-grid">
        {cells.map(([name, value]) => (
          <div key={name}><dt>{name}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      <h3>Guess distribution</h3>
      <ol className="wg-dist">
        {stats.dist.map((n, i) => (
          <li key={i}>
            <span className="wg-dist-n">{i + 1}</span>
            <span className="wg-dist-bar" style={{ '--w': `${Math.max(8, (100 * n) / top)}%` }}>{n}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
