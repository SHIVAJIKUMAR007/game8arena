// Multiplayer Tambola's side of the connection: the latest round state from the room host, plus what a player can do.
// The host (see server/tambola.js) calls the numbers and keeps every player's marks, so the page only sends taps.
import { useCallback, useRef, useState } from 'react'
import { vibrate } from '../../platform/haptics'
import { useRoomSocket } from '../../platform/multiplayer/useRoomSocket'
import { playSound } from '../../platform/sound'

export function useTambolaRoom() {
  const [view, setView] = useState(null)
  const [at, setAt] = useState(0) // when the latest state arrived, so countdowns can run between updates
  const last = useRef(null)

  const onMessage = useCallback(m => {
    if (m.t === 'closed' || (m.t === 'room' && m.phase === 'lobby')) {
      last.current = null
      setView(null)
    } else if (m.t === 'tmstate') {
      const before = last.current
      const mine = m.players.find(p => p.id === m.you)
      const was = before?.players.find(p => p.id === m.you)
      if (m.phase === 'over' && before?.phase !== 'over') playSound(m.winners.includes(m.you) ? 'win' : 'lose')
      else if (was?.active && mine && !mine.active) {
        playSound('lose')
        vibrate([60, 40, 120])
      } else if (mine && mine.prizes.length > (was?.prizes.length ?? 0)) playSound('win')
      else if (m.called.length > (before?.called.length ?? 0)) {
        playSound('tap')
        if (m.due.length) vibrate(40)
      }
      last.current = m
      setView(m)
      setAt(Date.now())
    }
  }, [])

  const sock = useRoomSocket({ game: 'tambola', onMessage })
  const { send } = sock
  return {
    ...sock,
    view,
    receivedAt: at,
    mark: useCallback((n, ticket) => send({ t: 'tb', a: 'mark', n, ticket }), [send]),
    claim: useCallback(() => send({ t: 'tb', a: 'claim' }), [send]),
    playAgain: useCallback(() => send({ t: 'lobby', keep: true }), [send]),
  }
}
