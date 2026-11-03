import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({ title, onClose, children }) {
  const ref = useRef(null)

  useEffect(() => {
    const prev = document.activeElement
    ref.current?.focus()
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])

  return createPortal(
    <div className="md-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="md" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="md-head">
          <h2>{title}</h2>
          <button className="md-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className="md-body">{children}</div>
      </div>
    </div>,
    document.body
  )
}
