// Bingo Royale's side of the connection: the latest game state, your draft board, and what a player can do.
import { useCallback, useRef, useState } from 'react'
import { vibrate } from '../../platform/haptics'
import { useRoomSocket } from '../../platform/multiplayer/useRoomSocket'
import { sfx } from './audio'
import { emptyBoard } from './boardSetup'

export function useBingo() {
  const [view, setView] = useState(null)
  const [at, setAt] = useState(0)
  const [draft, setDraft] = useState(emptyBoard) // the board being arranged; kept between games so "play again" is quick
  const last = useRef(null)

  const onMessage = useCallback(m => {
    if (m.t === 'closed' || (m.t === 'room' && m.phase === 'lobby')) {
      last.current = null
      setView(null)
    } else if (m.t === 'bstate') {
      const before = last.current
      const mine = m.players.find(p => p.id === m.you)
      const was = before?.players.find(p => p.id === m.you)
      if (m.phase === 'over' && before?.phase !== 'over') sfx(m.winners.includes(m.you) ? 'win' : 'lose')
      else if (m.called.length > (before?.called.length ?? 0)) {
        if (mine && was && mine.count > was.count) {
          sfx('line')
          vibrate([30, 40, 60])
        } else sfx('call')
      }
      if (m.phase === 'play' && m.turnId === m.you && before?.turnId !== m.you) {
        sfx('turn')
        vibrate(40)
      }
      last.current = m
      setView(m)
      setAt(Date.now())
    }
  }, [])

  const sock = useRoomSocket({ game: 'bingo', onMessage })
  const { send } = sock
  return {
    ...sock,
    view,
    receivedAt: at,
    draft,
    setDraft,
    confirmBoard: useCallback(cells => send({ t: 'bingo', a: 'board', cells }), [send]),
    editBoard: useCallback(() => send({ t: 'bingo', a: 'edit' }), [send]),
    call: useCallback(n => send({ t: 'bingo', a: 'call', n }), [send]),
    playAgain: useCallback(() => send({ t: 'lobby', keep: true }), [send]),
  }
}
