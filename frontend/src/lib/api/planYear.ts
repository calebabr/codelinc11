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
  constructor(message: string, status?: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, init)
  } catch {
    throw new ApiError("We can't reach the server right now. Please try again in a moment.")
  }
  if (!res.ok) {
    let detail = ""
    try {
      const body = await res.json()
      if (typeof body?.detail === "string") detail = body.detail
    } catch {
      /* ignore */
    }
    throw new ApiError(detail || `The server returned an error (${res.status}).`, res.status)
  }
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

// Used only when GET /members/{id}/overview is not available (T05 not landed).
// Alex is the golden demo member: $1,100 used, deductible met (docs/FEATURES.md section 2, S2).
const FALLBACK_USAGE: Record<string, Usage> = {
  m_alex: { max_used: 1100, deductible_met: 50, history: [] },
}
const NO_USAGE: Usage = { max_used: 0, deductible_met: 0, history: [] }

export interface MemberUsage {
  usage: Usage
  /** True when the numbers came from the built-in demo values, not the server. */
  fromFallback: boolean
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

/** Pull usage out of the overview response, whichever of the agreed shapes it uses. */
export function usageFromOverview(o: unknown): Usage | null {
  if (!o || typeof o !== "object") return null
  const root = o as Record<string, unknown>
  const src = (root.usage && typeof root.usage === "object" ? root.usage : root) as Record<string, unknown>
  const used = num(src.max_used)
  const met = num(src.deductible_met)
  if (used === null || met === null) return null
  const history = Array.isArray(src.history) ? (src.history.filter((h) => typeof h === "string") as string[]) : []
  return { max_used: used, deductible_met: met, history }
}

export async function getMemberUsage(memberId: string): Promise<MemberUsage> {
  try {
    const overview = await request<unknown>(`/members/${encodeURIComponent(memberId)}/overview`)
    const usage = usageFromOverview(overview)
    if (usage) return { usage, fromFallback: false }
  } catch {
    /* fall through to the demo values */
  }
  return { usage: FALLBACK_USAGE[memberId] ?? NO_USAGE, fromFallback: true }
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Please try again."
}
