import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getProgress, updateProgress } from '../../platform/progress'
import { useSettings } from '../../platform/settings'
import { useStore } from '../../platform/storage'
import Tutorial from '../../platform/ui/Tutorial'
import '../../platform/platform.css'
import Avatar from './Avatar'
import Bottle from './Bottle'
import FamilySettings from './FamilySettings'
import Scenery from './Scenery'
import { config } from './config'
import { BOTTLE_COST, HINT_COST } from './economy'
import { familyStore, setLevel } from './store'
import { sfx, startMusic, stopMusic } from './audio'
import { useFamilySort } from './useFamilySort'
import './FamilySortGame.css'

const Icon = {
  undo: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6 3.5 11.5 9 17v-3.6c4.6-.4 7.7.9 9.5 4.1.2-5.2-3.1-9.2-9.5-9.5V6Z" fill="#43b53e" stroke="#1f7a2b" strokeWidth="1.2" strokeLinejoin="round" /></svg>
  ),
  bottle: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.5 3h5v3l2 2.5V20a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 20V8.5l2-2.5V3Z" fill="#cfeefc" stroke="#3b86b8" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7.5 14h9v6a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 20v-6Z" fill="#ff7a3d" />
      <path d="M19 3v4M17 5h4" stroke="#1f9d3a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  hint: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5a6.5 6.5 0 0 0-3.6 11.9c.5.4.8 1 .8 1.6v.8h5.6V16c0-.6.3-1.2.8-1.6A6.5 6.5 0 0 0 12 2.5Z" fill="#ffd84a" stroke="#c98a00" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M9.5 19h5M10.5 21.2h3" stroke="#7a5a3a" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  gear: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Zm9 4.9v-2.2l-2.3-.5a7 7 0 0 0-.8-1.9l1.3-2-1.6-1.6-2 1.3a7 7 0 0 0-1.9-.8L13.1 3h-2.2l-.5 2.3a7 7 0 0 0-1.9.8l-2-1.3-1.6 1.6 1.3 2a7 7 0 0 0-.8 1.9L3 10.9v2.2l2.3.5c.2.7.5 1.3.8 1.9l-1.3 2 1.6 1.6 2-1.3c.6.4 1.2.6 1.9.8l.5 2.3h2.2l.5-2.3c.7-.2 1.3-.5 1.9-.8l2 1.3 1.6-1.6-1.3-2c.4-.6.6-1.2.8-1.9l2.3-.5Z" fill="#fff" stroke="#1d3f94" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  ),
}

const rowsOf = bottles => {
  const per = bottles.length <= 6 ? bottles.length : Math.ceil(bottles.length / 2)
  const rows = []
  for (let i = 0; i < bottles.length; i += per) rows.push(bottles.slice(i, i + per).map((_, k) => i + k))
  return { rows, per }
}

const fmtTime = ms => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Confetti pieces with fixed, index-derived values, so a render is always the same. */
const CONFETTI = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 29) % 100,
  delay: ((i * 37) % 60) / 100,
  dur: 1.6 + ((i * 17) % 10) / 10,
  hue: (i * 47) % 360,
  rot: (i * 53) % 360,
}))

function Confetti() {
  return (
    <div className="fs-confetti" aria-hidden="true">
      {CONFETTI.map((c, i) => (
        <i key={i} style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, background: `hsl(${c.hue} 85% 58%)`, '--rot': `${c.rot}deg` }} />
      ))}
    </div>
  )
}

function WinOverlay({ result, onNext, onReplay }) {
  const nextRef = useRef(null)
  useEffect(() => nextRef.current?.focus(), [])
  return (
    <div className="fs-overlay" role="dialog" aria-modal="true" aria-label={`Level ${result.level} complete`}>
      <Confetti />
      <div className="fs-win">
        <h2>Level {result.level} complete!</h2>
        <div className="fs-stars" role="img" aria-label={`${result.stars} of 3 stars`}>
          {[1, 2, 3].map(n => <span key={n} className={n <= result.stars ? 'on' : ''} style={{ animationDelay: `${0.25 + n * 0.18}s` }}>★</span>)}
        </div>
        {result.reward.total > 0 ? (
          <>
            <p className="fs-reward">
              <span className="fs-coin-big" aria-hidden="true">🪙</span> +{result.reward.total} coins
            </p>
            <p className="fs-reward-detail">
              {result.reward.bonus > 0 ? `${result.reward.base} for the win + ${result.reward.bonus} for no hints` : `${result.reward.base} for the win. Skip the hints next time for a bonus.`}
            </p>
          </>
        ) : (
          <p className="fs-reward-detail">You have cleared this level before, so there are no coins this time.</p>
        )}
        <p className="fs-win-stats">{result.moves} moves · {fmtTime(result.time)} · score {result.score}</p>
        <div className="fs-win-actions">
          <button type="button" className="fs-btn primary" ref={nextRef} onClick={onNext}>Next Level</button>
          <button type="button" className="fs-btn" onClick={onReplay}>Replay</button>
        </div>
      </div>
    </div>
  )
}

