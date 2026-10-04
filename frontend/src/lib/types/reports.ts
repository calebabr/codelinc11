// Shapes for the Reports page. They mirror backend contract B4 (docs/sprints/SPRINT-2.md).
// All documents are synthetic demo data.

export type ReportKind = "claim" | "eob" | "copay" | "other"
export type PaidStatus = "unpaid" | "paid" | "not_applicable"
export type ReportKindFilter = "all" | "claim" | "eob" | "copay"
export type ReportOrder = "asc" | "desc"

/** Amounts as the document states them. Any field can be missing, depending on the kind. */
export interface ReportData {
  claim_number?: string | null
  eob_number?: string | null
  status?: string | null
  billed?: number | null
  allowed?: number | null
  deductible_applied?: number | null
  plan_paid?: number | null
  coinsurance_amount?: number | null
  you_owe?: number | null
  balance_billing?: number | null
  remark?: string | null
}

export interface ReportItem {
  id: string
  kind: ReportKind
  service_date: string
  title: string
  provider_name: string
  code?: string | null
  description?: string | null
  paid_status: PaidStatus
  data: ReportData
}

export interface ReportTotals {
  billed: number
  allowed: number
  plan_paid: number
  you_paid: number
  you_owe_open: number
}

export interface ReportList {
  items: ReportItem[]
  totals: ReportTotals | null
}

export interface ReportSample {
  id: string
  title: string
  kind: ReportKind
  text: string
}

export interface ExplainStep {
  label: string
  amount: number | null
  note?: string | null
}

export interface ReportExplanation {
  title: string
  what_it_is: string
  steps: ExplainStep[]
  next_step: string | null
  balance_billing_note: string | null
  lines: string[]
}
