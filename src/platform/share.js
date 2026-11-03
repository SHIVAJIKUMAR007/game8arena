import { showToast } from './toast'

export async function shareResult({ title, text, url = window.location.href }) {
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url })
      return 'shared'
    }
    await navigator.clipboard.writeText(`${text}\n${url}`)
    showToast({ icon: '📋', title: 'Copied to clipboard', body: 'Paste it anywhere to share' })
    return 'copied'
  } catch {
    return 'cancelled'
  }
}
