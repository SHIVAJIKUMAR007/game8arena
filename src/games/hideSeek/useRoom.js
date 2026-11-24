// The connection to the game server and everything it tells us: room, lobby, the running game and the result.
// Fast-changing data (positions, shots) lives in refs for the canvas; React state only holds what the screens show.
import { useCallback, useEffect, useRef, useState } from 'react'
import { vibrate } from '../../platform/haptics'
import { serverUrl } from './net'
import { sfx } from './audio'

export function useRoom() {
  const [conn, setConn] = useState('connecting') // 'connecting' | 'open' | 'closed'
  const [attempt, setAttempt] = useState(0)
  const [me, setMe] = useState(null) // { id, code }
  const [room, setRoom] = useState(null)
  const [game, setGame] = useState(null) // the 'start' message: map, mafia, players
  const [over, setOver] = useState(null)
  const [hud, setHud] = useState(null)
  const [error, setError] = useState('')
  const ws = useRef(null)
  const snapRef = useRef(null)
  const shotsRef = useRef([])
  const meRef = useRef(null)
  const gameRef = useRef(null)

  useEffect(() => {
    let socket
    let dead = false
    try {
      socket = new WebSocket(serverUrl())
    } catch {
      setConn('closed')
      return undefined
    }
    ws.current = socket
    socket.onopen = () => !dead && setConn('open')
    socket.onclose = () => {
      if (dead) return
      setConn('closed')
      setRoom(null)
      setMe(null)
      setGame(null)
      setOver(null)
    }
    socket.onmessage = e => {
      let m
      try { m = JSON.parse(e.data) } catch { return }
      switch (m.t) {
        case 'joined':
          meRef.current = { id: m.id, code: m.code }
          setMe(meRef.current)
          setError('')
          break
        case 'room':
          setRoom(m)
          if (m.phase === 'lobby') {
            gameRef.current = null
            snapRef.current = null
            setGame(null)
            setOver(null)
            setHud(null)
          }
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
        case 'error':
          setError(m.message)
          break
        default:
      }
    }
    return () => {
      dead = true
      socket.onclose = null
      socket.close()
    }
  }, [attempt])

  const send = useCallback(msg => {
    if (ws.current?.readyState === 1) ws.current.send(JSON.stringify(msg))
  }, [])

  return {
    conn, me, room, game, over, hud, error, snapRef, shotsRef,
    send,
    retry: () => {
      setConn('connecting')
      setError('')
      setAttempt(a => a + 1)
    },
    create: name => send({ t: 'create', name }),
    join: (code, name) => send({ t: 'join', code, name }),
    setDuration: duration => send({ t: 'settings', duration }),
    setMap: map => send({ t: 'settings', map }),
    start: () => send({ t: 'start' }),
    toLobby: () => send({ t: 'lobby' }),
    leave: () => {
      send({ t: 'leave' })
      meRef.current = null
      setRoom(null)
      setMe(null)
      setGame(null)
      setOver(null)
    },
    clearError: () => setError(''),
  }
}
