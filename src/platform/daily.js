// Daily challenge helpers: one shared seed per calendar day + a streak counter.
import { updateProgress } from './progress'

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const yesterdayKey = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return todayKey(d)
}

export const dailySeed = gameId => `${gameId}:daily:${todayKey()}`

export function completeDaily(gameId, { stars, score }) {
  const today = todayKey()
  updateProgress(gameId, p => {
    if (p.daily.last === today) return p // streak only counts once per day
    const streak = p.daily.last === yesterdayKey() ? p.daily.streak + 1 : 1
    return {
      ...p,
      daily: {
        last: today,
        streak,
        best: Math.max(p.daily.best, streak),
        history: { ...p.daily.history, [today]: { stars, score } },
      },
    }
  })
}

export function dailyState(progress) {
  const today = todayKey()
  const done = progress.daily.last === today
  const alive = done || progress.daily.last === yesterdayKey()
  return { done, streak: alive ? progress.daily.streak : 0 }
}
