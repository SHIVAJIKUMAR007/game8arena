// The fight screen: the canvas the engine draws on, the HUD around it and the on-screen touch controls. The engine
// (engine/game.js) is created and started in an effect and disposed in its cleanup, so a StrictMode double-mount
// just builds a second one. Per-frame state never reaches React: the engine pushes HUD values about 15 times a second.
import { useEffect, useRef, useState } from 'react'
import { createGame } from './engine/game'
import { INPUT, W, H } from './engine/sim'
import { Icon, Portrait } from './ui'
import { fighterById } from './roster'

const EMPTY = { phase: 'intro', round: 1, timer: 60, hp: [1, 1], hpMax: [1, 1], en: [0, 0], wins: [0, 0], combo: 0, banner: '', paused: false, ping: null, lost: 0, waiting: false }

function PlayerPanel({ side, id, name, hp, hpMax, en, wins }) {
  const pct = Math.max(0, Math.min(100, (hp / hpMax) * 100))
  const epct = Math.max(0, Math.min(100, en))
  return (
    <div className={`mvf-pp ${side}`}>
      <Portrait id={id} size={64} className="mvf-pp-face" />
      <div className="mvf-pp-body">
        <span className="mvf-pp-name">{name}</span>
        <div className="mvf-hp" role="progressbar" aria-label={`${name} health`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <i className="chip" style={{ width: `${pct}%` }} />
          <i className="now" style={{ width: `${pct}%` }} />
        </div>
        <div className={`mvf-en${epct >= 100 ? ' full' : ''}`} role="progressbar" aria-label={`${name} special energy`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(epct)}>
          <i style={{ width: `${epct}%` }} />
        </div>
        <div className="mvf-pips2" aria-label={`${wins} round${wins === 1 ? '' : 's'} won`}>
          {[0, 1].map(i => <b key={i} className={i < wins ? 'on' : ''} />)}
        </div>
      </div>
    </div>
  )
}

/** One pointer-driven button. Pointer capture keeps the press alive while the finger slides, and each button tracks
 *  its own pointer so several can be held at once. */
function TouchButton({ gameRef, bit, letter, icon, className = '', label }) {
  const [down, setDown] = useState(false)
  const set = on => {
    gameRef.current?.setTouch(bit, on)
    setDown(on)
  }
  return (
    <button
      type="button"
      className={`mvf-tb ${className}${down ? ' down' : ''}`}
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
      <Icon name={icon} />
      <kbd>{letter}</kbd>
    </button>
  )
}

/** The W/A/S/D circle. One pointer steers it; the stick position maps to the four direction bits, diagonals included. */
function DPad({ gameRef }) {
  const ref = useRef(null)
  const bits = useRef(0)
  const [knob, setKnob] = useState({ x: 0, y: 0 })

  const apply = next => {
    const prev = bits.current
    if (next === prev) return
    for (const b of [INPUT.LEFT, INPUT.RIGHT, INPUT.UP, INPUT.DOWN]) {
      if ((next & b) !== (prev & b)) gameRef.current?.setTouch(b, Boolean(next & b))
    }
    bits.current = next
  }
  const move = e => {
    const r = ref.current.getBoundingClientRect()
    const rad = r.width / 2
    let dx = (e.clientX - (r.left + rad)) / rad
    let dy = (e.clientY - (r.top + rad)) / rad
    const len = Math.hypot(dx, dy)
    if (len > 1) {
      dx /= len
      dy /= len
    }
    setKnob({ x: dx, y: dy })
    let m = 0
    if (dx < -0.32) m |= INPUT.LEFT
    if (dx > 0.32) m |= INPUT.RIGHT
    if (dy < -0.32) m |= INPUT.UP
    if (dy > 0.32) m |= INPUT.DOWN
    apply(m)
  }
  const release = () => {
    apply(0)
    setKnob({ x: 0, y: 0 })
  }
  return (
    <div
      ref={ref}
      className="mvf-dpad"
      role="group"
      aria-label="Movement pad: W jump, A left, S crouch and block, D right"
      onPointerDown={e => {
        e.preventDefault()
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* capture is a nicety */ }
        move(e)
      }}
      onPointerMove={e => e.buttons && move(e)}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={e => e.preventDefault()}
    >
      <b className="w">W</b>
      <b className="a">A</b>
      <b className="s">S</b>
      <b className="d">D</b>
      <span className="mvf-knob" style={{ transform: `translate(${knob.x * 34}%, ${knob.y * 34}%)` }} />
    </div>
  )
}

