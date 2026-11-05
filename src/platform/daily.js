// Daily challenge: each calendar day picks 3 games (the same 3 for everyone), one level each.
// Finishing all of the day's games keeps one overall streak going.
import { updateProgress } from './progress'
import { createRng } from './rng'
import { createPersistentStore, useStore } from './storage'

export const DAILY_COUNT = 3

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const yesterdayKey = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return todayKey(d)
}

export const dailySeed = gameId => `${gameId}:daily:${todayKey()}`

/** Today's games: a date-seeded pick of `count` ids (order-independent, so everyone gets the same set). */
export function pickDaily(ids, key = todayKey(), count = DAILY_COUNT) {
  return createRng(`daily-pick:${key}`).shuffle([...ids].sort()).slice(0, Math.min(count, ids.length))
}

// Overall daily progress, shared by all games.
const dailyStore = createPersistentStore('daily', { last: null, streak: 0, best: 0, days: {} })
export const useDaily = () => useStore(dailyStore)

/** Streak that is still alive today (finished today or yesterday), else 0. */
const liveStreak = d => (d.last === todayKey() || d.last === yesterdayKey() ? d.streak : 0)

/** { done: ids finished today, complete: all of `picks` done, streak } */
export function overallDaily(picks, d = dailyStore.get()) {
  const done = d.days[todayKey()] || []
  return { done, complete: picks.length > 0 && picks.every(id => done.includes(id)), streak: liveStreak(d) }
}

/** Record a finished daily level. `picks` = today's games; the streak grows once all of them are done. */
export function completeDaily(gameId, { stars, score }, picks = [gameId]) {
  const today = todayKey()
  dailyStore.set(d => {
    const doneToday = [...new Set([...(d.days[today] || []), gameId])]
    // Keep two weeks of history.
    const days = Object.fromEntries(Object.entries({ ...d.days, [today]: doneToday }).sort().slice(-14))
    const complete = picks.every(id => doneToday.includes(id))
    if (!complete || d.last === today) return { ...d, days }
    const streak = d.last === yesterdayKey() ? d.streak + 1 : 1
    return { last: today, streak, best: Math.max(d.best, streak), days }
  })
  const streak = liveStreak(dailyStore.get())
  updateProgress(gameId, p => ({
    ...p,
    daily: {
      last: today,
      streak, // mirrors the overall streak, so per-game "daily streak" achievements keep working
      best: Math.max(p.daily.best, streak),
      history: { ...p.daily.history, [today]: { stars, score } },
    },
  }))
}

/** This game's daily state for its menu: done today?, plus the overall streak. */
export function dailyState(progress) {
  return { done: progress.daily.last === todayKey(), streak: liveStreak(dailyStore.get()) }
}
