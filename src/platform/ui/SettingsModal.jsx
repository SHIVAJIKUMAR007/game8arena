import Modal from './Modal'
import { THEMES, updateSettings, useSettings } from '../settings'
import { setAnalyticsConsent, useConsent } from '../analytics'
import { resetAllProgress } from '../progress'
import { playSound } from '../sound'

export default function SettingsModal({ onClose }) {
  const s = useSettings()
  const consent = useConsent()

  return (
    <Modal title="Settings" onClose={onClose}>
      <label className="st-row">
        <span>Sound effects</span>
        <input type="checkbox" checked={s.sound} onChange={e => updateSettings({ sound: e.target.checked })} />
      </label>
      <label className="st-row">
        <span>Volume</span>
        <input
          type="range" min="0" max="1" step="0.05" value={s.volume} disabled={!s.sound}
          onChange={e => updateSettings({ volume: Number(e.target.value) })}
          onPointerUp={() => playSound('tap')}
        />
      </label>
      <label className="st-row">
        <span>Vibration (mobile)</span>
        <input type="checkbox" checked={s.haptics} onChange={e => updateSettings({ haptics: e.target.checked })} />
      </label>
      <label className="st-row">
        <span>Theme</span>
        <select value={s.theme} onChange={e => updateSettings({ theme: e.target.value })}>
          {THEMES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>
      <label className="st-row">
        <span>Animations</span>
        <select value={s.motion} onChange={e => updateSettings({ motion: e.target.value })}>
          <option value="system">Follow my device</option>
          <option value="reduce">Reduce motion</option>
          <option value="full">Full motion</option>
        </select>
      </label>
      <label className="st-row">
        <span>Anonymous analytics</span>
        <input type="checkbox" checked={consent.analytics === true} onChange={e => setAnalyticsConsent(e.target.checked)} />
      </label>
      <div className="st-row">
        <span>Saved progress</span>
        <button
          className="st-danger"
          onClick={() => window.confirm('Erase ALL saved progress for every game? This cannot be undone.') && resetAllProgress()}
        >
          Reset everything
        </button>
      </div>
    </Modal>
  )
}
