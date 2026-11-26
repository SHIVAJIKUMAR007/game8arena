// Input for the fight: keyboard and on-screen touch controls merged into one INPUT bitmask per tick.
// The engine reads mask() once per simulation step. Touch buttons call setTouch(bit, on) from pointer events, so
// several fingers can hold different bits at once. All listeners are removed by dispose().
import { INPUT } from './sim'

const KEYS = {
  KeyW: INPUT.UP, ArrowUp: INPUT.UP,
  KeyS: INPUT.DOWN, ArrowDown: INPUT.DOWN,
  KeyA: INPUT.LEFT, ArrowLeft: INPUT.LEFT,
  KeyD: INPUT.RIGHT, ArrowRight: INPUT.RIGHT,
  KeyJ: INPUT.PUNCH, KeyI: INPUT.HEAVY, KeyK: INPUT.FKICK, KeyL: INPUT.KICK,
  Space: INPUT.SPECIAL,
}

/**
 * @param {{ target?: Window, onPause?: () => void, onGesture?: () => void }} [opts]
 */
export function createInput({ target = window, onPause, onGesture } = {}) {
  let keys = 0
  let touch = 0
  const down = e => {
    onGesture?.()
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (!e.repeat) onPause?.()
      e.preventDefault()
      return
    }
    const bit = KEYS[e.code]
    if (!bit) return
    keys |= bit
    e.preventDefault()
  }
  const up = e => {
    const bit = KEYS[e.code]
    if (bit) keys &= ~bit
  }
  const clear = () => {
    keys = 0
    touch = 0
  }
  const gesture = () => onGesture?.()
  target.addEventListener('keydown', down)
  target.addEventListener('keyup', up)
  target.addEventListener('blur', clear)
  target.addEventListener('pointerdown', gesture)
  return {
    mask: () => keys | touch,
    setTouch(bit, on) {
      touch = on ? touch | bit : touch & ~bit
    },
    clear,
    dispose() {
      target.removeEventListener('keydown', down)
      target.removeEventListener('keyup', up)
      target.removeEventListener('blur', clear)
      target.removeEventListener('pointerdown', gesture)
      clear()
    },
  }
}
