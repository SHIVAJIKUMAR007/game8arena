import { useEffect, useRef, useState } from 'react'
import { totalStars, useProgress } from '../../platform/progress'
import { updateSettings, useSettings } from '../../platform/settings'
import { H, W } from './hex'
import { METER_SLOTS, PALETTE, RAINBOW, BOMB } from './logic'
import { GAME_ID, createEngine } from './engine'
import { surgeStore } from './store'
import './BubbleGame.css'

/** The bubble in the HUD preview, drawn with CSS so it needs no canvas. */
function Ball({ value, size = 28 }) {
  const cls = value === RAINBOW ? 'bs-ball rainbow' : value === BOMB ? 'bs-ball bomb' : 'bs-ball'
  const style = { width: size, height: size, '--c': PALETTE[value - 1] }
  return <span className={cls} style={style} aria-hidden="true" />
}

const Icon = {
  soundOn: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  ),
  soundOff: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
      <path d="m17 9 5 6m0-6-5 6" />
    </svg>
  ),
  pause: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1.2" />
      <rect x="14" y="5" width="4" height="14" rx="1.2" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" fill="currentColor">
      <path d="M8 5v14l11-7Z" />
    </svg>
  ),
  crown: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z" fill="#ffd31a" stroke="#c98a00" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9L12 2.5Z" fill="#fff3a8" stroke="#d99a00" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
}

export default function BubbleGame() {
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const engineRef = useRef(null)
  const [ui, setUi] = useState(null)
  const settings = useSettings()
  const progress = useProgress(GAME_ID)

  useEffect(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    const eng = createEngine({ canvas, onUi: setUi, initial: surgeStore.get() })
    engineRef.current = eng

    const fit = () => {
      const w = stage.clientWidth
      const h = stage.clientHeight
      if (!w || !h) return
      const cssW = Math.floor(Math.min(w, (h * W) / H))
      const cssH = Math.floor((cssW * H) / W)
      eng.resize(cssW, cssH, Math.min(2, window.devicePixelRatio || 1))
    }
    fit()
    let ro
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(fit)
      ro.observe(stage)
    }
    eng.start()
    return () => {
      ro?.disconnect()
      eng.destroy()
    }
  }, [])

  const eng = () => engineRef.current
  const onPointerDown = e => {
    if (e.button !== undefined && e.button > 0) return
    try {
      canvasRef.current.setPointerCapture(e.pointerId)
    } catch {
      /* capture is a nicety */
    }
    eng().onDown(e.clientX, e.clientY)
  }
  const onPointerMove = e => eng().onMove(e.clientX, e.clientY)
  const onPointerUp = e => {
    try {
      canvasRef.current.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    eng().onUp(e.clientX, e.clientY)
  }
  const onKeyDown = e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (eng().onKey(e.key)) e.preventDefault()
  }

  const stars = totalStars(progress)
  const pct = ui ? Math.round(ui.progress * 100) : 0

  return (
    <div className="bs-root">
      <div ref={stageRef} className="bs-stage">
        <canvas
          ref={canvasRef}
          className="bs-canvas"
          tabIndex={0}
          role="application"
          aria-label="Bubble Surge. Move the mouse or use the left and right arrow keys to aim, click or press Enter to fire, Space to swap bubbles, P to pause."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {}}
          onKeyDown={onKeyDown}
        />

        {ui?.paused && (
          <div className="bs-overlay" role="dialog" aria-modal="true" aria-label="Paused">
            <div className="bs-card">
              <h2>Paused</h2>
              <button className="bs-btn go" autoFocus onClick={() => eng().pause(false)}>Resume</button>
            </div>
          </div>
        )}

        {ui?.overlay === 'won' && (
          <div className="bs-overlay" role="dialog" aria-modal="true" aria-label="Level complete">
            <div className="bs-card">
              <h2>Level Complete!</h2>
              <p className="bs-stars" aria-label={`${ui.stars} of 3 stars`}>
                {[1, 2, 3].map(n => <span key={n} className={n <= ui.stars ? 'on' : ''}>{Icon.star}</span>)}
              </p>
              <dl>
                <div><dt>Score</dt><dd>{ui.score}</dd></div>
                <div><dt>Shots</dt><dd>{ui.shots}</dd></div>
                <div><dt>Best</dt><dd>{Math.max(progress.highScore, ui.score)}</dd></div>
              </dl>
              <button className="bs-btn go" autoFocus onClick={() => eng().nextLevel()}>Next level</button>
            </div>
          </div>
        )}

        {ui?.overlay === 'over' && (
          <div className="bs-overlay" role="dialog" aria-modal="true" aria-label="Game over">
            <div className="bs-card">
              <h2>Game Over</h2>
              <p className="bs-note">The bubbles reached the shooter.</p>
              <dl>
                <div><dt>Score</dt><dd>{ui.score}</dd></div>
                <div><dt>Level</dt><dd>{ui.level}</dd></div>
                <div><dt>Best</dt><dd>{Math.max(progress.highScore, ui.score)}</dd></div>
              </dl>
              <div className="bs-actions">
                <button className="bs-btn go" autoFocus onClick={() => eng().retry()}>Try again</button>
                <button className="bs-btn ghost" onClick={() => eng().newGame()}>New game</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {ui && (
      <div className="bs-hud">
        <button
          className="bs-round sound"
          aria-label={settings.sound ? 'Mute sound' : 'Turn sound on'}
          aria-pressed={!settings.sound}
          onClick={() => updateSettings({ sound: !settings.sound })}
        >
          {settings.sound ? Icon.soundOn : Icon.soundOff}
        </button>
        <button className="bs-round pause" aria-label={ui.paused ? 'Resume' : 'Pause'} onClick={() => eng().pause(!ui.paused)}>
          {ui.paused ? Icon.play : Icon.pause}
        </button>

        <div className="bs-meter" role="img" aria-label={`Bomb meter ${ui.meter} of ${METER_SLOTS}. Next bubble is shown on the right.`}>
          {Array.from({ length: METER_SLOTS }, (_, i) => <span key={i} className={i < ui.meter ? 'slot on' : 'slot'} />)}
          <button className="bs-next" aria-label="Swap with the next bubble" onClick={() => eng().swap()}>
            <Ball value={ui.next} size={26} />
          </button>
        </div>

        <div className="bs-progress" role="progressbar" aria-label="Field cleared" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <i style={{ width: `${pct}%` }} />
        </div>

        <div className="bs-pill crown" title={`Best ${Math.max(progress.highScore, ui.score)}`}>
          <span className="bs-pico">{Icon.crown}</span>
          <b aria-label={`Score ${ui.score}`}>{ui.score}</b>
        </div>
        <div className="bs-pill star" title="Stars earned">
          <span className="bs-pico">{Icon.star}</span>
          <b aria-label={`${stars} stars earned`}>{stars}</b>
        </div>
        <div className="bs-level" aria-label={`Level ${ui.level}`}>{ui.level}</div>
      </div>
      )}
    </div>
  )
}
