import { useState } from 'react'
import Modal from '../../platform/ui/Modal'
import { updateSettings, useSettings } from '../../platform/settings'
import { useStore } from '../../platform/storage'
import { BACKGROUNDS, BOTTLE_STYLES } from './economy'
import { buyItem, equipItem, familyStore, resetFamily, setSetting } from './store'
import { sfx } from './audio'

function ShopRow({ kind, items, owned, equipped, coins }) {
  return (
    <ul className="fs-shop">
      {items.map(item => {
        const has = owned.includes(item.id)
        const on = equipped === item.id
        return (
          <li key={item.id} className={on ? 'on' : ''}>
            <span className="fs-shop-name">{item.name}</span>
            {on ? (
              <span className="fs-shop-state">In use</span>
            ) : has ? (
              <button type="button" className="lg-btn ghost" onClick={() => equipItem(kind, item.id)}>Use</button>
            ) : (
              <button
                type="button"
                className="lg-btn"
                disabled={coins < item.price}
                onClick={() => buyItem(kind, item.id) && sfx('coin')}
                aria-label={`Buy ${item.name} for ${item.price} coins`}
              >
                🪙 {item.price}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Sound, music and other settings, the restart option, and the shop for bottle styles and backgrounds. */
export default function FamilySettings({ onClose, onRestart, onHelp }) {
  const s = useSettings()
  const save = useStore(familyStore)
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <Modal title="Settings" onClose={onClose}>
      <label className="st-row">
        <span>Sound effects</span>
        <input type="checkbox" checked={s.sound} onChange={e => updateSettings({ sound: e.target.checked })} />
      </label>
      <label className="st-row">
        <span>Music</span>
        <input type="checkbox" checked={save.settings.music} onChange={e => setSetting({ music: e.target.checked })} />
      </label>
      <label className="st-row">
        <span>Volume</span>
        <input type="range" min="0" max="1" step="0.05" value={s.volume} disabled={!s.sound} onChange={e => updateSettings({ volume: Number(e.target.value) })} />
      </label>
      <label className="st-row">
        <span>Vibration (mobile)</span>
        <input type="checkbox" checked={s.haptics} onChange={e => updateSettings({ haptics: e.target.checked })} />
      </label>
      <label className="st-row">
        <span>Colour symbols on liquids</span>
        <input type="checkbox" checked={save.settings.symbols} onChange={e => setSetting({ symbols: e.target.checked })} />
      </label>
      <label className="st-row">
        <span>Animations</span>
        <select value={s.motion} onChange={e => updateSettings({ motion: e.target.value })}>
          <option value="system">Follow my device</option>
          <option value="reduce">Reduce motion</option>
          <option value="full">Full motion</option>
        </select>
      </label>

      <h3 className="fs-h3">Bottle styles</h3>
      <ShopRow kind="bottles" items={BOTTLE_STYLES} owned={save.owned.bottles} equipped={save.equipped.bottle} coins={save.coins} />
      <h3 className="fs-h3">Backgrounds</h3>
      <ShopRow kind="backgrounds" items={BACKGROUNDS} owned={save.owned.backgrounds} equipped={save.equipped.background} coins={save.coins} />

      <div className="st-row">
        <span>This level</span>
        <span className="fs-actions">
          <button type="button" className="lg-btn ghost" onClick={onHelp}>How to play</button>
          <button type="button" className="lg-btn" onClick={() => { onRestart(); onClose() }}>Restart</button>
        </span>
      </div>
      <div className="st-row">
        <span>Family Sort progress</span>
        {confirmReset ? (
          <button type="button" className="st-danger" onClick={() => { resetFamily(); window.location.reload() }}>Yes, erase it</button>
        ) : (
          <button type="button" className="st-danger" onClick={() => setConfirmReset(true)}>Reset…</button>
        )}
      </div>
    </Modal>
  )
}
