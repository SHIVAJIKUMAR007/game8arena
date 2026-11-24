// Undercover's side of the connection: the latest private view the server sent, and the four things a player can do.
import { useCallback, useRef, useState } from 'react'
import { vibrate } from '../../platform/haptics'
import { useRoomSocket } from '../../platform/multiplayer/useRoomSocket'
import { sfx } from './audio'
import { iWon } from './outcome'

export function useUndercover() {
  const [state, setState] = useState(null) // { view, at }: the server's view and when it arrived, for the countdown
  const last = useRef(null)

  const onMessage = useCallback(m => {
    if (m.t === 'closed' || (m.t === 'room' && m.phase === 'lobby')) {
      last.current = null
      setState(null)
    } else if (m.t === 'ustate') {
      const before = last.current
      if (m.phase !== before?.phase) {
        if (m.phase === 'over') sfx(iWon(m) ? 'win' : 'lose')
        else if (m.phase === 'result' || m.phase === 'guess') sfx('out')
        else if (m.phase === 'vote') sfx('vote')
      }
      if (m.phase === 'clue' && m.turnId === m.you.id && before?.turnId !== m.you.id) {
        sfx('turn')
        vibrate(60)
      }
      last.current = m
      setState({ view: m, at: Date.now() })
    }
  }, [])

  const sock = useRoomSocket({ game: 'undercover', onMessage })
  const { send } = sock
  const act = useCallback((a, extra) => send({ t: 'uc', a, ...extra }), [send])

  return {
    ...sock,
    view: state?.view ?? null,
    receivedAt: state?.at ?? 0,
    ready: () => act('ready'),
    clue: text => act('clue', { text }),
    vote: target => act('vote', { target }),
    guess: text => act('guess', { text }),
  }
}
