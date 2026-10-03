import { API_URL, ApiError, DEMO_MONTH } from "@/lib/api/planYear"
import type { BenefitsStatus, EstimateResponse, MemberOverview, ScheduleEntry, Usage } from "@/lib/types/home"

export { errorMessage, remindersUrl } from "@/lib/api/planYear"

// The session context does not hold a sign-in token yet, so this page signs in
// as the household's primary member (who may see everyone) and keeps the token here.
const tokens = new Map<string, Promise<string>>()

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

export function getToken(signInAs: string): Promise<string> {
  let p = tokens.get(signInAs)
  if (!p) {
    p = json<{ token: string }>("/auth/demo-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: signInAs }),
    }).then((r) => r.token)
    p.catch(() => tokens.delete(signInAs))
    tokens.set(signInAs, p)
  }
  return p
}

async function authed<T>(signInAs: string, path: string): Promise<T> {
  const token = await getToken(signInAs)
  try {
    return await json<T>(path, { headers: { Authorization: `Bearer ${token}` } })
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      tokens.delete(signInAs)
      const fresh = await getToken(signInAs)
      return json<T>(path, { headers: { Authorization: `Bearer ${fresh}` } })
    }
    throw e
  }
}

export const getOverview = (signInAs: string, memberId: string) =>
  authed<MemberOverview>(signInAs, `/members/${encodeURIComponent(memberId)}/overview`)

export const getSchedule = (signInAs: string, memberId: string) =>
  authed<ScheduleEntry[]>(signInAs, `/members/${encodeURIComponent(memberId)}/schedule`)

function post<T>(path: string, body: unknown) {
  return json<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
}

export const postEstimate = (planId: string, code: string, usage: Usage) =>
  post<EstimateResponse>("/estimate", { plan_id: planId, code, usage })

export const postBenefits = (planId: string, usage: Usage) =>
  post<BenefitsStatus>("/benefits-status", { plan_id: planId, usage, current_month: DEMO_MONTH })
