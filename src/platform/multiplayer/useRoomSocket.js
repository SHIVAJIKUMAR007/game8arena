// The part of a multiplayer game every game shares: the connection to the room host (a browser tab, or a LAN server),
// the room you are in and its lobby.
// A game passes `onMessage` to react to its own messages (the game state, the result...) and gets back what the
// lobby needs. Messages the hook handles itself: joined, room, error. Everything is also passed on to onMessage,
// plus { t: 'closed' } when the connection drops.
import { useCallback, useEffect, useRef, useState } from 'react'
import { serverUrl, signalBase, transportMode } from './net'
import { createP2PSocket } from './p2p'

/**
 * @param {{ game: string, onMessage?: (msg: object) => void }} opts
 */
export function useRoomSocket({ game, onMessage }) {
  const [conn, setConn] = useState('connecting') // 'connecting' | 'open' | 'closed'
  const [mode, setMode] = useState('p2p') // 'p2p' (a browser hosts the room) | 'ws' (a Node game server does)
  const [attempt, setAttempt] = useState(0)
  const [me, setMe] = useState(null) // { id, code }
  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const ws = useRef(null)
  const handler = useRef(onMessage)
  useEffect(() => {
    handler.current = onMessage
  })

  useEffect(() => {
    let socket
    let dead = false
    try {
      const chosen = transportMode()
      setMode(chosen) // eslint-disable-line react-hooks/set-state-in-effect
      socket = chosen === 'p2p' ? createP2PSocket({ signalBase: signalBase() }) : new WebSocket(serverUrl())
    } catch {
      setConn('closed') // eslint-disable-line react-hooks/set-state-in-effect
      return undefined
    }
    ws.current = socket
    socket.onopen = () => !dead && setConn('open')
    socket.onclose = () => {
      if (dead) return
      setConn('closed')
      setRoom(null)
      setMe(null)
      setError('')
      handler.current?.({ t: 'closed' })
    }
    socket.onmessage = e => {
      let m
      try { m = JSON.parse(e.data) } catch { return }
      if (m.t === 'joined') {
        setMe({ id: m.id, code: m.code })
        setError('')
      } else if (m.t === 'room') setRoom(m)
      else if (m.t === 'error') setError(m.message)
      handler.current?.(m)
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
    conn, mode, me, room, error, send,
    retry: () => {
      setConn('connecting')
      setError('')
      setAttempt(a => a + 1)
    },
    create: name => send({ t: 'create', name, game }),
    join: (code, name) => send({ t: 'join', code, name, game }),
    setSettings: patch => send({ t: 'settings', ...patch }),
    start: () => send({ t: 'start' }),
    toLobby: () => send({ t: 'lobby' }),
    leave: () => {
      send({ t: 'leave' })
      setRoom(null)
      setMe(null)
    },
    clearError: () => setError(''),
  }
}
