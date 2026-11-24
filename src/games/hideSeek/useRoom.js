// Mafia Hunt's side of the connection: the running game and its result, on top of the shared room socket.
// Fast-changing data (positions, shots) lives in refs for the canvas; React state only holds what the screens show.
import { useCallback, useRef, useState } from 'react'
import { vibrate } from '../../platform/haptics'
import { useRoomSocket } from '../../platform/multiplayer/useRoomSocket'
import { sfx } from './audio'

export function useRoom() {
  const [game, setGame] = useState(null) // the 'start' message: map, mafia, players
  const [over, setOver] = useState(null)
  const [hud, setHud] = useState(null)
  const snapRef = useRef(null)
  const shotsRef = useRef([])
  const meRef = useRef(null)
  const gameRef = useRef(null)

  const reset = useCallback(() => {
    gameRef.current = null
    snapRef.current = null
    setGame(null)
    setOver(null)
    setHud(null)
  }, [])

  const onMessage = useCallback(m => {
    switch (m.t) {
      case 'joined':
        meRef.current = { id: m.id, code: m.code }
        break
      case 'closed':
        reset()
        break
      case 'room':
        if (m.phase === 'lobby') reset()
        break
      case 'start':
        gameRef.current = m
        snapRef.current = null
        shotsRef.current = []
        setGame(m)
        setOver(null)
        setHud(null)
        sfx(m.mafiaId === m.you ? 'hunt' : 'start')
        break
      case 'state': {
        snapRef.current = m
        for (const s of m.shots || []) {
          shotsRef.current.push({ ...s, t: performance.now() })
          sfx('shot')
          if (s.hit === meRef.current?.id) vibrate([60, 40, 120])
        }
        shotsRef.current = shotsRef.current.slice(-12)
        const next = { phase: m.phase, left: Math.ceil(m.left), alive: m.alive, total: m.total, role: m.me.role, meAlive: m.me.alive, blind: m.me.blind }
        setHud(prev => (prev && Object.keys(next).every(k => prev[k] === next[k]) ? prev : next))
        break
      }
      case 'over': {
        setOver(m)
        const g = gameRef.current
        const iAmMafia = g && g.mafiaId === g.you
        sfx((m.winner === 'mafia') === Boolean(iAmMafia) ? 'win' : 'lose')
        break
      }
      default:
    }
  }, [reset])

  const sock = useRoomSocket({ game: 'hideseek', onMessage })

  return {
    ...sock, game, over, hud, snapRef, shotsRef,
    setDuration: duration => sock.setSettings({ duration }),
    setMap: map => sock.setSettings({ map }),
    leave: () => {
      sock.leave()
      meRef.current = null
      reset()
    },
  }
}
