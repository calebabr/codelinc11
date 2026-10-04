import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router"
import { useSession } from "@/state/SessionContext"
import { ErrorNote } from "@/components/ErrorNote"
import { errorMessage, markAllRead, markRead } from "@/lib/api/notifications"
import { formatDate } from "@/lib/format"
import type { AppNotification } from "@/lib/types/notifications"
import { announceNotificationsChanged, useNotificationFeed } from "@/features/notifications/useNotifications"
import { FILTERS, matchesFilter, severityClass, type FilterId } from "@/features/notifications/kinds"
import { NotificationSettings } from "@/features/notifications/NotificationSettings"

export default function NotificationsPage() {
  const { token, activeMember, user } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const feed = useNotificationFeed(token, activeMember.id, { unreadOnly: false })
  const [filter, setFilter] = useState<FilterId>("all")
  const [actionError, setActionError] = useState<string | null>(null)
  const first = activeMember.name.split(" ")[0]
  const title = activeMember.id === user.id ? "Notifications" : `${first}'s notifications`

  useEffect(() => {
    if (location.hash !== "#settings") return
    const el = document.getElementById("settings")
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView()
  }, [location.hash, activeMember.id])

  const all = feed.data?.notifications ?? []
  const shown = all.filter((n) => matchesFilter(n, filter))
  const unread = feed.data?.unread_count ?? 0

  const read = async (n: AppNotification, go: boolean) => {
    setActionError(null)
    try {
      if (n.read_at === null) await markRead(token, activeMember.id, n.id)
    } catch (e) {
      setActionError(errorMessage(e))
    }
    announceNotificationsChanged()
    if (go && n.link) navigate(n.link)
  }

  const readAll = async () => {
    setActionError(null)
    try {
      await markAllRead(token, activeMember.id)
    } catch (e) {
      setActionError(errorMessage(e))
    }
    announceNotificationsChanged()
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-burgundy">{title}</h1>
          <p className="text-muted-foreground">{unread === 0 ? "Nothing new." : `${unread} unread`}</p>
        </div>
        {unread > 0 && (
          <button type="button" className="btn btn-outline" onClick={() => void readAll()}>
            Mark all as read
          </button>
        )}
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter notifications">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {feed.loading && !feed.data && (
        <p role="status" className="text-muted-foreground">
          Loading…
        </p>
      )}
      {feed.error && <ErrorNote message={feed.error} onRetry={() => void feed.refresh()} />}
      {actionError && <ErrorNote message={actionError} className="text-burgundy" />}

      {feed.data && shown.length === 0 && (
        <p className="portal-card" data-testid="notif-empty">
          {filter === "all" || filter === "unread" ? "You are all caught up." : "Nothing here yet."}
        </p>
      )}

      {shown.length > 0 && (
        <ul className="space-y-3" aria-label="Notifications">
          {shown.map((n) => {
            const isRead = n.read_at !== null
            return (
              <li
                key={n.id}
                data-testid="notif-item"
                data-read={isRead}
                className={`rounded-xl p-4 ring-1 ring-[var(--line)] ${severityClass(n.severity)} ${isRead ? "opacity-75" : ""}`}
              >
                <p className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">{n.title}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(n.created_at)}</span>
                </p>
                <p className="mt-1">{n.body}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {n.link && (
                    <button type="button" className="btn btn-outline" onClick={() => void read(n, true)}>
                      Open
                    </button>
                  )}
                  {!isRead && (
                    <button type="button" className="btn btn-outline" onClick={() => void read(n, false)}>
                      Mark as read
                    </button>
                  )}
                  {isRead && <span className="chip chip-ok">Read</span>}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <NotificationSettings token={token} memberId={activeMember.id} firstName={first} />
    </div>
  )
}
