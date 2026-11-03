import { useState } from 'react'
import Modal from './Modal'

// steps: [{ icon, title, body }]
export default function Tutorial({ title = 'How to play', steps, onClose }) {
  const [i, setI] = useState(0)
  const step = steps[i]
  const last = i === steps.length - 1

  return (
    <Modal title={title} onClose={onClose}>
      <div className="tu-step">
        <div className="tu-icon" aria-hidden="true">{step.icon}</div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
      </div>
      <div className="tu-dots" aria-hidden="true">
        {steps.map((_, n) => <span key={n} className={n === i ? 'on' : ''} />)}
      </div>
      <div className="tu-actions">
        <button className="lg-btn ghost" onClick={() => (i === 0 ? onClose() : setI(i - 1))}>
          {i === 0 ? 'Skip' : 'Back'}
        </button>
        <button className="lg-btn" onClick={() => (last ? onClose() : setI(i + 1))}>
          {last ? 'Got it!' : 'Next'}
        </button>
      </div>
    </Modal>
  )
}
