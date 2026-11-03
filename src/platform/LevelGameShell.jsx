// Reusable shell for any level-based game.
//
// The shell owns everything that is NOT game-specific: main menu (continue / new game / level map /
// daily / how-to-play / settings / achievements), lives, hints, undo, restart, stars, score, combo,
// win/lose overlays, extra lives, saving, achievements, sounds, haptics, analytics and sharing.
//
// A game only supplies a <Board> component. The Board receives:
//   level, mode ('campaign' | 'daily'), seed (string: same seed = same puzzle), session
// and talks to the shell through `session`:
//   session.locked            true while an overlay is up / the level is over
//   session.loseLife()        -> remaining lives (shell handles game over)
//   session.restoreLife()     give a life back (undo)
//   session.win()             the level is solved
//   session.noteMove(ok)      report a good/bad move (drives combo, score, stats)
//   session.bindActions({hint, undo})  hint()/undo() must return true when they did something
//   session.setInfo({label, value})    small status text in the HUD (e.g. "Arrows: 12")
//   session.announce(text)    screen-reader announcement
//
// Optional config.endless(level, mode) -> true makes that level endless: the Board never calls win(); the
// run ends when lives run out, and the score is saved as the personal high score.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getProgress, totalStars, updateProgress, useProgress } from './progress'
import { completeDaily, dailyState, dailySeed } from './daily'
import { checkAchievements } from './achievements'
import { playSound } from './sound'
import { vibrate } from './haptics'
import { track } from './analytics'
import { shareResult } from './share'
import { canShowRewardedAd, showRewardedAd } from './ads'
import SettingsModal from './ui/SettingsModal'
import Tutorial from './ui/Tutorial'
import LevelSelect from './ui/LevelSelect'
import Modal from './ui/Modal'
import Stars from './ui/Stars'
import './platform.css'

const MAX_BANKED_LIVES = 2

