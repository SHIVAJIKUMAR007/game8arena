// Multiverse Fighter container. A plain `screen` state (no router) moves between the menu, fighter select, the VS
// screen, the online lobby, the fight and the result. It also owns the online session once the lobby hands it over,
// builds the match setup (stats, seed, names), and applies win and loss rewards. Rules live in engine/, drawing in
// engine/render.js, saving in store.js and networking in netcode.js.
import { useCallback, useEffect, useRef, useState } from 'react'
import FightScreen from './FightScreen'
import Lobby from './Lobby'
import { FighterSelect, MainMenu, ResultScreen, VsScreen } from './Screens'
import { fighterById, isFighterId, statsFor } from './roster'
import { aiProfile, applyFightResult, getMv, pickOpponent, updateMv, upgradesOf, useMv } from './store'
import './MultiverseGame.css'

const randomSeed = () => Math.floor(Math.random() * 0xffffffff)

export default function MultiverseGame() {
  const save = useMv()
  const [screen, setScreen] = useState('menu')
  const [opp, setOpp] = useState(() => pickOpponent(getMv().selected))
  const [match, setMatch] = useState(null)
  const [result, setResult] = useState(null)
  const [rematch, setRematch] = useState({ mine: false, theirs: false })
  const [peerGone, setPeerGone] = useState(false)
  const netRef = useRef(null)
  const netUnsubs = useRef([])
  const matchRef = useRef(null)

  useEffect(() => {
    matchRef.current = match
  })

  const closeNet = useCallback(() => {
    netUnsubs.current.forEach(u => u())
    netUnsubs.current = []
    netRef.current?.close()
    netRef.current = null
    setPeerGone(false)
    setRematch({ mine: false, theirs: false })
  }, [])

  useEffect(() => closeNet, [closeNet])

  const goMenu = useCallback(() => {
    closeNet()
    setMatch(null)
    setScreen('menu')
  }, [closeNet])

  // ── online ──
  const startOnline = useCallback(({ seed, chars }) => {
    const net = netRef.current
    if (!net) return
    const me = net.role === 'host' ? 0 : 1
    setMatch({
      mode: net.role,
      online: true,
      chars,
      stats: chars.map(id => statsFor(fighterById(id))),
      seed,
      level: 1,
      me,
      net,
      names: me === 0 ? ['You', 'Opponent'] : ['Opponent', 'You'],
    })
    setRematch({ mine: false, theirs: false })
    setPeerGone(false)
    setScreen('vs')
  }, [])

  const hostStart = useCallback(
    chars => {
      const net = netRef.current
      if (!net) return
      const seed = randomSeed()
      net.sendControl({ t: 'start', seed, chars })
      startOnline({ seed, chars })
    },
    [startOnline],
  )

  const onSession = useCallback(
    session => {
      if (netRef.current && netRef.current !== session) closeNet()
      netRef.current = session
      netUnsubs.current.push(
        session.onStatus(s => {
          if (s.type === 'left' || s.type === 'lost') setPeerGone(true)
          else if (s.type === 'back') setPeerGone(false)
        }),
        session.onControl(msg => {
          if (msg.t === 'rematch') setRematch(r => ({ ...r, theirs: true }))
          else if (msg.t === 'start' && session.role === 'guest') {
            const ok = Array.isArray(msg.chars) && msg.chars.length === 2 && msg.chars.every(isFighterId) && Number.isFinite(msg.seed)
            if (ok) startOnline({ seed: msg.seed, chars: msg.chars })
          }
        }),
      )
    },
    [closeNet, startOnline],
  )

  useEffect(() => {
    if (screen === 'result' && match?.online && rematch.mine && rematch.theirs && netRef.current?.role === 'host') hostStart(match.chars)
  }, [screen, match, rematch, hostStart])

  // ── versus the computer ──
  const startLocal = () => {
    const s = getMv()
    const profile = aiProfile(s.level)
    const mine = fighterById(s.selected)
    const theirs = fighterById(opp)
    setMatch({
      mode: 'local',
      online: false,
      chars: [mine.id, theirs.id],
      stats: [statsFor(mine, upgradesOf(s, mine.id)), statsFor(theirs, {}, profile.scale)],
      seed: randomSeed(),
      level: s.level,
      me: 0,
      net: null,
      names: ['You', theirs.name],
    })
    setScreen('fight')
  }

  const handleEnd = useCallback(r => {
    const won = r.winner === r.me
    const before = getMv()
    const out = applyFightResult(before, { won })
    updateMv(() => out.save)
    setResult({
      won,
      coins: out.coins,
      xp: out.xp,
      levelUp: out.levelUp,
      before: { level: before.level, xp: before.xp },
      after: { level: out.save.level, xp: out.save.xp },
      reason: r.reason,
    })
    setScreen('result')
  }, [])

  const goFight = useCallback(() => setScreen('fight'), [])
  const online = Boolean(match?.online)

  let body = null
  if (screen === 'menu') {
    body = (
      <MainMenu
        onVs={() => {
          setOpp(pickOpponent(save.selected))
          setScreen('vs')
          setMatch(null)
        }}
        onOnline={() => setScreen('lobby')}
        onFighters={() => setScreen('select')}
      />
    )
  } else if (screen === 'select') {
    body = <FighterSelect onBack={() => setScreen('menu')} />
  } else if (screen === 'lobby') {
    body = <Lobby onSession={onSession} onStart={hostStart} onBack={goMenu} />
  } else if (screen === 'vs') {
    const meId = match?.online ? match.chars[match.me] : save.selected
    const oppId = match?.online ? match.chars[1 - match.me] : opp
    body = <VsScreen meId={meId} oppId={oppId} online={Boolean(match?.online)} level={save.level} onBack={goMenu} onFight={match?.online ? goFight : startLocal} />
  } else if (screen === 'fight' && match) {
    body = <FightScreen key={`${match.seed}-${match.me}`} match={match} onEnd={handleEnd} onQuit={goMenu} />
  } else if (screen === 'result' && result) {
    body = (
      <ResultScreen
        result={result}
        online={online}
        peerGone={peerGone}
        rematch={rematch}
        onNext={() => {
          setOpp(pickOpponent(save.selected))
          setScreen('vs')
        }}
        onMenu={goMenu}
        onRematch={() => {
          setRematch(r => ({ ...r, mine: true }))
          netRef.current?.sendControl({ t: 'rematch' })
        }}
      />
    )
  }

  return (
    <div className="mvf">
      <div className="mvf-stage">{body}</div>
      <p className="mvf-hint">Turn your phone sideways for a bigger arena.</p>
      <p className="mvf-keys">
        <kbd>A</kbd> <kbd>D</kbd> move · <kbd>W</kbd> jump · <kbd>S</kbd> crouch and block · <kbd>J</kbd> punch · <kbd>I</kbd> heavy punch · <kbd>L</kbd> kick · <kbd>K</kbd> flying kick · <kbd>Space</kbd> special when the cyan bar is full · <kbd>P</kbd> pause
      </p>
    </div>
  )
}
