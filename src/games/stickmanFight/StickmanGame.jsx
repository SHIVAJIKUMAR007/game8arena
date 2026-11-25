// Stickman Fight: the container that moves between menus and the fight, plus the in-fight HUD, touch buttons and
// result screens. Rules live in sim.js, drawing in render.js and the loop in engine.js.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { track } from '../../platform/analytics'
import { updateProgress } from '../../platform/progress'
import { useSettings } from '../../platform/settings'
import { Customize, LevelSelect, MainMenu, SettingsPanel, VersusSetup } from './Screens'
import { music, sfx, unlockAudio } from './audio'
import { ARENA_ORDER, ARENAS, H, WEAPONS, W, colorHex } from './data'
import { createEngine } from './engine'
import { generateLevel, getHint, levelSeed, rewardFor } from './levels'
import { MATCH_TIME } from './sim'
import { GAME_ID, applyVictory, getStick, loadoutOf, starsFor, updateStick, useStick } from './store'
import './StickmanGame.css'

const randomArena = () => ({ arenaId: ARENA_ORDER[Math.floor(Math.random() * ARENA_ORDER.length)], variant: Math.floor(Math.random() * 2) })

// ───────────── HUD ─────────────
function PlayerBar({ p, side, hint }) {
  const pct = Math.max(0, Math.round((p.hp / p.hpMax) * 100))
  const ready = p.cd <= 0
  const fill = p.cdMax ? Math.round((1 - p.cd / p.cdMax) * 100) : 100
  return (
    <div className={`sf-pbar ${side}`}>
      <div className="sf-pname">
        <i style={{ background: colorHex(p.color) }} aria-hidden="true" />
        <span>{p.name}</span>
        {p.isAI ? <em>CPU</em> : null}
      </div>
      <div className="sf-hp" role="progressbar" aria-label={`${p.name} health`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <b className="ghost" style={{ width: `${pct}%` }} />
        <b className="now" style={{ width: `${pct}%` }} />
        <span>{Math.ceil(p.hp)}</span>
      </div>
      <div className="sf-guard" aria-hidden="true"><i style={{ width: `${Math.round(p.guard)}%` }} /></div>
      <div
        className={`sf-skill${ready ? ' ready' : ''}`}
        style={{ '--fill': `${fill}%` }}
        role="img"
        aria-label={`${p.special}: ${ready ? 'ready' : `${Math.ceil(p.cd)} seconds`}`}
        title={p.special}
      >
        <span>{ready ? '★' : Math.ceil(p.cd)}</span>
        {hint ? <kbd>{hint}</kbd> : null}
      </div>
    </div>
  )
}

function TouchBtn({ eng, player, action, children, label, cls = '' }) {
  const set = on => eng.current?.setTouch(player, action, on)
  return (
    <button
      className={`sf-t ${cls}`}
      aria-label={label}
      onPointerDown={e => {
        e.preventDefault()
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* capture is a nicety */ }
        set(true)
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onLostPointerCapture={() => set(false)}
      onContextMenu={e => e.preventDefault()}
    >
      {children}
    </button>
  )
}

function TouchPad({ eng, player, side, parts = 'both' }) {
  return (
    <div className={`sf-pad ${side} ${parts}`}>
      {parts !== 'ac' ? (
        <div className="mv">
          <TouchBtn eng={eng} player={player} action="left" label={`Move left${player ? ' (player 2)' : ''}`}>◀</TouchBtn>
          <TouchBtn eng={eng} player={player} action="right" label={`Move right${player ? ' (player 2)' : ''}`}>▶</TouchBtn>
        </div>
      ) : null}
      {parts !== 'mv' ? (
        <div className="ac">
          <TouchBtn eng={eng} player={player} action="jump" label="Jump" cls="jump">⤒</TouchBtn>
          <TouchBtn eng={eng} player={player} action="attack" label="Attack" cls="atk">⚔</TouchBtn>
          <TouchBtn eng={eng} player={player} action="block" label="Block" cls="blk">🛡</TouchBtn>
          <TouchBtn eng={eng} player={player} action="special" label="Special" cls="spc">★</TouchBtn>
        </div>
      ) : null}
    </div>
  )
}

// ───────────── a fight ─────────────
function MatchView({ config, level, onExit, onNext, onReplay, onSetup }) {
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const engRef = useRef(null)
  const [ui, setUi] = useState(null)
  const [result, setResult] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const save = useStick()
  const single = config.mode === 'single'
  const ls = useMemo(() => (single ? generateLevel(levelSeed(level), { level }) : null), [single, level])

  const finish = useCallback(
    r => {
      const st = getStick()
      if (single) {
        const won = r.winner === 0
        if (!won) {
          sfx('lose')
          setResult({ kind: 'lose', reason: r.reason, level })
          track('stickman_lose', { level })
          return
        }
        const stars = starsFor(r.hp[0], r.hpMax[0])
        const first = !st.stars[level]
        const coins = rewardFor(level, stars, first)
        const score = Math.round(r.hp[0] * 10 + Math.max(0, MATCH_TIME - r.time) * 5 + level * 100)
        updateStick(s => applyVictory(s, level, stars, coins))
        updateProgress(GAME_ID, p => ({
          ...p,
          best: Math.max(p.best, level),
          level: Math.max(p.level, level + 1),
          stars: { ...p.stars, [level]: Math.max(p.stars[level] || 0, stars) },
          highScore: Math.max(p.highScore, score),
        }))
        sfx('win')
        setTimeout(() => sfx('coin'), 500)
        setResult({ kind: 'win', stars, coins, score, level, first })
        track('stickman_win', { level, stars })
      } else {
        if (r.winner >= 0) updateStick(s => ({ ...s, wins: { ...s.wins, [r.winner === 0 ? 'p1' : 'p2']: s.wins[r.winner === 0 ? 'p1' : 'p2'] + 1 } }))
        sfx(r.winner >= 0 ? 'win' : 'back')
        setResult({ kind: r.winner < 0 ? 'draw' : 'versus', winner: r.winner, reason: r.reason })
      }
    },
    [single, level],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    const eng = createEngine({ canvas, config, onUi: setUi, onEnd: finish })
    engRef.current = eng
    const fit = () => {
      const w = stage.clientWidth
      const h = stage.clientHeight
      if (!w || !h) return
      const cssW = Math.floor(Math.min(w, (h * W) / H))
      eng.resize(cssW, Math.floor((cssW * H) / W), Math.min(2, window.devicePixelRatio || 1))
    }
    fit()
    let ro
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(fit)
      ro.observe(stage)
    }
    const kd = e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const inField = e.target instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)
      if (inField && e.code !== 'Escape') return
      if (e.repeat && (e.code === 'Escape' || e.code === 'KeyP')) {
        e.preventDefault()
        return
      }
      if (eng.key(e.code, true)) e.preventDefault()
    }
    const ku = e => {
      eng.key(e.code, false)
    }
    const pause = () => eng.pause(true)
    const vis = () => document.hidden && eng.pause(true)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    window.addEventListener('blur', pause)
    document.addEventListener('visibilitychange', vis)
    eng.start()
    return () => {
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      window.removeEventListener('blur', pause)
      document.removeEventListener('visibilitychange', vis)
      ro?.disconnect()
      eng.destroy()
    }
  }, [config, finish])

  const eng = () => engRef.current
  const [a, b] = ui ? ui.players : []
  const phase = ui?.phase
  const paused = Boolean(ui?.paused)

  return (
    <div className="sf-match" style={{ '--arena-a': ARENAS[config.arenaId].sky[0], '--arena-b': ARENAS[config.arenaId].sky[1] }}>
      <div ref={stageRef} className="sf-stage">
        <canvas
          ref={canvasRef}
          className="sf-canvas"
          role="img"
          aria-label={`Fight in the ${ARENAS[config.arenaId].name}. ${single ? 'Move with A and D or the arrow keys, W to jump, F to attack, S to block, G for your special.' : 'Player 1 uses A, D, W, S, F and G. Player 2 uses the arrow keys, K and L.'} P pauses.`}
        />
        {ui ? (
          <div className="sf-hud">
            <PlayerBar p={a} side="l" hint="G" />
            <div className="sf-center">
              <span className="lv">{single ? `LEVEL ${level}` : 'VS'}</span>
              <span className="tm" aria-label={`${ui.timeLeft} seconds left`}>{ui.timeLeft}</span>
            </div>
            <PlayerBar p={b} side="r" hint={single ? '' : 'L'} />
            <button className="sf-pause" aria-label={paused ? 'Resume' : 'Pause'} onClick={() => { unlockAudio(); eng().pause(!paused) }}>
              {paused ? '▶' : '❚❚'}
            </button>
          </div>
        ) : null}

        {phase === 'intro' && ls ? (
          <div className="sf-intro" aria-live="polite">
            <b>{ls.enemy.name}</b>
            <span>{WEAPONS[ls.enemy.weapon].icon} {WEAPONS[ls.enemy.weapon].name} · {ARENAS[ls.arenaId].name}</span>
            <em>{getHint(ls)}</em>
          </div>
        ) : null}
        {phase === 'intro' && !single ? (
          <div className="sf-intro"><span>{ARENAS[config.arenaId].name} · {ARENAS[config.arenaId].hazard}</span></div>
        ) : null}

        {ui && phase !== 'over' ? (
          <div className="sf-touch" aria-label="Touch controls">
            {single ? (
              <>
                <TouchPad eng={engRef} player={0} side="l" parts="mv" />
                <TouchPad eng={engRef} player={0} side="r" parts="ac" />
              </>
            ) : (
              <>
                <TouchPad eng={engRef} player={0} side="l" />
                <TouchPad eng={engRef} player={1} side="r" />
              </>
            )}
          </div>
        ) : null}

        {paused && !result ? (
          <div className="sf-overlay" role="dialog" aria-modal="true" aria-label="Paused">
            <div className="sf-card-box">
              <h2>Paused</h2>
              {showSettings ? (
                <SettingsPanel save={save} onClose={() => setShowSettings(false)} />
              ) : (
                <div className="sf-stack">
                  <button className="sf-btn green" autoFocus onClick={() => eng().pause(false)}>Resume</button>
                  <button className="sf-btn" onClick={onReplay}>Restart</button>
                  <button className="sf-btn" onClick={() => setShowSettings(true)}>Sound &amp; settings</button>
                  <button className="sf-btn" onClick={onExit}>Quit to menu</button>
                </div>
              )}
              <p className="sf-tip">{single ? 'W/A/D move and jump, S block, F attack, G special. Esc or P pauses.' : 'P1: A D W S F G. P2: arrows, K, L. Esc or P pauses.'}</p>
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="sf-overlay" role="dialog" aria-modal="true" aria-label={result.kind === 'win' ? 'Victory' : result.kind === 'lose' ? 'Defeat' : 'Match over'}>
            <div className={`sf-card-box ${result.kind}`}>
              {result.kind === 'win' ? (
                <>
                  <h2>Victory!</h2>
                  <p className="sf-stars" aria-label={`${result.stars} of 3 stars`}>
                    {[1, 2, 3].map(n => <span key={n} className={n <= result.stars ? 'on' : ''}>★</span>)}
                  </p>
                  <dl>
                    <div><dt>Coins</dt><dd>+{result.coins}</dd></div>
                    <div><dt>Score</dt><dd>{result.score}</dd></div>
                    <div><dt>Health left</dt><dd>{Math.ceil(a ? a.hp : 0)}</dd></div>
                  </dl>
                  {!result.first ? <p className="sf-tip">Replays pay less. Beat new levels for full coins.</p> : null}
                  <div className="sf-stack">
                    <button className="sf-btn green" autoFocus onClick={() => onNext(result.level + 1)}>Next level</button>
                    <button className="sf-btn" onClick={onReplay}>Replay</button>
                    <button className="sf-btn" onClick={onExit}>Menu</button>
                  </div>
                </>
              ) : result.kind === 'lose' ? (
                <>
                  <h2>Defeat</h2>
                  <p className="sf-tip">{result.reason === 'time' ? 'Time ran out with your opponent ahead.' : 'You were knocked out.'} {ls ? getHint(ls) : ''}</p>
                  <div className="sf-stack">
                    <button className="sf-btn green" autoFocus onClick={onReplay}>Try again</button>
                    <button className="sf-btn" onClick={() => onExit('custom')}>Spend coins ({save.coins})</button>
                    <button className="sf-btn" onClick={onExit}>Menu</button>
                  </div>
                </>
              ) : (
                <>
                  <h2>{result.kind === 'draw' ? 'Draw!' : `Player ${result.winner + 1} wins!`}</h2>
                  <p className="sf-tip">
                    {result.reason === 'time' ? 'Time ran out.' : 'Knockout!'} Series: P1 {save.wins.p1} - {save.wins.p2} P2
                  </p>
                  <div className="sf-stack">
                    <button className="sf-btn green" autoFocus onClick={onReplay}>Rematch</button>
                    <button className="sf-btn" onClick={onSetup}>Change fighters</button>
                    <button className="sf-btn" onClick={onExit}>Menu</button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ───────────── container ─────────────
export default function StickmanGame({ initialMode }) {
  const save = useStick()
  const settings = useSettings()
  const [screen, setScreen] = useState(initialMode === 'versus' ? 'versus' : 'menu') // ?mode=versus opens 2 Player
  const [tab, setTab] = useState('weapon')
  const [showSettings, setShowSettings] = useState(false)
  const [match, setMatch] = useState(null) // { id, config, level }
  const [armed, setArmed] = useState(false)
  const lastSetup = useRef(null)

  const arm = useCallback(() => {
    if (!armed) setArmed(true)
    unlockAudio()
  }, [armed])

  // Music starts after the first tap or key (browsers block sound before that) and follows the toggles.
  useEffect(() => {
    music.setEnabled(save.music)
    if (armed && settings.sound && save.music) music.start()
    else music.stop()
    return () => music.stop()
  }, [armed, settings.sound, save.music])

  const launch = useCallback((config, level) => {
    setMatch(m => ({ id: (m ? m.id : 0) + 1, config, level }))
    setScreen('match')
  }, [])

  const playSingle = useCallback(
    n => {
      const st = getStick()
      const lv = Math.max(1, Math.min(n, st.best + 1))
      const ls = generateLevel(levelSeed(lv), { level: lv })
      const me = { ...loadoutOf(st), name: 'You', hpMax: 100, dmgMult: 1 }
      launch({ mode: 'single', arenaId: ls.arenaId, variant: ls.variant, skill: ls.enemy.skill, seed: ls.id, fighters: [me, { ...ls.enemy }] }, lv)
      track('stickman_start', { level: lv })
    },
    [launch],
  )

  const startVersus = useCallback(
    setup => {
      lastSetup.current = setup
      const pick = setup.arena === 'random' ? randomArena() : { arenaId: setup.arena, variant: Math.floor(Math.random() * 2) }
      launch({ mode: 'versus', ...pick, fighters: setup.players }, 0)
      track('stickman_versus', { arena: setup.arena })
    },
    [launch],
  )

  const go = (s, t) => {
    if (t) setTab(t)
    setScreen(s)
  }
  const replay = () => {
    if (!match) return
    if (match.config.mode === 'single') playSingle(match.level)
    else startVersus(lastSetup.current || { players: match.config.fighters, arena: match.config.arenaId })
  }
  const exit = to => {
    if (typeof to === 'string') go(to, 'weapon')
    else setScreen('menu')
    setMatch(null)
  }

  return (
    <div className="sf-root" onPointerDown={arm} onKeyDown={arm}>
      {screen === 'menu' ? <MainMenu save={save} go={go} playSingle={playSingle} onSettings={() => setShowSettings(true)} /> : null}
      {screen === 'levels' ? <LevelSelect save={save} onBack={() => setScreen('menu')} playSingle={playSingle} onSettings={() => setShowSettings(true)} /> : null}
      {screen === 'custom' ? <Customize save={save} tab={tab} onBack={() => setScreen('menu')} onSettings={() => setShowSettings(true)} /> : null}
      {screen === 'versus' ? <VersusSetup save={save} onBack={() => setScreen('menu')} start={startVersus} onSettings={() => setShowSettings(true)} /> : null}
      {screen === 'match' && match ? (
        <MatchView
          key={match.id}
          config={match.config}
          level={match.level}
          onExit={exit}
          onNext={playSingle}
          onReplay={replay}
          onSetup={() => { setMatch(null); setScreen('versus') }}
        />
      ) : null}

      {showSettings ? (
        <div className="sf-overlay" role="dialog" aria-modal="true" aria-label="Settings">
          <div className="sf-card-box">
            <h2>Settings</h2>
            <SettingsPanel save={save} onClose={() => setShowSettings(false)} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

