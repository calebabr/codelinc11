import type {
  BenefitsStatus,
  ProcedureMatch,
  QuestionsResponse,
  SavingsTipsResponse,
  ScheduleResponse,
  TreatmentItem,
  Usage,
} from "@/lib/types/planYear"

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000"

/** The demo clock is fixed to November so timing advice is stable (PLAN.md). */
export const DEMO_MONTH = 11

export class ApiError extends Error {
  status?: number
  /** Seconds to wait before trying again. Set on a 429 (too many requests). */
  retryAfter?: number
  constructor(message: string, status?: number, retryAfter?: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.retryAfter = retryAfter
  }
}

/** A plain sentence for a 429. The wait is rounded up to at least one second. */
export function waitMessage(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds))
  return `You're going a little fast. Please wait about ${s} ${s === 1 ? "second" : "seconds"} and try again.`
}

/** Turns a failed response into an ApiError: the server's plain `detail`, or a wait message on a 429. */
export async function apiFailure(res: Response): Promise<ApiError> {
  let detail = ""
  let retry: number | undefined
  try {
    const body = await res.json()
    if (typeof body?.detail === "string") detail = body.detail
    else if (Array.isArray(body?.detail) && typeof body.detail[0]?.msg === "string") detail = body.detail[0].msg
    if (typeof body?.retry_after === "number" && Number.isFinite(body.retry_after)) retry = body.retry_after
  } catch {
    /* the body is not JSON */
  }
  if (res.status === 429) {
    if (retry === undefined) {
      const header = Number(res.headers?.get?.("Retry-After"))
      retry = Number.isFinite(header) && header > 0 ? header : 30
    }
    return new ApiError(waitMessage(retry), 429, Math.max(1, Math.ceil(retry)))
  }
  return new ApiError(detail || `The server returned an error (${res.status}).`, res.status)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, init)
  } catch {
    throw new ApiError("We can't reach the server right now. Please try again in a moment.")
  }
  if (!res.ok) throw await apiFailure(res)
  return (await res.json()) as T
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

export const getProcedures = () => request<ProcedureMatch[]>("/procedures")

export interface PlanRef {
  plan_id: string
}

export const postSchedule = (plan: PlanRef, items: TreatmentItem[], usage: Usage) =>
  post<ScheduleResponse>("/schedule", { ...plan, items, usage, current_month: DEMO_MONTH })

export const postSavingsTips = (plan: PlanRef, items: TreatmentItem[], usage: Usage) =>
  post<SavingsTipsResponse>("/savings-tips", { ...plan, items, usage, current_month: DEMO_MONTH })

export const postQuestions = (plan: PlanRef, codes: string[], usage: Usage) =>
  post<QuestionsResponse>("/questions", { ...plan, codes, usage, current_month: DEMO_MONTH })

export const postBenefitsStatus = (plan: PlanRef, usage: Usage) =>
  post<BenefitsStatus>("/benefits-status", { ...plan, usage, current_month: DEMO_MONTH })

/** Link to the calendar file. The values come from the benefits-status response. */
export function remindersUrl(planName: string, maxRemaining: number): string {
  const p = new URLSearchParams({
    plan_name: planName,
    max_remaining: String(maxRemaining),
    month: String(DEMO_MONTH),
  })
  return `${API_URL}/reminders.ics?${p.toString()}`
}

// ---- Member usage ---------------------------------------------------------

export interface MemberUsage {
  usage: Usage
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

/**
 * Pull usage out of GET /members/{id}/overview (backend MemberOverview:
 * `usage: {max_used, deductible_met, cleanings_used, ...}`). The engine wants a
 * `history` of procedure codes, so cleanings already used are sent as D1110.
 */
export function usageFromOverview(o: unknown): Usage | null {
  if (!o || typeof o !== "object") return null
  const root = o as Record<string, unknown>
  const src = (root.usage && typeof root.usage === "object" ? root.usage : root) as Record<string, unknown>
  const used = num(src.max_used)
  const met = num(src.deductible_met)
  if (used === null || met === null) return null
  let history: string[] = []
  if (Array.isArray(src.history)) history = src.history.filter((h) => typeof h === "string") as string[]
  else {
    const cleanings = num(src.cleanings_used)
    if (cleanings && cleanings > 0) history = Array.from({ length: cleanings }, () => "D1110")
  }
  return { max_used: used, deductible_met: met, history }
}

/** Loads the member's usage with the signed-in token. Throws if the server cannot be reached. */
export async function getMemberUsage(memberId: string, token: string): Promise<MemberUsage> {
  const overview = await request<unknown>(`/members/${encodeURIComponent(memberId)}/overview`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const usage = usageFromOverview(overview)
  if (!usage) throw new ApiError("We could not read this person's usage. Please try again.")
  return { usage }
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Please try again."
}
