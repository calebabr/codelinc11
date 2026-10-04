import { API_URL, ApiError, apiFailure } from "@/lib/api/planYear"
import type {
  Channel,
  NotificationList,
  NotificationPrefs,
  OutboxItem,
  ReadResult,
  ScheduleItem,
  TestResult,
} from "@/lib/types/notifications"

export { errorMessage } from "@/lib/api/planYear"

async function call<T>(token: string, path: string, method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (body !== undefined) headers["Content-Type"] = "application/json"
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError("We can't reach the server right now. Please try again in a moment.")
  }
  if (!res || !res.ok) throw await apiFailure(res)
  return (await res.json()) as T
}

const base = (id: string) => `/members/${encodeURIComponent(id)}`

export const getNotifications = (token: string, id: string, unreadOnly: boolean) =>
  call<NotificationList>(token, `${base(id)}/notifications${unreadOnly ? "?unread=1" : ""}`)

export const markRead = (token: string, id: string, nid: number | string) =>
  call<ReadResult>(token, `${base(id)}/notifications/${encodeURIComponent(String(nid))}/read`, "POST")

export const markAllRead = (token: string, id: string) =>
  call<ReadResult>(token, `${base(id)}/notifications/read-all`, "POST")

export const getPrefs = (token: string, id: string) => call<NotificationPrefs>(token, `${base(id)}/notification-prefs`)

export const putPrefs = (token: string, id: string, prefs: NotificationPrefs) =>
  call<NotificationPrefs>(token, `${base(id)}/notification-prefs`, "PUT", prefs)

export const sendTest = (token: string, id: string, channel: Channel) =>
  call<TestResult>(token, `${base(id)}/notifications/test`, "POST", { channel })

export const getOutbox = (token: string, id: string) => call<OutboxItem[]>(token, `${base(id)}/outbox`)

export const getScheduleItems = (token: string, id: string) => call<ScheduleItem[]>(token, `${base(id)}/schedule`)
