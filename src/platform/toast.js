import { createStore } from './storage'

export const toastStore = createStore([])
let nextToast = 1

export function showToast({ icon = '🏆', title, body = '', ms = 3500 }) {
  const id = nextToast++
  toastStore.set(list => [...list, { id, icon, title, body }])
  setTimeout(() => toastStore.set(list => list.filter(t => t.id !== id)), ms)
}
