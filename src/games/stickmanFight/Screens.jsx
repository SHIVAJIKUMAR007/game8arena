// The menu screens: main menu, level select, customise, 2-player setup and settings. They only read and write the
// save (store.js) and hand a "start this fight" request up to the container; no fight logic lives here.
import { useEffect, useRef, useState } from 'react'
import { updateSettings, useSettings } from '../../platform/settings'
import { sfx } from './audio'
import { ARENAS, ARENA_ORDER, COLORS, DESIGNS, EFFECTS, SKINS, WEAPONS, WEAPON_ORDER, byId, colorHex } from './data'
import { LEVEL_COUNT, generateLevel, isBoss, levelSeed } from './levels'
import { drawPreview } from './render'
import { DEFAULT_SAVE, buy, designOf, equip, loadoutOf, owns, priceOf, updateStick } from './store'

const Coin = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#ffc933" stroke="#c98a00" strokeWidth="2" />
    <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="900" fill="#a86a00">$</text>
  </svg>
)

/** Animated stickman for the menus. */
export function Preview({ spec, label }) {
  const ref = useRef(null)
  const specRef = useRef(spec)
  useEffect(() => {
    specRef.current = spec
  })
  useEffect(() => {
    const c = ref.current
    const ctx = c && c.getContext ? c.getContext('2d') : null
    if (!ctx) return undefined
    let raf = 0
    const t0 = performance.now()
    const loop = now => {
      drawPreview(ctx, specRef.current, c.width, c.height, (now - t0) / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} width={440} height={360} className="sf-preview" role="img" aria-label={label || 'Your stickman'} />
}

export function TopBar({ coins, onBack, title, onSettings, children }) {
  return (
    <header className="sf-top">
      {onBack ? (
        <button className="sf-icon-btn back" onClick={() => { sfx('back'); onBack() }} aria-label="Back">
          ←
        </button>
      ) : null}
      {title ? <h2 className="sf-title">{title}</h2> : null}
      <div className="sf-top-mid">{children}</div>
      <div className="sf-pill coin" aria-label={`${coins} coins`}>
        <Coin />
        <b>{coins}</b>
      </div>
      {onSettings ? (
        <button className="sf-icon-btn gear" onClick={() => { sfx('click'); onSettings() }} aria-label="Settings">
          ⚙
        </button>
      ) : null}
    </header>
  )
}

/** Five boxes around your current level, like a progress strip. */
function LevelStrip({ save }) {
  const first = Math.max(1, save.level - 1)
  const items = Array.from({ length: 5 }, (_, i) => first + i)
  return (
    <ol className="sf-strip" aria-label="Campaign progress">
      {items.map(n => (
        <li key={n} className={n < save.level ? 'done' : n === save.level ? 'now' : ''} aria-current={n === save.level ? 'step' : undefined}>
          {isBoss(n) ? '👑' : n}
        </li>
      ))}
    </ol>
  )
}

// ───────────── main menu ─────────────
export function MainMenu({ save, go, playSingle, onSettings }) {
  return (
    <div className="sf-screen menu">
      <TopBar coins={save.coins} onSettings={onSettings}>
        <LevelStrip save={save} />
      </TopBar>
      <h1 className="sf-logo">
        <span>STICKMAN</span>
        <span className="b">FIGHT</span>
      </h1>
      <div className="sf-menu-body">
        <div className="sf-hero">
          <Preview spec={loadoutOf(save)} />
          <p className="sf-hero-note">{WEAPONS[save.equipped.weapon].name}</p>
        </div>
        <nav className="sf-buttons" aria-label="Main menu">
          <button className="sf-btn green big" onClick={() => { sfx('click'); playSingle(save.level) }}>
            Single Player <small>Level {save.level}</small>
          </button>
          <button className="sf-btn big" onClick={() => { sfx('click'); go('versus') }}>2 Player</button>
          <button className="sf-btn" onClick={() => { sfx('click'); go('custom', 'weapon') }}>🗡️ Weapon Selection</button>
          <button className="sf-btn" onClick={() => { sfx('click'); go('custom', 'skin') }}>🎩 Skin Selection</button>
          <button className="sf-btn" onClick={() => { sfx('click'); go('levels') }}>🏁 Level Selection</button>
          <button className="sf-btn" onClick={() => { sfx('click'); onSettings() }}>⚙ Settings</button>
        </nav>
      </div>
    </div>
  )
}

// ───────────── level select ─────────────
export function LevelSelect({ save, onBack, playSingle, onSettings }) {
  const endless = save.best >= LEVEL_COUNT
  const tiles = Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1)
  return (
    <div className="sf-screen">
      <TopBar coins={save.coins} onBack={onBack} title="Level Selection" onSettings={onSettings} />
      <ul className="sf-levels">
        {tiles.map(n => {
          const open = n <= save.best + 1
          const ls = generateLevel(levelSeed(n), { level: n })
          const stars = save.stars[n] || 0
          return (
            <li key={n}>
            <button
              className={`sf-level${open ? '' : ' locked'}${n === save.level ? ' now' : ''}${ls.boss ? ' boss' : ''}`}
              disabled={!open}
              aria-label={open ? `Level ${n}, ${ls.enemy.name}${stars ? `, ${stars} stars` : ''}` : `Level ${n}, locked`}
              onClick={() => { sfx('click'); playSingle(n) }}
            >
              <span className="num">{open ? n : '🔒'}</span>
              <span className="foe" aria-hidden="true">{open ? (ls.boss ? '👑' : WEAPONS[ls.enemy.weapon].icon) : ''}</span>
              <span className="st" aria-hidden="true">{[1, 2, 3].map(k => <i key={k} className={k <= stars ? 'on' : ''}>★</i>)}</span>
            </button>
            </li>
          )
        })}
        {endless ? (
          <li>
            <button className="sf-level endless" onClick={() => { sfx('click'); playSingle(save.level) }} aria-label={`Endless, level ${save.level}`}>
              <span className="num">∞</span>
              <span className="foe">Lv {save.level}</span>
            </button>
          </li>
        ) : null}
      </ul>
      <p className="sf-hint">Beat a level to unlock the next. After level {LEVEL_COUNT} the fights keep coming at full strength.</p>
    </div>
  )
}

// ───────────── customise ─────────────
const TABS = [
  { id: 'weapon', label: 'Weapon', icon: '🗡️' },
  { id: 'skin', label: 'Skin', icon: '🎩' },
  { id: 'color', label: 'Color', icon: '🎨' },
  { id: 'effect', label: 'Effect', icon: '✨' },
]
const LISTS = {
  weapon: WEAPON_ORDER.map(id => ({ ...WEAPONS[id], icon: WEAPONS[id].icon })),
  skin: SKINS,
  color: COLORS,
  effect: EFFECTS,
}
const SKIN_ICON = { classic: '🙂', cap: '🧢', ninja: '🥷', mask: '🦹', helmet: '🛡️', viking: '🪓', crown: '👑', wizard: '🧙' }
const EFFECT_ICON = { none: '—', fire: '🔥', ice: '❄️', electric: '⚡', shadow: '🌑', rainbow: '🌈' }

function Bar({ label, v }) {
  return (
    <div className="sf-stat">
      <span>{label}</span>
      <i><b style={{ width: `${Math.round(Math.min(1, v) * 100)}%` }} /></i>
    </div>
  )
}

export function Customize({ save, tab: startTab, onBack, onSettings }) {
  const [tab, setTab] = useState(startTab || 'weapon')
  const [focus, setFocus] = useState({})
  const [note, setNote] = useState('')
  const cur = focus[tab] ?? save.equipped[tab]
  const list = LISTS[tab]
  const item = byId(list, cur) || list[0]
  const weaponId = tab === 'weapon' ? item.id : save.equipped.weapon
  const [designFocus, setDesignFocus] = useState(null)

  const preview = {
    weapon: weaponId,
    color: tab === 'color' ? item.id : save.equipped.color,
    skin: tab === 'skin' ? item.id : save.equipped.skin,
    effect: tab === 'effect' ? item.id : save.equipped.effect,
    design: designFocus && designFocus.startsWith(`${weaponId}:`) ? designFocus.split(':')[1] : designOf(save, weaponId),
  }

  const act = (kind, id) => {
    const key = id
    if (owns(save, kind, key)) {
      const next = equip(save, kind, key)
      if (next) {
        updateStick(() => next)
        sfx('click')
        setNote('Equipped.')
      }
      return
    }
    const price = priceOf(kind, key)
    if (save.coins < price) {
      sfx('deny')
      setNote(`Not enough coins. You need ${price - save.coins} more. Win fights to earn coins.`)
      return
    }
    if (kind === 'design' && !save.weapons.includes(key.split(':')[0])) {
      sfx('deny')
      setNote('Unlock the weapon first.')
      return
    }
    updateStick(s => {
      const bought = buy(s, kind, key)
      return bought ? equip(bought, kind, key) || bought : s
    })
    sfx('buy')
    setNote('Unlocked and equipped!')
  }

  const equipped = save.equipped[tab] === item.id
  const isOwned = owns(save, tab, item.id)
  const w = tab === 'weapon' ? WEAPONS[item.id] : null

  return (
    <div className="sf-screen">
      <TopBar coins={save.coins} onBack={onBack} title="Customize" onSettings={onSettings} />
      <div className="sf-tabs" role="tablist" aria-label="Customize">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'on' : ''}
            onClick={() => { sfx('click'); setTab(t.id); setNote(''); setDesignFocus(null) }}
          >
            <span aria-hidden="true">{t.icon}</span> {t.label}
          </button>
        ))}
      </div>
      <div className="sf-custom">
        <div className="sf-side">
          <Preview spec={preview} label={`Preview: ${item.name}`} />
          <h3>{item.name}</h3>
          {w ? (
            <>
              <p className="sf-blurb">{w.blurb}</p>
              <Bar label="Damage" v={w.damage / 24} />
              <Bar label="Range" v={(w.range || 360) / 140} />
              <Bar label="Speed" v={0.2 / w.dur} />
              <p className="sf-special">★ {w.special.name} <small>({w.special.cd}s)</small></p>
            </>
          ) : null}
          <button
            className={`sf-btn ${equipped ? '' : 'green'}`}
            disabled={equipped}
            onClick={() => act(tab, item.id)}
          >
            {equipped ? 'Equipped' : isOwned ? 'Equip' : <>Buy <Coin /> {priceOf(tab, item.id)}</>}
          </button>
          <p className="sf-note" role="status" aria-live="polite">{note}</p>
        </div>
        <div className="sf-grid-wrap">
          <ul className="sf-grid" aria-label={`${tab} choices`}>
            {list.map(it => {
              const own = owns(save, tab, it.id)
              return (
                <li key={it.id}>
                <button
                  className={`sf-card${it.id === item.id ? ' sel' : ''}${save.equipped[tab] === it.id ? ' eq' : ''}${own ? '' : ' lock'}`}
                  aria-pressed={it.id === item.id}
                  aria-label={`${it.name}, ${own ? (save.equipped[tab] === it.id ? 'equipped' : 'owned') : `${priceOf(tab, it.id)} coins`}`}
                  onClick={() => { sfx('click'); setFocus(f => ({ ...f, [tab]: it.id })); setNote(''); setDesignFocus(null) }}
                >
                  <span className="ico" aria-hidden="true">
                    {tab === 'color' ? <i className="sw" style={{ background: it.hex }} /> : tab === 'weapon' ? it.icon : tab === 'skin' ? SKIN_ICON[it.id] : EFFECT_ICON[it.id]}
                  </span>
                  <span className="nm">{it.name}</span>
                  <span className="pr">{save.equipped[tab] === it.id ? '✔' : own ? 'Owned' : <><Coin /> {it.price}</>}</span>
                </button>
                </li>
              )
            })}
          </ul>
          {tab === 'weapon' && owns(save, 'weapon', item.id) ? (
            <div className="sf-designs">
              <h4>Designs for {item.name}</h4>
              <ul className="sf-chips">
                {DESIGNS.map(d => {
                  const id = `${item.id}:${d.id}`
                  const own = owns(save, 'design', id)
                  const on = designOf(save, item.id) === d.id
                  return (
                    <li key={d.id}>
                    <button
                      className={`sf-chip${on ? ' eq' : ''}${designFocus === id ? ' sel' : ''}`}
                      onMouseEnter={() => setDesignFocus(id)}
                      onFocus={() => setDesignFocus(id)}
                      onClick={() => act('design', id)}
                      aria-label={`${d.name} design, ${on ? 'equipped' : own ? 'owned' : `${d.price} coins`}`}
                    >
                      <i style={{ background: d.palette ? d.palette.blade : '#dfe8ef', borderColor: d.palette ? d.palette.accent : '#e0a526' }} />
                      {d.name} <small>{on ? '✔' : own ? '' : <><Coin /> {d.price}</>}</small>
                    </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ───────────── 2 player setup ─────────────
const cycle = (list, id, dir) => list[(list.findIndex(x => x.id === id) + dir + list.length) % list.length].id

function Picker({ label, value, text, onPrev, onNext }) {
  return (
    <div className="sf-pick">
      <span className="lb">{label}</span>
      <button onClick={onPrev} aria-label={`Previous ${label}`}>◀</button>
      <b aria-live="polite">{text}</b>
      <button onClick={onNext} aria-label={`Next ${label}`}>▶</button>
      <span hidden>{value}</span>
    </div>
  )
}

export function VersusSetup({ save, onBack, start, onSettings }) {
  const mySkins = SKINS.filter(x => owns(save, 'skin', x.id))
  const [p, setP] = useState(() => [
    { ...loadoutOf(save), name: 'Player 1' },
    { weapon: 'sword', color: save.equipped.color === 'red' ? 'blue' : 'red', skin: 'classic', effect: 'none', design: 'classic', name: 'Player 2' },
  ])
  const [arena, setArena] = useState('random')
  const upd = (i, patch) => setP(ps => ps.map((x, k) => (k === i ? { ...x, ...patch, design: patch.weapon ? (i === 0 ? designOf(save, patch.weapon) : 'classic') : x.design } : x)))
  const arenaOpts = [{ id: 'random', name: 'Random arena' }, ...ARENA_ORDER.map(id => ({ id, name: ARENAS[id].name }))]
  const keys = [
    ['A / D', 'W', 'S', 'F', 'G'],
    ['← / →', '↑', '↓', 'K', 'L'],
  ]

  return (
    <div className="sf-screen">
      <TopBar coins={save.coins} onBack={onBack} title="2 Player" onSettings={onSettings} />
      <div className="sf-versus">
        {p.map((pl, i) => (
          <section key={i} className={`sf-vs-card p${i + 1}`} aria-label={`Player ${i + 1}`}>
            <h3>Player {i + 1}</h3>
            <Preview spec={pl} label={`Player ${i + 1} preview`} />
            <Picker label="Weapon" value={pl.weapon} text={WEAPONS[pl.weapon].name} onPrev={() => upd(i, { weapon: cycle(Object.values(WEAPONS), pl.weapon, -1) })} onNext={() => upd(i, { weapon: cycle(Object.values(WEAPONS), pl.weapon, 1) })} />
            <Picker label="Color" value={pl.color} text={byId(COLORS, pl.color).name} onPrev={() => upd(i, { color: cycle(COLORS, pl.color, -1) })} onNext={() => upd(i, { color: cycle(COLORS, pl.color, 1) })} />
            <Picker label="Skin" value={pl.skin} text={byId(SKINS, pl.skin).name} onPrev={() => upd(i, { skin: cycle(mySkins, pl.skin, -1) })} onNext={() => upd(i, { skin: cycle(mySkins, pl.skin, 1) })} />
            <p className="sf-keys">
              Move <kbd>{keys[i][0]}</kbd> Jump <kbd>{keys[i][1]}</kbd> Block <kbd>{keys[i][2]}</kbd> Attack <kbd>{keys[i][3]}</kbd> Special <kbd>{keys[i][4]}</kbd>
            </p>
            <span className="sf-dot" style={{ background: colorHex(pl.color) }} aria-hidden="true" />
          </section>
        ))}
      </div>
      <div className="sf-vs-foot">
        <Picker label="Arena" value={arena} text={arenaOpts.find(a => a.id === arena).name} onPrev={() => setArena(cycle(arenaOpts, arena, -1))} onNext={() => setArena(cycle(arenaOpts, arena, 1))} />
        <button className="sf-btn green big" onClick={() => { sfx('click'); start({ players: p, arena }) }}>Start Fight</button>
      </div>
      <p className="sf-hint">Both players share one keyboard. Weapons are free to pick here; skins and effects come from what you have unlocked.</p>
    </div>
  )
}

// ───────────── settings ─────────────
export function SettingsPanel({ save, onClose }) {
  const s = useSettings()
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="sf-panel">
      <label className="sf-row">
        <span>Sound effects</span>
        <input type="checkbox" checked={s.sound} onChange={e => updateSettings({ sound: e.target.checked })} />
      </label>
      <label className="sf-row">
        <span>Music</span>
        <input type="checkbox" checked={save.music} disabled={!s.sound} onChange={e => updateStick(v => ({ ...v, music: e.target.checked }))} />
      </label>
      <label className="sf-row">
        <span>Volume</span>
        <input type="range" min="0" max="1" step="0.05" value={s.volume} disabled={!s.sound} aria-label="Volume" onChange={e => updateSettings({ volume: Number(e.target.value) })} onPointerUp={() => sfx('click')} />
      </label>
      <label className="sf-row">
        <span>Vibration (phones)</span>
        <input type="checkbox" checked={s.haptics} onChange={e => updateSettings({ haptics: e.target.checked })} />
      </label>
      <div className="sf-row">
        <span>Saved progress</span>
        {confirm ? (
          <span className="sf-confirm">
            <button className="sf-btn small red" onClick={() => { updateStick(() => ({ ...DEFAULT_SAVE })); setConfirm(false); sfx('back') }}>Erase it</button>
            <button className="sf-btn small" onClick={() => setConfirm(false)}>Keep it</button>
          </span>
        ) : (
          <button className="sf-btn small red" onClick={() => setConfirm(true)}>Reset Stickman Fight</button>
        )}
      </div>
      {onClose ? <button className="sf-btn green" onClick={onClose}>Done</button> : null}
    </div>
  )
}
