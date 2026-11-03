// Generic achievements. A game supplies definitions:
//   { id, icon, title, description, check(stats, ctx, progress) => boolean }
// The platform stores unlocks and shows a toast.
import { getProgress, updateProgress } from './progress'
import { showToast } from './toast'
import { playSound } from './sound'
import { track } from './analytics'

export function checkAchievements(gameId, defs, ctx = {}) {
  const p = getProgress(gameId)
  const unlocked = defs.filter(d => !p.achievements[d.id] && d.check(p.stats, ctx, p))
  if (!unlocked.length) return
  const now = Date.now()
  updateProgress(gameId, cur => ({
    ...cur,
    achievements: { ...cur.achievements, ...Object.fromEntries(unlocked.map(d => [d.id, now])) },
  }))
  unlocked.forEach(d => {
    showToast({ icon: d.icon, title: 'Achievement unlocked', body: d.title })
    track('achievement', { game: gameId, id: d.id })
  })
  playSound('hint')
}