function Round({ level, onNext, onReplay }) {
  const game = useFamilySort(level)
  const save = useStore(familyStore)
  const settings = useSettings()
  const [panel, setPanel] = useState(() => (getProgress('family').tutorialSeen ? null : 'help'))
  const slots = useRef([])

  const { bottles, anim, selected, hint } = game
  const { rows, per } = useMemo(() => rowsOf(bottles), [bottles])

  // Music follows the saved switch and stops when the game closes.
  useEffect(() => {
    if (save.settings.music && settings.sound) startMusic()
    else stopMusic()
    return stopMusic
  }, [save.settings.music, settings.sound])

  // Carry the pouring bottle over the one it fills: measure both slots and aim the tilted mouth at the opening.
  const [pourStyle, setPourStyle] = useState(null)
  useLayoutEffect(() => {
    if (!anim || anim.phase !== 'go') return
    const a = slots.current[anim.from]?.getBoundingClientRect()
    const b = slots.current[anim.to]?.getBoundingClientRect()
    if (!a || !b) return
    const dir = b.left + b.width / 2 >= a.left + a.width / 2 ? 1 : -1
    const H = a.height
    const angle = 62
    const mouthX = Math.sin((angle * Math.PI) / 180) * (H / 2)
    const mouthY = Math.cos((angle * Math.PI) / 180) * (H / 2)
    const tx = b.left + b.width / 2 - dir * mouthX - (a.left + a.width / 2)
    const ty = b.top - H * 0.1 + mouthY - (a.top + a.height / 2)
    setPourStyle({ index: anim.from, style: { '--tx': `${tx}px`, '--ty': `${ty}px`, '--rot': `${dir * angle}deg` } })
  }, [anim])

  const closeHelp = useCallback(() => {
    updateProgress('family', p => (p.tutorialSeen ? p : { ...p, tutorialSeen: true }))
    setPanel(null)
  }, [])

  // Keyboard: arrows move between bottles, Enter/Space pour (native button), Escape puts the bottle down.
  const onKeyDown = e => {
    if (panel) return
    const k = e.key.toLowerCase()
    if (k === 'escape') game.cancel()
    else if (k === 'u') game.undo()
    else if (k === 'h') game.showHint()
    else if (k === 'r') game.restart()
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const buttons = [...e.currentTarget.querySelectorAll('.fs-bottle')]
      const at = buttons.indexOf(document.activeElement)
      const next = buttons[(Math.max(at, 0) + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length]
      next?.focus()
      e.preventDefault()
    }
  }

  const status = game.status
  return (
    <div
      className="fs-root"
      data-bottle={save.equipped.bottle}
      data-bg={save.equipped.background}
      onKeyDown={onKeyDown}
    >
      <Scenery theme={save.equipped.background} />

      <header className="fs-hud">
        <div className="fs-plaque" aria-label={`Level ${level}`}>
          <small>Level</small>
          <b>{level}</b>
        </div>
        <Avatar />
        <div className="fs-plaque coins" aria-label={`Coins ${save.coins}`}>
          <small>Coins</small>
          <b><span className="fs-coin" aria-hidden="true" />{save.coins}</b>
        </div>
      </header>

      <p className="fs-msg" role="status" aria-live="polite">
        {game.message || (status === 'stuck' ? 'No moves left. Undo, or add an extra bottle.' : '')}
      </p>

      <div className="fs-stage" style={{ '--per-row': per, '--rows': rows.length }}>
        {rows.map((row, r) => (
          <div className="fs-bench" key={r}>
            <div className="fs-row">
              {row.map(i => (
                <Bottle
                  key={i}
                  ref={el => { slots.current[i] = el }}
                  index={i}
                  units={bottles[i]}
                  capacity={game.capacity}
                  selected={selected === i}
                  hint={hint ? (hint.from === i ? 'from' : hint.to === i ? 'to' : null) : null}
                  shake={game.shake === i}
                  celebrate={game.celebrate === i}
                  pouring={anim?.phase === 'go' && anim.from === i}
                  receiving={anim?.phase === 'go' && anim.to === i}
                  streamColor={anim?.color}
                  symbols={save.settings.symbols}
                  pourStyle={pourStyle?.index === i && anim?.phase === 'go' ? pourStyle.style : undefined}
                  onSelect={game.select}
                />
              ))}
            </div>
            <div className="fs-plank" aria-hidden="true" />
            <div className="fs-legs" aria-hidden="true"><i /><i /></div>
          </div>
        ))}
      </div>

      <nav className="fs-controls" aria-label="Game controls">
        <button type="button" className="fs-tool" onClick={game.undo} disabled={!game.canUndo} aria-label="Undo move">
          {Icon.undo}<em className="fs-badge">{game.moves}</em>
        </button>
        <button type="button" className="fs-tool" onClick={game.addBottle} aria-label={`Add bottle for ${BOTTLE_COST} coins`}>
          {Icon.bottle}<em className="fs-badge">{BOTTLE_COST}</em>
        </button>
        <button type="button" className="fs-tool" onClick={game.showHint} aria-label={`Hint for ${HINT_COST} coins`}>
          {Icon.hint}<em className="fs-badge">{HINT_COST}</em>
        </button>
        <button type="button" className="fs-tool round" onClick={() => { sfx('select'); setPanel('settings') }} aria-label="Settings">
          {Icon.gear}
        </button>
      </nav>

      {status === 'won' && game.result && <WinOverlay result={game.result} onNext={onNext} onReplay={onReplay} />}
      {panel === 'settings' && (
        <FamilySettings onClose={() => setPanel(null)} onRestart={game.restart} onHelp={() => setPanel('help')} />
      )}
      {panel === 'help' && <Tutorial steps={config.tutorial} onClose={closeHelp} />}
    </div>
  )
}

/** Family Sort: a liquid sorting puzzle. Level N is the same puzzle for everyone; progress and coins are saved. */
export default function FamilySortGame() {
  const [level, setLvl] = useState(() => familyStore.get().level)
  const [round, setRound] = useState(0) // bumps to replay the same level from scratch
  return (
    <Round
      key={`${level}:${round}`}
      level={level}
      onNext={() => {
        setLevel(level + 1)
        setLvl(level + 1)
      }}
      onReplay={() => {
        setLevel(level)
        setRound(r => r + 1)
      }}
    />
  )
}
