import { createContext, useContext } from 'react'

/** What waits for this person, page by page, shared by the dashboard with its pages (see hooks/useAttention). */
export const AttentionContext = createContext({ pages: {}, total: 0, refresh: () => {} })
export const useWaiting = () => useContext(AttentionContext)