export default function LevelGameShell({ gameId, title, config, Board, initialMode }) {
  const {
    maxLives = 3, hints: hintCap = 3, undos: undoCap = 3,
    tutorial = [], achievements = [], daily = false, dailyLevel = 15, endless,
  } = config

  const progress = useProgress(gameId)
  const [screen, setScreen] = useState('menu') // menu | levels | play
  const [mode, setMode] = useState('campaign')
  const [level, setLevel] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [lives, setLives] = useState(maxLives)
  const [hints, setHints] = useState(hintCap)
  const [undos, setUndos] = useState(undoCap)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [result, setResult] = useState(null) // null | 'won' | 'lost'
  const [outcome, setOutcome] = useState(null)
  const [info, setInfo] = useState(null)
  const [announcement, setAnnouncement] = useState('')
  const [modal, setModal] = useState(null) // settings | tutorial | achievements
  const [adBusy, setAdBusy] = useState(false)

  // Mutable game-session values (don't need to trigger renders).
  const run = useRef({ lives: maxLives, locked: false, combo: 0, bestCombo: 0, score: 0, level: 1, mode: 'campaign', actions: {}, timers: [] })

  const session = useMemo(() => {
    const r = run.current
    const later = (fn, ms) => r.timers.push(setTimeout(fn, ms))

    const finishWin = () => {
      const stars = Math.max(1, r.lives)
      const bonus = 100 * stars
      const total = r.score + bonus
      r.score = total
      setScore(total)
      const flawless = stars >= maxLives
      const before = getProgress(gameId)
      const newBest = total > before.highScore

      if (r.mode === 'daily') completeDaily(gameId, { stars, score: total })
      updateProgress(gameId, p => ({
        ...p,
        stars: r.mode === 'daily' ? p.stars : { ...p.stars, [r.level]: Math.max(p.stars[r.level] || 0, stars) },
        best: r.mode === 'daily' ? p.best : Math.max(p.best, r.level),
        level: r.mode === 'daily' ? p.level : Math.max(p.level, r.level + 1),
        highScore: Math.max(p.highScore, total),
        extraLives: flawless && r.mode === 'campaign' ? Math.min(MAX_BANKED_LIVES, p.extraLives + 1) : p.extraLives,
        stats: {
          ...p.stats,
          cleared: p.stats.cleared + 1,
          flawless: p.stats.flawless + (flawless ? 1 : 0),
          bestCombo: Math.max(p.stats.bestCombo, r.bestCombo),
        },
      }))
      checkAchievements(gameId, achievements, { level: r.level, stars, mode: r.mode, flawless })
      setOutcome({ stars, bonus, total, flawless, newBest, streak: getProgress(gameId).daily.streak })
      setResult('won')
      playSound('win')
      vibrate([60, 40, 60])
      setAnnouncement(`Level cleared with ${stars} stars. Score ${total}.`)
      track('level_win', { game: gameId, level: r.level, mode: r.mode, stars, score: total })
    }

    const finishRun = () => {
      const before = getProgress(gameId)
      updateProgress(gameId, p => ({
        ...p,
        level: Math.max(p.level, r.level),
        highScore: Math.max(p.highScore, r.score),
        stats: { ...p.stats, bestCombo: Math.max(p.stats.bestCombo, r.bestCombo) },
      }))
      setOutcome({ total: r.score, newBest: r.score > before.highScore, endless: true })
      setResult('ended')
      playSound('lose')
      vibrate(200)
      setAnnouncement(`Run over. Score ${r.score}.`)
      track('run_end', { game: gameId, level: r.level, score: r.score })
    }

    const finishLose = () => {
      if (r.endless) return finishRun()
      setResult('lost')
      playSound('lose')
      vibrate(200)
      setAnnouncement('Out of lives.')
      track('level_fail', { game: gameId, level: r.level, mode: r.mode })
    }

    return {
      get locked() { return r.locked },
      loseLife() {
        const next = r.lives - 1
        r.lives = next
        setLives(next)
        r.combo = 0
        setCombo(0)
        updateProgress(gameId, p => ({ ...p, stats: { ...p.stats, blocked: p.stats.blocked + 1 } }))
        playSound('blocked')
        vibrate(80)
        setAnnouncement(`Blocked! ${Math.max(next, 0)} lives left.`)
        if (next <= 0) {
          r.locked = true
          later(finishLose, 450)
        }
        return next
      },
      restoreLife() {
        r.lives = Math.min(maxLives, r.lives + 1)
        setLives(r.lives)
      },
      win() {
        if (r.locked) return
        r.locked = true
        later(finishWin, 300)
      },
      noteMove(ok) {
        if (!ok) { r.combo = 0; setCombo(0); return }
        r.combo += 1
        r.bestCombo = Math.max(r.bestCombo, r.combo)
        r.score += 10 * Math.min(r.combo, 10)
        setScore(r.score)
        setCombo(r.combo)
        playSound('combo', r.combo)
        updateProgress(gameId, p => ({
          ...p,
          highScore: r.endless ? Math.max(p.highScore, r.score) : p.highScore, // endless: always keep the best
          stats: { ...p.stats, launches: p.stats.launches + 1, bestCombo: Math.max(p.stats.bestCombo, r.combo) },
        }))
        checkAchievements(gameId, achievements, { level: r.level, mode: r.mode, combo: r.combo })
      },
      bindActions(actions) { r.actions = actions },
      setInfo,
      announce: setAnnouncement,
      _clear() { r.timers.forEach(clearTimeout); r.timers = [] },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId])

  useEffect(() => () => session._clear(), [session])

  const startLevel = useCallback((lvl, m = 'campaign') => {
    session._clear()
    Object.assign(run.current, { lives: maxLives, locked: false, combo: 0, bestCombo: 0, score: 0, level: lvl, mode: m, actions: {}, endless: Boolean(endless?.(lvl, m)) })
    setMode(m); setLevel(lvl)
    setLives(maxLives); setHints(hintCap); setUndos(undoCap)
    setScore(0); setCombo(0); setResult(null); setOutcome(null); setInfo(null)
    setAttempt(a => a + 1)
    setScreen('play')
    track('level_start', { game: gameId, level: lvl, mode: m })
    if (m === 'campaign' && lvl === 1 && tutorial.length && !getProgress(gameId).tutorialSeen) setModal('tutorial')
  }, [session, maxLives, hintCap, undoCap, gameId, tutorial.length, endless])

  useEffect(() => { track('game_open', { game: gameId }) }, [gameId])
  useEffect(() => {
    if (initialMode === 'daily' && daily) startLevel(dailyLevel, 'daily')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode])

  const closeTutorial = () => {
    updateProgress(gameId, p => (p.tutorialSeen ? p : { ...p, tutorialSeen: true }))
    setModal(null)
  }

  const onHint = () => {
    if (hints <= 0 || run.current.locked || result) return
    if (run.current.actions.hint?.()) {
      setHints(h => h - 1)
      playSound('hint')
      updateProgress(gameId, p => ({ ...p, stats: { ...p.stats, hints: p.stats.hints + 1 } }))
      track('hint_used', { game: gameId, level })
    }
  }
  const onUndo = () => {
    if (undos <= 0 || run.current.locked || result) return
    if (run.current.actions.undo?.()) {
      setUndos(u => u - 1)
      playSound('undo')
    }
  }

  const resumeWithLife = () => {
    run.current.lives = 1
    run.current.locked = false
    setLives(1)
    setResult(null)
  }
  const onBankedLife = () => {
    if (progress.extraLives <= 0) return
    updateProgress(gameId, p => ({ ...p, extraLives: p.extraLives - 1 }))
    resumeWithLife()
  }
  const watchAd = async () => {
    setAdBusy(true)
    const ok = await showRewardedAd()
    setAdBusy(false)
    if (ok) resumeWithLife()
  }

  const share = () => {
    const stars = '★'.repeat(outcome.stars) + '☆'.repeat(maxLives - outcome.stars)
    const text = mode === 'daily'
      ? `${title} daily ${dailySeed(gameId).split(':').pop()}: ${stars} · ${outcome.total} pts · 🔥${outcome.streak}-day streak`
      : `I cleared ${title} level ${level} ${stars} · ${outcome.total} pts`
    shareResult({ title, text, url: window.location.origin + window.location.pathname })
  }

  const seed = mode === 'daily' ? dailySeed(gameId) : `${gameId}:L${level}`
  const ds = dailyState(progress)
  const hasProgress = progress.level > 1 || progress.best > 0
  const unlockedCount = Object.keys(progress.achievements).length

  /* ───────────── Menu ───────────── */
  if (screen === 'menu') {
    return (
      <div className="lg-root lg-menu">
        <h1>{title}</h1>
        <div className="lg-menu-stats">
          <span>Best level <b>{progress.best}</b></span>
          <span>Stars <b>{totalStars(progress)}</b></span>
          <span>High score <b>{progress.highScore}</b></span>
          {progress.extraLives > 0 && <span>Extra lives <b>{progress.extraLives}</b></span>}
        </div>
        <div className="lg-menu-buttons">
          <button className="lg-btn big" onClick={() => startLevel(progress.level)}>
            {hasProgress ? `▶ Continue — Level ${progress.level}` : '▶ Play'}
          </button>
          {daily && (
            <button className="lg-btn" onClick={() => startLevel(dailyLevel, 'daily')}>
              📅 Daily challenge {ds.done ? '✓ (replay)' : ''} {ds.streak > 0 && `· 🔥${ds.streak}`}
            </button>
          )}
          <button className="lg-btn" onClick={() => setScreen('levels')}>🗺️ Level map</button>
          {hasProgress && (
            <button
              className="lg-btn ghost"
              onClick={() => window.confirm('Start again from level 1? Your stars and best level are kept.') && startLevel(1)}
            >
              New game
            </button>
          )}
          <div className="lg-menu-row">
            {tutorial.length > 0 && <button className="lg-btn ghost" onClick={() => setModal('tutorial')}>❓ How to play</button>}
            {achievements.length > 0 && (
              <button className="lg-btn ghost" onClick={() => setModal('achievements')}>
                🏆 {unlockedCount}/{achievements.length}
              </button>
            )}
            <button className="lg-btn ghost" onClick={() => setModal('settings')}>⚙️ Settings</button>
          </div>
        </div>
        {renderModals()}
      </div>
    )
  }

  /* ───────────── Level map ───────────── */
  if (screen === 'levels') {
    return (
      <div className="lg-root">
        <LevelSelect
          best={progress.best} stars={progress.stars} maxStars={maxLives}
          onPick={lvl => startLevel(lvl)} onBack={() => setScreen('menu')}
        />
      </div>
    )
  }

  /* ───────────── Playing ───────────── */
  return (
    <div className="lg-root">
      <div className="lg-hud">
        <button className="lg-icon" aria-label="Back to menu" onClick={() => { session._clear(); setScreen('menu') }}>☰</button>
        <span className="lg-lives" role="img" aria-label={`${Math.max(lives, 0)} of ${maxLives} lives left`}>
          {Array.from({ length: maxLives }, (_, i) => (
            <span key={i} className={i < lives ? 'on' : 'off'}>💧</span>
          ))}
        </span>
        <span className="lg-title">{mode === 'daily' ? 'Daily challenge' : endless?.(level, mode) ? `Level ${level} · Endless` : `Level ${level}`}</span>
        <span className="lg-score">
          ★ {score}
          {combo >= 2 && <b className="lg-combo"> 🔥×{combo}</b>}
        </span>
        <span className="lg-info">{info ? `${info.label}: ${info.value}` : ''}</span>
      </div>

      <div className="lg-board">
        <Board key={`${mode}-${level}-${attempt}`} level={level} mode={mode} seed={seed} session={session} />
      </div>

      <div className="lg-toolbar">
        <button className="lg-btn small" onClick={onHint} disabled={hints <= 0 || !!result} aria-label={`Hint, ${hints} left`}>💡 Hint {hints}</button>
        <button className="lg-btn small" onClick={onUndo} disabled={undos <= 0 || !!result} aria-label={`Undo, ${undos} left`}>↶ Undo {undos}</button>
        <button className="lg-btn small" onClick={() => startLevel(level, mode)}>⟳ Restart</button>
      </div>

      <div className="sr-only" aria-live="polite">{announcement}</div>

      {result === 'won' && outcome && (
        <div className="lg-overlay">
          <h2>{mode === 'daily' ? 'Daily challenge complete! 🎉' : `Level ${level} cleared! 🎉`}</h2>
          <Stars value={outcome.stars} max={maxLives} size="2.2em" />
          <p>Score <b>{outcome.total}</b> {outcome.newBest && <span className="lg-badge">New best!</span>}</p>
          {outcome.flawless && mode === 'campaign' && <p>Flawless — extra life banked 💧</p>}
          {mode === 'daily' && <p>🔥 {outcome.streak}-day streak</p>}
          <div className="lg-overlay-buttons">
            {mode === 'campaign' && <button className="lg-btn big" autoFocus onClick={() => startLevel(level + 1)}>Next level →</button>}
            <button className="lg-btn" onClick={share}>Share</button>
            <button className="lg-btn ghost" onClick={() => setScreen('levels')}>Level map</button>
            <button className="lg-btn ghost" onClick={() => setScreen('menu')}>Menu</button>
          </div>
        </div>
      )}

      {result === 'ended' && outcome && (
        <div className="lg-overlay">
          <h2>Run over 🏁</h2>
          <p>Score <b>{outcome.total}</b> {outcome.newBest && <span className="lg-badge">New high score!</span>}</p>
          <p>High score <b>{progress.highScore}</b></p>
          <div className="lg-overlay-buttons">
            {progress.extraLives > 0 && (
              <button className="lg-btn" onClick={onBankedLife}>Use extra life 💧 ({progress.extraLives})</button>
            )}
            {canShowRewardedAd() && (
              <button className="lg-btn" disabled={adBusy} onClick={watchAd}>📺 Watch an ad for +1 life</button>
            )}
            <button className="lg-btn big" autoFocus onClick={() => startLevel(level, mode)}>Play again</button>
            <button className="lg-btn" onClick={() => shareResult({ title, text: `I scored ${outcome.total} in ${title} endless mode`, url: window.location.origin + window.location.pathname })}>Share</button>
            <button className="lg-btn ghost" onClick={() => setScreen('menu')}>Menu</button>
          </div>
        </div>
      )}

      {result === 'lost' && (
        <div className="lg-overlay">
          <h2>Out of lives 💔</h2>
          <div className="lg-overlay-buttons">
            {progress.extraLives > 0 && (
              <button className="lg-btn big" onClick={onBankedLife}>Use extra life 💧 ({progress.extraLives})</button>
            )}
            {canShowRewardedAd() && (
              <button className="lg-btn" disabled={adBusy} onClick={watchAd}>📺 Watch an ad for +1 life</button>
            )}
            <button className="lg-btn" autoFocus onClick={() => startLevel(level, mode)}>Retry level</button>
            <button className="lg-btn ghost" onClick={() => setScreen('menu')}>Menu</button>
          </div>
        </div>
      )}

      {renderModals()}
    </div>
  )

  function renderModals() {
    return (
      <>
        {modal === 'settings' && <SettingsModal onClose={() => setModal(null)} />}
        {modal === 'tutorial' && <Tutorial steps={tutorial} onClose={closeTutorial} />}
        {modal === 'achievements' && (
          <Modal title="Achievements" onClose={() => setModal(null)}>
            <ul className="ach-list">
              {achievements.map(a => {
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
  }
}
