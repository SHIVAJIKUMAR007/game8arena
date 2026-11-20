import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Every new page opens at the top. Back/forward keep the browser's own restore, and #anchor links
// (like the blog table of contents) scroll to their target instead.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const type = useNavigationType()
  useEffect(() => {
    if (type === 'POP') return
    if (hash) {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
      return
    }
    window.scrollTo(0, 0)
  }, [pathname, hash, type])
  return null
}
