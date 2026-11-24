// Tic Tac Toe's side of the connection: the latest board the host sent, and the one thing a player can do.
import { useCallback, useRef, useState } from 'react'
import { vibrate } from '../../platform/haptics'
import { useRoomSocket } from '../../platform/multiplayer/useRoomSocket'
import { sfx } from './audio'

const count = board => board.filter(Boolean).length

export function useTicTacToe() {
  const [view, setView] = useState(null)
  const [at, setAt] = useState(0)
  const last = useRef(null)

  const onMessage = useCallback(m => {
    if (m.t === 'closed' || (m.t === 'room' && m.phase === 'lobby')) {
      last.current = null
      setView(null)
    } else if (m.t === 'tstate') {
      const before = last.current
      const placed = before?.game === m.game && count(m.board) > count(before.board)
      if (m.phase === 'over' && before?.phase !== 'over') sfx(m.seriesWinnerId === m.you.id ? 'win' : m.seriesWinnerId ? 'lose' : 'draw')
      else if (m.phase === 'between' && before?.phase !== 'between') sfx(m.last?.winnerId === m.you.id ? 'win' : m.last?.winnerId ? 'lose' : 'draw')
      else if (placed) sfx('place')
      if (m.phase === 'play' && m.turnId === m.you.id && before && (before.turnId !== m.you.id || before.game !== m.game)) vibrate(40)
      last.current = m
      setView(m)
      setAt(Date.now())
    }
  }, [])

  const sock = useRoomSocket({ game: 'tictactoe', onMessage })
  const { send } = sock
  return {
    ...sock,
    view,
    receivedAt: at,
    move: useCallback(cell => send({ t: 'ttt', a: 'move', cell }), [send]),
  }
}
