// <Seo> sets the page's title, meta description, canonical URL, social tags and structured data.
// In the browser it updates <head>; during prerendering it hands the tags to the build script via context.
import { useContext, useEffect } from 'react'
import { applyHead, buildHead } from './head'
import { HeadContext } from './headContext'

export default function Seo(props) {
  const collect = useContext(HeadContext)
  const head = buildHead(props)
  if (collect) collect(head) // server render only: the last <Seo> rendered wins
  const key = JSON.stringify(head)
  useEffect(() => {
    applyHead(JSON.parse(key))
  }, [key])
  return null
}
