// Menu-side screens for Multiverse Fighter: main menu, fighter select, the VS screen and the result screen.
// They render the saved state and call back into the container; no fight logic lives here.
import { useCallback, useEffect, useRef, useState } from 'react'
import { BeltBar, FighterPreview, Icon, Portrait, Silhouettes, TopBar, VsMark } from './ui'
import { MAX_UPGRADE, ROSTER, fighterById, upgradeCost } from './roster'
import { AD_REWARD, AD_SECONDS, DAILY_REWARD, aiProfile, buyFighter, buyUpgrade, claimDaily, addCoins, dailyRemaining, isUnlocked, selectFighter, updateMv, upgradesOf, useMv } from './store'

const fmtWait = ms => {
  const m = Math.ceil(ms / 60000)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

/** Re-renders every `ms` while `active`, so cooldown text stays fresh. */
function useClock(active, ms = 30000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return undefined
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [active, ms])
  return now
}

// ───────────── main menu ─────────────
export function MainMenu({ onVs, onOnline, onFighters }) {
  const save = useMv()
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [ad, setAd] = useState(0)
  const adRef = useRef(0)
  const msgRef = useRef(0)
  const wait = dailyRemaining(save, useClock(true))

  useEffect(() => () => {
    clearTimeout(adRef.current)
    clearTimeout(msgRef.current)
  }, [])

  const say = useCallback(text => {
    setMsg(text)
    clearTimeout(msgRef.current)
    msgRef.current = setTimeout(() => setMsg(''), 2600)
  }, [])

  const daily = () => {
    const r = claimDaily(save, Date.now())
    if (r.ok) {
      updateMv(() => r.save)
      say(`Daily reward: +${DAILY_REWARD} coins`)
    } else say(`Daily reward comes back in ${fmtWait(r.remainingMs)}`)
  }

  const watchAd = () => {
    if (ad) return
    let left = AD_SECONDS
    setAd(left)
    const tick = () => {
      left--
      if (left <= 0) {
        setAd(0)
        updateMv(s => addCoins(s, AD_REWARD))
        say(`Thanks for watching: +${AD_REWARD} coins`)
      } else {
        setAd(left)
        adRef.current = setTimeout(tick, 1000)
      }
    }
    adRef.current = setTimeout(tick, 1000)
  }

  return (
    <div className="mvf-screen mvf-menu">
      <Silhouettes />
      <TopBar />
      <div className="mvf-belt-wrap">
        <BeltBar level={save.level} xp={save.xp} />
      </div>
      <div className="mvf-hero">
        <div className="mvf-floor" aria-hidden="true" />
        <FighterPreview id={save.selected} />
        <h2 className="mvf-hero-name">{fighterById(save.selected).name}</h2>
      </div>
      <div className="mvf-side">
        <button type="button" className="mvf-card-btn" onClick={daily} disabled={wait > 0} aria-label={wait > 0 ? `Daily reward, back in ${fmtWait(wait)}` : 'Claim daily reward'}>
          <Icon name="gift" className="mvf-card-icon" />
          <span>Daily reward</span>
          {wait > 0 ? <small>{fmtWait(wait)}</small> : <em className="mvf-ping">Ready</em>}
        </button>
        <button type="button" className="mvf-card-btn" onClick={watchAd} disabled={ad > 0} aria-label={`Free coins: watch a short ad for ${AD_REWARD} coins`}>
          <span className="mvf-ad">AD</span>
          <Icon name="coin" className="mvf-card-icon" />
          <span>Free coins</span>
          {ad ? <small>{ad}s</small> : null}
        </button>
      </div>
      <button type="button" className="mvf-btn blue mvf-fighters" onClick={onFighters}>
        <Icon name="star" /> Fighters
      </button>
      <div className="mvf-play">
        {open ? (
          <div className="mvf-play-menu" role="group" aria-label="Game mode">
            <button type="button" className="mvf-btn tan" onClick={onVs}>Vs computer</button>
            <button type="button" className="mvf-btn tan" onClick={onOnline}>Online</button>
          </div>
        ) : null}
        <button type="button" className="mvf-btn orange mvf-playbtn" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          Play
        </button>
      </div>
      {ad ? (
        <div className="mvf-overlay" role="dialog" aria-label="Ad playing">
          <div className="mvf-modal">
            <h3>Ad playing</h3>
            <p>Your {AD_REWARD} coins arrive in {ad}…</p>
            <div className="mvf-adbar"><i style={{ width: `${((AD_SECONDS - ad + 1) / AD_SECONDS) * 100}%` }} /></div>
          </div>
        </div>
      ) : null}
      <p className="mvf-toast" role="status">{msg}</p>
    </div>
  )
}

