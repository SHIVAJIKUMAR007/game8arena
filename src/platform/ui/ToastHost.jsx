import { toastStore } from '../toast'
import { useStore } from '../storage'

export default function ToastHost() {
  const toasts = useStore(toastStore)
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className="toast">
          <span className="toast-icon" aria-hidden="true">{t.icon}</span>
          <div><b>{t.title}</b><div>{t.body}</div></div>
        </div>
      ))}
    </div>
  )
}