export default function FightScreen({ match, onEnd, onQuit }) {
  const canvasRef = useRef(null)
  const gameRef = useRef(null)
  const endRef = useRef(onEnd)
  const [hud, setHud] = useState(EMPTY)

  useEffect(() => {
    endRef.current = onEnd
  })

  useEffect(() => {
    const game = createGame({
      canvas: canvasRef.current,
      mode: match.mode,
      chars: match.chars,
      stats: match.stats,
      seed: match.seed,
      level: match.level,
      me: match.me,
      net: match.net,
      onHud: setHud,
      onEnd: r => endRef.current(r),
    })
    gameRef.current = game
    game.start()
    return () => {
      game.dispose()
      gameRef.current = null
    }
  }, [match])

  const online = match.mode !== 'local'
  const me = match.me
  const names = match.names
  const ready = hud.en[me] >= 100
  return (
    <div className="mvf-screen mvf-fight">
      <canvas ref={canvasRef} className="mvf-canvas" width={W} height={H} role="img" aria-label={`Fight: ${fighterById(match.chars[0]).name} against ${fighterById(match.chars[1]).name}`} />
      <div className="mvf-hud">
        <PlayerPanel side="left" id={match.chars[0]} name={names[0]} hp={hud.hp[0]} hpMax={hud.hpMax[0]} en={hud.en[0]} wins={hud.wins[0]} />
        <div className="mvf-mid">
          <button type="button" className="mvf-pause" onClick={() => gameRef.current?.pause()} disabled={online} aria-label={online ? 'Pause is off in online matches' : 'Pause (P)'}>
            <Icon name="pause" />
            <kbd>P</kbd>
          </button>
          <div className="mvf-timer" aria-label={`${hud.timer} seconds left`}>{hud.timer}</div>
          {online ? <div className="mvf-netping">{hud.ping == null ? 'Ping …' : `Ping ${hud.ping} ms`}</div> : null}
        </div>
        <PlayerPanel side="right" id={match.chars[1]} name={names[1]} hp={hud.hp[1]} hpMax={hud.hpMax[1]} en={hud.en[1]} wins={hud.wins[1]} />
      </div>
      <div className="mvf-banner-wrap" role="status" aria-live="polite">
        {hud.banner ? <div key={`${hud.round}-${hud.banner}`} className="mvf-banner">{hud.banner}</div> : null}
      </div>
      {hud.combo >= 2 ? <div key={hud.combo} className="mvf-combo">{hud.combo} hit combo</div> : null}
      <div className="mvf-controls">
        <DPad gameRef={gameRef} />
        <div className="mvf-actions">
          <TouchButton gameRef={gameRef} bit={INPUT.KICK} letter="L" icon="kick" className="l" label="Kick (L)" />
          <TouchButton gameRef={gameRef} bit={INPUT.FKICK} letter="K" icon="fkick" className="k" label="Flying kick (K)" />
          <TouchButton gameRef={gameRef} bit={INPUT.PUNCH} letter="J" icon="punch" className="j" label="Punch (J)" />
          <TouchButton gameRef={gameRef} bit={INPUT.HEAVY} letter="I" icon="heavy" className="i" label="Heavy punch (I)" />
          <TouchButton gameRef={gameRef} bit={INPUT.SPECIAL} letter="␣" icon="special" className={`sp${ready ? ' ready' : ''}`} label={ready ? 'Special attack (Space), ready' : 'Special attack (Space), charging'} />
        </div>
      </div>
      {hud.paused ? (
        <div className="mvf-overlay" role="dialog" aria-label="Paused">
          <div className="mvf-modal">
            <h3>Paused</h3>
            <div className="mvf-modal-actions">
              <button type="button" className="mvf-btn orange" onClick={() => gameRef.current?.resume()} autoFocus>Resume</button>
              <button type="button" className="mvf-btn blue" onClick={onQuit}>Quit to menu</button>
            </div>
          </div>
        </div>
      ) : null}
      {hud.waiting ? (
        <div className="mvf-overlay soft" role="status"><div className="mvf-modal"><h3>Waiting for your opponent to load…</h3></div></div>
      ) : null}
      {hud.lost > 0 ? (
        <div className="mvf-overlay" role="alert">
          <div className="mvf-modal">
            <h3>Opponent disconnected</h3>
            <p>If they do not come back in {hud.lost}s, you win.</p>
            <button type="button" className="mvf-btn blue" onClick={onQuit}>Leave match</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
