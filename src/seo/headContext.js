import { createContext } from 'react'

// During prerendering this holds a callback that receives the page's head tags; in the browser it is null.
export const HeadContext = createContext(null)
