import { API_URL, ApiError, apiFailure } from "@/lib/api/planYear"
import type {
  ExplainStep,
  ReportData,
  ReportExplanation,
  ReportItem,
  ReportKind,
  ReportKindFilter,
  ReportList,
  ReportOrder,
  ReportSample,
  ReportTotals,
} from "@/lib/types/reports"

export { errorMessage } from "@/lib/api/planYear"

const UNREACHABLE = "We can't reach the server right now. Please try again in a moment."

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new ApiError(UNREACHABLE)
  }
  if (res.status === 404) throw new ApiError("Reports are not available on the server yet.", 404)
  if (!res.ok) throw await apiFailure(res)
  return (await res.json()) as T
}

const base = (id: string) => `/members/${encodeURIComponent(id)}/reports`

type Raw = Record<string, unknown>
const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null)
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)
/** A string, or a list of sentences joined into one paragraph (the server sends "what to do next" as a list). */
const sentences = (v: unknown): string | null =>
  Array.isArray(v) ? str(v.filter((s): s is string => typeof s === "string" && !!s.trim()).join(" ")) : str(v)

/** Accepts the stored fields under `data` or `data_json` (object or JSON text). */
function normalizeItem(raw: Raw): ReportItem {
  let data: unknown = raw.data ?? raw.data_json ?? {}
  if (typeof data === "string") {
    try {
      data = JSON.parse(data)
    } catch {
      data = {}
    }
  }
  return {
    id: String(raw.id),
    kind: (str(raw.kind) ?? "other") as ReportKind,
    service_date: str(raw.service_date) ?? "",
    title: str(raw.title) ?? "Document",
    provider_name: str(raw.provider_name) ?? "",
    code: str(raw.code),
    description: str(raw.description),
    paid_status: (str(raw.paid_status) ?? "not_applicable") as ReportItem["paid_status"],
    data: (isObj(data) ? data : {}) as ReportData,
  }
}

function normalizeTotals(raw: unknown): ReportTotals | null {
  if (!isObj(raw)) return null
  return {
    billed: num(raw.billed) ?? 0,
    allowed: num(raw.allowed) ?? 0,
    plan_paid: num(raw.plan_paid) ?? 0,
    you_paid: num(raw.you_paid) ?? 0,
    you_owe_open: num(raw.you_owe_open) ?? 0,
  }
}

export interface ReportQuery {
  kind: ReportKindFilter
  order: ReportOrder
}

export async function getReports(token: string, memberId: string, q: ReportQuery): Promise<ReportList> {
  const p = new URLSearchParams({ order: q.order })
  if (q.kind !== "all") p.set("kind", q.kind)
  const body = await call<unknown>(token, `${base(memberId)}?${p.toString()}`)
  const rawItems = Array.isArray(body) ? body : isObj(body) && Array.isArray(body.items) ? body.items : []
  return {
    items: rawItems.filter(isObj).map(normalizeItem),
    totals: isObj(body) ? normalizeTotals(body.totals) : null,
  }
}

export async function getSamples(token: string): Promise<ReportSample[]> {
  const body = await call<unknown>(token, "/reports/samples")
  const rows = Array.isArray(body) ? body : isObj(body) && Array.isArray(body.samples) ? body.samples : []
  return rows.filter(isObj).map((r) => ({
    id: String(r.id ?? r.sample_id),
    title: str(r.title) ?? "Sample document",
    kind: (str(r.kind) ?? "other") as ReportKind,
    text: str(r.text) ?? "",
  }))
}

export const addSample = (token: string, memberId: string, sampleId: string) =>
  call<unknown>(token, `${base(memberId)}/samples/${encodeURIComponent(sampleId)}`, { method: "POST" })

/** Sends text in the sample template. The server replies 422 with a plain message for anything else. */
export const uploadReportText = (token: string, memberId: string, text: string, filename: string, kind?: ReportKind) => {
  const q = new URLSearchParams({ filename })
  if (kind) q.set("kind", kind)
  return call<unknown>(token, `${base(memberId)}/upload?${q.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: text,
  })
}

export const markPaid = (token: string, memberId: string, id: string) =>
  call<unknown>(token, `${base(memberId)}/${encodeURIComponent(id)}/mark-paid`, { method: "POST" })

export const deleteReport = (token: string, memberId: string, id: string) =>
  call<unknown>(token, `${base(memberId)}/${encodeURIComponent(id)}`, { method: "DELETE" })

/** The plain-language explanation. Field names are read leniently: the text and amounts are the server's. */
export async function getExplanation(token: string, memberId: string, id: string): Promise<ReportExplanation> {
  const raw = await call<Raw>(token, `${base(memberId)}/${encodeURIComponent(id)}/explain`)
  const stepsRaw = Array.isArray(raw.steps) ? raw.steps : []
  const steps: ExplainStep[] = stepsRaw.filter(isObj).map((s) => ({
    label: str(s.label) ?? str(s.name) ?? str(s.step) ?? "",
    amount: num(s.amount) ?? num(s.value),
    note: str(s.note) ?? str(s.text) ?? str(s.description),
  }))
  const lines = Array.isArray(raw.lines) ? raw.lines.map((l) => (typeof l === "string" ? l : isObj(l) ? str(l.text) ?? str(l.description) : null)).filter((l): l is string => !!l) : []
  const bb = raw.balance_billing_note ?? raw.balance_billing
  return {
    title: str(raw.title) ?? "",
    what_it_is: str(raw.what_it_is) ?? str(raw.summary) ?? str(raw.what) ?? "",
    steps,
    next_step: sentences(raw.what_to_do_next) ?? sentences(raw.next_step) ?? sentences(raw.next_steps) ?? sentences(raw.what_to_do),
    balance_billing_note: typeof bb === "string" ? str(bb) : null,
    lines,
  }
}
