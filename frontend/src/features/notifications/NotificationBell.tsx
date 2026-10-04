import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import { Bell } from "lucide-react"
import { useSession } from "@/state/SessionContext"
import { ErrorNote } from "@/components/ErrorNote"
import { errorMessage, getScheduleItems, markAllRead, markRead } from "@/lib/api/notifications"
import type { AppNotification, ScheduleItem } from "@/lib/types/notifications"
import { announceNotificationsChanged, useNotificationFeed } from "./useNotifications"
import { severityClass, shortDate } from "./kinds"

/** Bell in the top corner: unread badge, plus a panel with what is coming up and the alerts to read. */
export function NotificationBell() {
  const { token, activeMember, user } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [schedule, setSchedule] = useState<ScheduleItem[] | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const feed = useNotificationFeed(token, activeMember.id, { unreadOnly: true, poll: true })
  const unread = feed.data?.unread_count ?? 0
  const badge = unread > 9 ? "9+" : String(unread)
  const first = activeMember.name.split(" ")[0]
  const heading = activeMember.id === user.id ? "Notifications" : `${first}'s notifications`

  const loadSchedule = useCallback(async () => {
    try {
      setSchedule(await getScheduleItems(token, activeMember.id))
    } catch {
      setSchedule([])
    }
  }, [token, activeMember.id])

  // Refresh when opened, and when the person changes while open.
  useEffect(() => {
    if (!open) return
    void feed.refresh()
    void loadSchedule()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeMember.id])

  useEffect(() => {
    setSchedule(null)
    setActionError(null)
  }, [activeMember.id])

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }, [])

  // Close on route change.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setOpen(false)
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true)
    }
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, close])

  const openAlert = async (n: AppNotification) => {
    setActionError(null)
    try {
      await markRead(token, activeMember.id, n.id)
    } catch (e) {
      setActionError(errorMessage(e))
    }
    announceNotificationsChanged()
    if (n.link) {
      close(true)
      navigate(n.link)
    }
  }

  const readAll = async () => {
    setBusy(true)
    setActionError(null)
    try {
      await markAllRead(token, activeMember.id)
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setBusy(false)
      announceNotificationsChanged()
    }
  }

  const alerts = feed.data?.notifications ?? []
  const coming = (schedule ?? []).slice(0, 3)
  const caughtUp = !feed.loading && !feed.error && alerts.length === 0 && schedule !== null && coming.length === 0

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex size-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span
            data-testid="bell-badge"
            aria-hidden
            className="absolute right-0.5 top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-orange-dark px-1 text-[0.7rem] font-bold leading-5 text-white ring-2 ring-burgundy"
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label={heading}
          className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+3.25rem)] z-50 max-h-[70dvh] overflow-y-auto overscroll-contain bg-white p-4 text-left text-sm text-ink shadow-xl ring-1 ring-[var(--line)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1 sm:w-96 sm:rounded-xl"
        >
          <h2 className="text-base font-bold text-burgundy">{heading}</h2>

          {feed.loading && !feed.data && (
            <p role="status" className="mt-3 text-muted-foreground">
              Loading…
            </p>
          )}
          {feed.error && <ErrorNote className="note mt-3" message={feed.error} onRetry={() => void feed.refresh()} />}
          {actionError && (
            <p role="alert" className="mt-3 text-burgundy">
              {actionError}
            </p>
          )}
          {caughtUp && <p className="mt-3 font-medium">You are all caught up.</p>}

          {coming.length > 0 && (
            <section aria-labelledby="bell-coming" className="mt-4">
              <h3 id="bell-coming" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Coming up
              </h3>
              <ul className="mt-2 space-y-2">
                {coming.map((e) => (
                  <li key={e.id} data-testid="bell-upcoming" className="flex items-start gap-3">
                    <span className="chip chip-ok shrink-0">{shortDate(e.due_date)}</span>
                    <span className="min-w-0 font-medium">{e.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {alerts.length > 0 && (
            <section aria-labelledby="bell-alerts" className="mt-4">
              <h3 id="bell-alerts" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Alerts
              </h3>
              <ul className="mt-2 space-y-2">
                {alerts.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      data-testid="bell-alert"
                      data-severity={n.severity}
                      onClick={() => void openAlert(n)}
                      className={`block min-h-11 w-full rounded-lg px-3 py-2 text-left ${severityClass(n.severity)}`}
                    >
                      <span className="block font-semibold">{n.title}</span>
                      <span className="block truncate text-muted-foreground">{n.body}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-4 flex flex-col gap-1 border-t border-[var(--line)] pt-3">
            {unread > 0 && (
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void readAll()}>
                Mark all as read
              </button>
            )}
            <Link to="/notifications" className="inline-flex min-h-11 items-center font-semibold text-burgundy underline">
              See all notifications
            </Link>
            <Link to="/notifications#settings" className="inline-flex min-h-11 items-center font-semibold text-burgundy underline">
              Notification settings
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
