import { useCallback, useEffect, useRef, useState } from "react"
import { errorMessage, getNotifications } from "@/lib/api/notifications"
import type { NotificationList } from "@/lib/types/notifications"

const EVENT = "notifications:changed"

/** Tells every bell, page and card to reload (after something was marked read, a test was sent, and so on). */
export function announceNotificationsChanged() {
  window.dispatchEvent(new Event(EVENT))
}

interface Feed {
  data: NotificationList | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/** Loads a person's notifications. Reloads on member change, on the shared change event and (optionally) every 60 s while the tab is visible. */
export function useNotificationFeed(token: string, memberId: string, opts: { unreadOnly: boolean; poll?: boolean }): Feed {
  const { unreadOnly, poll = false } = opts
  const [data, setData] = useState<NotificationList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)
  const seq = useRef(0)

  const refresh = useCallback(async () => {
    const mine = ++seq.current
    try {
      const res = await getNotifications(token, memberId, unreadOnly)
      if (!alive.current || mine !== seq.current) return
      setData(res)
      setError(null)
    } catch (e) {
      if (!alive.current || mine !== seq.current) return
      setError(errorMessage(e))
    } finally {
      if (alive.current && mine === seq.current) setLoading(false)
    }
  }, [token, memberId, unreadOnly])

  useEffect(() => {
    alive.current = true
    setData(null)
    setLoading(true)
    setError(null)
    void refresh()
    const onChange = () => void refresh()
    window.addEventListener(EVENT, onChange)
    let timer: ReturnType<typeof setInterval> | undefined
    if (poll) {
      timer = setInterval(() => {
        if (document.visibilityState === "visible") void refresh()
      }, 60_000)
    }
    return () => {
      alive.current = false
      window.removeEventListener(EVENT, onChange)
      if (timer) clearInterval(timer)
    }
  }, [refresh, poll])

  return { data, loading, error, refresh }
}
