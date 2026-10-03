import type {
  BenefitsStatus,
  BenefitsStatusRequest,
  EstimateRequest,
  EstimateResponse,
  HealthResponse,
  Plan,
  ProcedureMatch,
  QuestionsRequest,
  QuestionsResponse,
  SavingsTipsRequest,
  SavingsTipsResponse,
  ScheduleRequest,
  ScheduleResponse,
  TreatmentPlanParseRequest,
  TreatmentPlanParseResponse,
} from './types'

export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

export class ApiError extends Error {
  status?: number
  network: boolean
  constructor(message: string, opts: { status?: number; network?: boolean } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = opts.status
    this.network = opts.network ?? false
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, init)
  } catch {
    throw new ApiError("Can't reach the server: is the backend running on port 8000?", {
      network: true,
    })
  }
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch {
      /* ignore */
    }
    throw new ApiError(detail || `The server returned an error (${res.status}).`, {
      status: res.status,
    })
  }
  return (await res.json()) as T
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export const getHealth = () => request<HealthResponse>('/health')
export const getPlans = () => request<Plan[]>('/plans')
export const searchProcedures = (q: string) =>
  request<ProcedureMatch[]>(`/procedures?q=${encodeURIComponent(q)}`)
export const postEstimate = (req: EstimateRequest) => post<EstimateResponse>('/estimate', req)
export const postSchedule = (req: ScheduleRequest) => post<ScheduleResponse>('/schedule', req)
export const postBenefitsStatus = (req: BenefitsStatusRequest) =>
  post<BenefitsStatus>('/benefits-status', req)

export const postTreatmentPlanParse = (req: TreatmentPlanParseRequest) =>
  post<TreatmentPlanParseResponse>('/treatment-plan/parse', req)
export const postQuestions = (req: QuestionsRequest) => post<QuestionsResponse>('/questions', req)
export const postSavingsTips = (req: SavingsTipsRequest) =>
  post<SavingsTipsResponse>('/savings-tips', req)

export function remindersUrl(planName: string, maxRemaining: number, month: number): string {
  const p = new URLSearchParams({
    plan_name: planName,
    max_remaining: String(maxRemaining),
    month: String(month),
  })
  return `${API_URL}/reminders.ics?${p.toString()}`
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return 'Something went wrong. Please try again.'
}
