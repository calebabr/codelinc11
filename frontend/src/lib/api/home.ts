import { API_URL, ApiError } from "@/lib/api/planYear"
import type { MemberOverview, ScheduleEntry, VisitResponse } from "@/lib/types/home"

import { errorMessage } from "@/lib/api/planYear"
export { errorMessage, remindersUrl } from "@/lib/api/planYear"

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, init)
  } catch {
    throw new ApiError("We can't reach the server right now. Please try again in a moment.")
  }
  if (!res.ok) {
    let detail = ""
    try {
      const b = await res.json()
      if (typeof b?.detail === "string") detail = b.detail
    } catch {
      /* ignore */
    }
    throw new ApiError(detail || `The server returned an error (${res.status}).`, res.status)
  }
  return (await res.json()) as T
}

function authed<T>(token: string, path: string) {
  return json<T>(path, { headers: { Authorization: `Bearer ${token}` } })
}

export const getOverview = (token: string, memberId: string) =>
  authed<MemberOverview>(token, `/members/${encodeURIComponent(memberId)}/overview`)

export const getSchedule = (token: string, memberId: string) =>
  authed<ScheduleEntry[]>(token, `/members/${encodeURIComponent(memberId)}/schedule`)

function post<T>(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  return json<T>(path, { method: "POST", headers, body: JSON.stringify(body) })
}

/** Saves a visit for the member. The server does the math and returns the new numbers. */
export const postVisit = (token: string, memberId: string, code: string) =>
  post<VisitResponse>(`/members/${encodeURIComponent(memberId)}/visits`, { code, in_network: true }, token)

/** Primary only. Puts the demo data back to how it started. */
export const postDemoReset = (token: string) => post<unknown>("/demo/reset", {}, token)

/** A plain message; a 404 means the server does not have the route yet. */
export function visitErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 404) return `${fallback} This feature is not available on the server yet.`
  return errorMessage(err)
}