// ───────────── fighter select ─────────────
function StatRow({ label, value }) {
  return (
    <div className="mvf-statrow">
      <span>{label}</span>
      <div className="mvf-pips" aria-label={`${label} ${value} of 10`}>
        {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < value ? 'on' : ''} />)}
      </div>
    </div>
  )
}

export function FighterSelect({ onBack }) {
  const save = useMv()
  const [note, setNote] = useState('')
  const pick = f => {
    if (isUnlocked(save, f.id)) {
      updateMv(s => selectFighter(s, f.id))
      setNote('')
      return
    }
    const r = buyFighter(save, f.id)
    if (r.ok) {
      updateMv(() => selectFighter(r.save, f.id))
      setNote(`${f.name} unlocked`)
    } else setNote(`${f.name} costs ${f.price} coins. You have ${save.coins}.`)
  }
  return (
    <div className="mvf-screen mvf-select">
      <Silhouettes />
      <TopBar />
      <h2 className="mvf-title">Choose your fighter</h2>
      <ul className="mvf-grid">
        {ROSTER.map(f => {
          const owned = isUnlocked(save, f.id)
          const sel = save.selected === f.id
          return (
            <li key={f.id}>
              <button type="button" className={`mvf-fcard${sel ? ' sel' : ''}${owned ? '' : ' locked'}`} onClick={() => pick(f)} aria-pressed={sel}>
                <Portrait id={f.id} size={96} />
                <span className="mvf-fname">{f.name}</span>
                <span className="mvf-funi">{f.universe}</span>
                <StatRow label="Power" value={f.power} />
                <StatRow label="Health" value={f.health} />
                <StatRow label="Speed" value={f.speed} />
                <span className="mvf-fstate">
                  {owned ? (
                    sel ? 'Selected' : 'Select'
                  ) : (
                    <>
                      <Icon name="lock" /> {f.price} <Icon name="coin" className="mvf-coin" />
                    </>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mvf-toast" role="status">{note}</p>
      <button type="button" className="mvf-btn tan mvf-back" onClick={onBack}>
        <Icon name="back" /> Back
      </button>
    </div>
  )
}

// ───────────── VS screen ─────────────
function UpgradeCard({ kind, level, cost, disabled, locked, onBuy }) {
  const maxed = level >= MAX_UPGRADE
  return (
    <button type="button" className="mvf-up" disabled={disabled || maxed || locked} onClick={onBuy} aria-label={`${kind} level ${level}${maxed ? ', maxed' : locked ? '' : `, upgrade for ${cost} coins`}`}>
      <span className="mvf-up-head">
        <b>{kind}</b>
        <b>{level}</b>
      </span>
      <Icon name={kind === 'Power' ? 'fist' : 'heart'} className={`mvf-up-icon ${kind === 'Power' ? 'fist' : 'heart'}`} />
      <span className="mvf-up-cost">{maxed ? 'MAX' : locked ? 'Base' : (<><Icon name="coin" className="mvf-coin" /> {cost}</>)}</span>
    </button>
  )
}

export function VsScreen({ meId, oppId, online, level, onBack, onFight }) {
  const save = useMv()
  const [count, setCount] = useState(3)
  const up = upgradesOf(save, meId)
  const ai = aiProfile(level)
  const buy = kind => {
    const r = buyUpgrade(save, meId, kind)
    if (r.ok) updateMv(() => r.save)
  }

  useEffect(() => {
    if (!online) return undefined
    const id = setInterval(() => setCount(c => c - 1), 1000)
    return () => clearInterval(id)
  }, [online])
  useEffect(() => {
    if (online && count <= 0) onFight()
  }, [online, count, onFight])

  const me = fighterById(meId)
  const opp = fighterById(oppId)
  return (
    <div className="mvf-screen mvf-vsscreen">
      <Silhouettes />
      <TopBar />
      <div className="mvf-vs-side left">
        <FighterPreview id={meId} width={420} height={520} />
        <h3 className="mvf-vs-name">{me.name}</h3>
        <div className="mvf-ups">
          <UpgradeCard kind="Power" level={online ? 1 : up.power + 1} cost={upgradeCost(up.power)} locked={online} disabled={save.coins < upgradeCost(up.power)} onBuy={() => buy('power')} />
          <UpgradeCard kind="Health" level={online ? 1 : up.health + 1} cost={upgradeCost(up.health)} locked={online} disabled={save.coins < upgradeCost(up.health)} onBuy={() => buy('health')} />
        </div>
      </div>
      <VsMark />
      <div className="mvf-vs-side right">
        <FighterPreview id={oppId} width={420} height={520} className="flip" />
        <h3 className="mvf-vs-name">{opp.name}</h3>
        <div className="mvf-ups">
          <UpgradeCard kind="Power" level={online ? 1 : ai.card} locked disabled />
          <UpgradeCard kind="Health" level={online ? 1 : ai.card} locked disabled />
        </div>
      </div>
      <button type="button" className="mvf-btn tan mvf-back" onClick={onBack}>
        <Icon name="back" /> {online ? 'Leave' : 'Back'}
      </button>
      {online ? (
        <p className="mvf-vs-note" role="status">Online match: base stats for both. Starting in {Math.max(0, count)}…</p>
      ) : (
        <button type="button" className="mvf-btn orange mvf-fightbtn" onClick={onFight}>
          <Icon name="play" /> Fight
        </button>
      )}
    </div>
  )
}

// ───────────── result ─────────────
export function ResultScreen({ result, online, peerGone, rematch, onNext, onMenu, onRematch }) {
  const forfeit = result.reason === 'disconnect' || result.reason === 'left'
  const title = forfeit ? 'Opponent disconnected' : result.won ? 'You win' : 'You lose'
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const level = shown ? result.after.level : result.before.level
  const xp = shown ? result.after.xp : result.before.xp
  return (
    <div className="mvf-screen mvf-result">
      <Silhouettes />
      <TopBar />
      <div className="mvf-result-card">
        <h2 className={result.won ? 'win' : 'lose'}>{title}</h2>
        {forfeit ? <p className="mvf-sub">You win by forfeit.</p> : <p className="mvf-sub">{result.won ? 'Round after round, you took it.' : 'Shake it off and run it back.'}</p>}
        <div className="mvf-rewards">
          <div><b>+{result.coins}</b><Icon name="coin" className="mvf-coin" /><span>Coins</span></div>
          <div><b>+{result.xp}</b><span>XP</span></div>
        </div>
        <BeltBar level={level} xp={xp} />
        {result.levelUp ? <p className="mvf-levelup" role="status">Level up! You are now level {result.after.level}.</p> : null}
        <div className="mvf-result-actions">
          {online ? (
            <button type="button" className="mvf-btn orange" onClick={onRematch} disabled={peerGone || rematch.mine}>
              {peerGone ? 'Opponent left' : rematch.mine ? (rematch.theirs ? 'Starting…' : 'Waiting for opponent…') : 'Rematch'}
            </button>
          ) : (
            <button type="button" className="mvf-btn orange" onClick={onNext}>Next fight</button>
          )}
          <button type="button" className="mvf-btn blue" onClick={onMenu}>Menu</button>
        </div>
        {online && rematch.theirs && !rematch.mine ? <p className="mvf-sub" role="status">Your opponent wants a rematch.</p> : null}
      </div>
    </div>
  )
}
