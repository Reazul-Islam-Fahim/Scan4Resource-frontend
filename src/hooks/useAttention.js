import { useCallback, useEffect, useRef, useState } from 'react'
import { CHANGED, isMock } from '../lib/api'
import { fetchAttention, markSeen } from '../lib/auth'

const EVERY_MS = 30_000
const SEEN_PAGES = ['orders', 'tenders'] // pages whose number counts new things since the last visit
const TITLE = document.title

/** What waits for this person, page by page ({ verification: 2, orders: 1 }), kept fresh: every 30 seconds,
 *  on every page change, after every change the person makes and when the tab comes back into view. The browser tab title shows the total. */
export default function useAttention(token, page) {
  const [pages, setPages] = useState({})
  const busy = useRef(false)

  const refresh = useCallback(async () => {
    if (!token || isMock || busy.current) return
    busy.current = true
    try {
      const data = await fetchAttention(token)
      setPages(data?.pages ?? {})
    } catch {
      // keep the last numbers; the next round tries again
    } finally {
      busy.current = false
    }
  }, [token])

  // opening a page: mark it seen first, so its "new" count drops right away
  useEffect(() => {
    if (!token || isMock) return
    if (SEEN_PAGES.includes(page)) {
      setPages((current) => (current[page] ? { ...current, [page]: 0 } : current))
      markSeen(token, page).catch(() => {}).finally(refresh)
    } else {
      refresh()
    }
  }, [token, page, refresh])

  useEffect(() => {
    if (!token || isMock) return undefined
    const timer = setInterval(() => document.visibilityState === 'visible' && refresh(), EVERY_MS)
    const onShow = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onShow)
    window.addEventListener('focus', onShow)
    const onChange = () => setTimeout(refresh, 300)
    window.addEventListener(CHANGED, onChange)
    return () => {
      window.removeEventListener(CHANGED, onChange)
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onShow)
      window.removeEventListener('focus', onShow)
    }
  }, [token, refresh])

  const total = Object.values(pages).reduce((sum, n) => sum + (n || 0), 0)
  useEffect(() => {
    document.title = total > 0 ? `(${total}) ${TITLE}` : TITLE
    return () => {
      document.title = TITLE
    }
  }, [total])

  return { pages, total, refresh }
}
