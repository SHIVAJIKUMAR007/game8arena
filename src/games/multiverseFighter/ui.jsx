// Small shared UI pieces for Multiverse Fighter: icons, portraits, the idle fighter preview, the top-right player bar
// and the belt progress bar. They only draw; all state comes from props or the save store.
import { useEffect, useRef } from 'react'
import { updateSettings, useSettings } from '../../platform/settings'
import { drawFighterPreview, drawPortrait } from './engine/render'
import { BELTS, beltIndex } from './roster'
import { XP_PER_LEVEL, useMv } from './store'
import { fighterById } from './roster'

const PATHS = {
  sound: <path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" />,
  mute: <path d="M3 9v6h4l5 4V5L7 9H3zm13.6 3 2.4-2.4-1.4-1.4-2.4 2.4-2.4-2.4-1.4 1.4 2.4 2.4-2.4 2.4 1.4 1.4 2.4-2.4 2.4 2.4 1.4-1.4-2.4-2.4z" />,
  fist: <path d="M7 3a2 2 0 0 0-2 2v3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 6 6h4a6 6 0 0 0 6-6v-3a2 2 0 0 0-2-2h-1V6a2 2 0 0 0-3-1.7A2 2 0 0 0 10 3.9 2 2 0 0 0 7 3z" />,
  heart: <path d="M12 21s-8-5.6-8-11.2A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 8 2.8C20 15.4 12 21 12 21z" />,
  coin: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm-1 2v8h2V8h-2z" />,
  lock: <path d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1zm2 0h6V8a3 3 0 0 0-6 0v2z" />,
  gift: <path d="M20 7h-2.2A3 3 0 0 0 12 4.8 3 3 0 0 0 6.2 7H4a1 1 0 0 0-1 1v3h8V7h2v4h8V8a1 1 0 0 0-1-1zM9 7a1 1 0 1 1 1-1v1H9zm6 0h-1V6a1 1 0 1 1 1 1zM4 13v7a1 1 0 0 0 1 1h6v-8H4zm9 0v8h6a1 1 0 0 0 1-1v-7h-7z" />,
  back: <path d="M14 5l-7 7 7 7V5z" />,
  play: <path d="M7 4v16l13-8L7 4z" />,
  pause: <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />,
  copy: <path d="M8 3h10a2 2 0 0 1 2 2v12h-2V5H8V3zM4 7h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />,
  star: <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z" />,
  check: <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />,
  kick: (
    <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <circle cx="9" cy="5" r="2.3" fill="currentColor" stroke="none" />
      <path d="M9 8l-1 6M9 9.5l-4 2M9 9.5l3 1M8 14l-3 6M8 14l12-2" />
    </g>
  ),
  fkick: (
    <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <circle cx="6" cy="6" r="2.3" fill="currentColor" stroke="none" />
      <path d="M7 8.5l5 4M7.5 9l-3 4M12 12.5l8-2M12 12.5l-2 6" />
    </g>
  ),
  punch: (
    <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <circle cx="8" cy="5" r="2.3" fill="currentColor" stroke="none" />
      <path d="M8 8l0 6M8 9.5l12 0M8 9.5l-3 3M8 14l-3 6M8 14l4 6" />
    </g>
  ),
  heavy: (
    <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <circle cx="9" cy="5" r="2.3" fill="currentColor" stroke="none" />
      <path d="M9 8l1 6M9.5 9l8-4M17.5 5l2 4M9 9l-4 3M10 14l-4 6M10 14l5 6" />
    </g>
  ),
  special: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" />,
}

export function Icon({ name, size = '1em', className = '' }) {
  return (
    <svg className={`mvf-icon ${className}`} viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  )
}

/** The big lightning-bolt VS mark. */
export function VsMark() {
  return (
    <svg className="mvf-vs" viewBox="0 0 200 300" aria-hidden="true">
      <path d="M120 0 40 150h45L55 300 165 120h-52L145 0z" fill="#0b3a44" opacity="0.9" />
      <path d="M118 12 52 140h42L72 280 150 126h-50L128 12z" fill="#16a9c0" opacity="0.55" />
      <text x="100" y="180" textAnchor="middle" fontSize="120" fontWeight="900" fontStyle="italic" fill="#fff" stroke="#0b3a44" strokeWidth="6" paintOrder="stroke" fontFamily="Bricolage Grotesque Variable, Impact, sans-serif">VS</text>
    </svg>
  )
}

