import { Link } from "react-router"
import { useSession } from "@/state/SessionContext"
import { useNotificationFeed } from "./useNotifications"
import { severityClass } from "./kinds"

/** Compact card for the Home page: the top 3 unread alerts and a link to the full page. */
export function HomeNotificationsCard() {
  const { token, activeMember } = useSession()
  const feed = useNotificationFeed(token, activeMember.id, { unreadOnly: true })
  const items = (feed.data?.notifications ?? []).slice(0, 3)
  const unread = feed.data?.unread_count ?? 0
  return (
    <section aria-labelledby="home-notifications" className="portal-card">
      <h2 id="home-notifications" className="portal-card-title flex flex-wrap items-center gap-2">
        Notifications
        {unread > 0 && <span className="chip chip-warn">{unread} unread</span>}
      </h2>
      {feed.loading && !feed.data && <p className="mt-3 text-muted-foreground">Loading…</p>}
      {feed.error && <p className="mt-3 text-sm text-muted-foreground">{feed.error}</p>}
      {feed.data && items.length === 0 && <p className="mt-3 text-muted-foreground">You are all caught up.</p>}
      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((n) => (
            <li key={n.id} data-testid="home-notification" className={`rounded-lg px-3 py-2 ${severityClass(n.severity)}`}>
              <p className="font-semibold">{n.title}</p>
              <p className="truncate text-sm text-muted-foreground">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
      <Link to="/notifications" className="mt-3 inline-flex min-h-11 items-center font-semibold text-burgundy underline">
        See all notifications
      </Link>
    </section>
  )
}
