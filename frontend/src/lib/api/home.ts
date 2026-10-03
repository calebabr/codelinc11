import { API_URL, ApiError, DEMO_MONTH } from "@/lib/api/planYear"
import type { BenefitsStatus, EstimateResponse, MemberOverview, ScheduleEntry, Usage } from "@/lib/types/home"

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

function post<T>(path: string, body: unknown) {
  return json<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
}

export const postEstimate = (planId: string, code: string, usage: Usage) =>
  post<EstimateResponse>("/estimate", { plan_id: planId, code, usage })

export const postBenefits = (planId: string, usage: Usage) =>
  post<BenefitsStatus>("/benefits-status", { plan_id: planId, usage, current_month: DEMO_MONTH })