export function Portrait({ id, size = 96, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) drawPortrait(ref.current, id)
  }, [id])
  return <canvas ref={ref} width={size} height={size} className={`mvf-portrait ${className}`} aria-hidden="true" />
}

/** An idle fighter, animated at about 30fps. The loop is cancelled on unmount or when the fighter changes. */
export function FighterPreview({ id, pose = 'idle', width = 520, height = 560, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return undefined
    let raf = 0
    let T = 0
    let last = 0
    const loop = now => {
      raf = requestAnimationFrame(loop)
      if (now - last < 33) return
      last = now
      T += 2
      drawFighterPreview(cv, id, T, pose)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [id, pose])
  return <canvas ref={ref} width={width} height={height} className={`mvf-preview ${className}`} role="img" aria-label={`${fighterById(id).name}, ready to fight`} />
}

export function SoundToggle() {
  const { sound } = useSettings()
  return (
    <button type="button" className="mvf-sound" aria-pressed={sound} aria-label={sound ? 'Mute sound' : 'Turn sound on'} onClick={() => updateSettings({ sound: !sound })}>
      <Icon name={sound ? 'sound' : 'mute'} />
    </button>
  )
}

export function TopBar() {
  const save = useMv()
  return (
    <div className="mvf-topbar">
      <div className="mvf-topbar-row">
        <SoundToggle />
        <div className="mvf-you">
          <span>You</span>
          <Portrait id={save.selected} size={64} />
        </div>
      </div>
      <div className="mvf-topbar-row">
        <div className="mvf-stat">Level: {save.level}</div>
        <div className="mvf-stat mvf-coins">
          <b>{save.coins}</b>
          <Icon name="coin" className="mvf-coin" />
        </div>
      </div>
    </div>
  )
}

function BeltIcon({ color }) {
  return (
    <span className="mvf-belt" style={{ '--belt': color }} aria-hidden="true">
      <i />
    </span>
  )
}

/** White-to-yellow style belt bar: current belt, progress to the next belt, next belt. */
export function BeltBar({ level, xp, label = true }) {
  const i = beltIndex(level)
  const next = Math.min(BELTS.length - 1, i + 1)
  const inBelt = ((level - 1) % 2) + xp / XP_PER_LEVEL
  const pct = i === BELTS.length - 1 ? 100 : Math.round((inBelt / 2) * 100)
  return (
    <div className="mvf-beltbar" role="progressbar" aria-label={`Belt progress to ${BELTS[next].label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <BeltIcon color={BELTS[i].color} />
      <div className="mvf-beltbar-track">
        <i style={{ width: `${pct}%` }} />
      </div>
      <BeltIcon color={BELTS[next].color} />
      {label ? <span className="mvf-sr">{BELTS[i].label} belt, {pct}% to {BELTS[next].label}</span> : null}
    </div>
  )
}

/** Faint martial-arts figures behind the menus. */
export function Silhouettes() {
  const fig = (x, y, s, r, key) => (
    <g key={key} transform={`translate(${x} ${y}) scale(${s}) rotate(${r})`} stroke="currentColor" strokeWidth="9" strokeLinecap="round" fill="none">
      <circle cx="0" cy="-70" r="11" fill="currentColor" stroke="none" />
      <path d="M0 -55 L0 -5 M0 -48 L38 -60 M0 -48 L-30 -28 M0 -5 L36 18 M0 -5 L-26 40" />
    </g>
  )
  return (
    <svg className="mvf-sil" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {fig(150, 360, 2.2, -6, 'a')}
      {fig(330, 520, 1.8, 8, 'b')}
      {fig(980, 330, 2.3, 4, 'c')}
      {fig(1150, 560, 1.7, -10, 'd')}
      {fig(560, 250, 1.4, 12, 'e')}
      {fig(760, 600, 1.6, -4, 'f')}
    </svg>
  )
}
