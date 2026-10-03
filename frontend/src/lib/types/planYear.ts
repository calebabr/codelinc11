// Shapes for the Plan My Year page. They mirror backend/app/models.py (the API contract).
// Keep in sync by hand until `npm run gen:api` types are adopted.

export type Category = "preventive" | "basic" | "major"
export type Urgency = "urgent" | "soon" | "flexible"

export interface Procedure {
  code: string
  name: string
  category: Category
  description: string
  synonyms: string[]
  fee_p50: number
  fee_p80: number
}

export interface ProcedureMatch {
  procedure: Procedure
  score: number
}

export interface Usage {
  max_used: number
  deductible_met: number
  history: string[]
}

export interface TreatmentItem {
  id: string
  code: string
  urgency: Urgency
  after: string | null
}

export interface ScheduledItem {
  id: string
  code: string
  name: string
  category: Category
  year_offset: number
  month: number
  plan_pays: number
  you_pay: number
  note: string
}

export interface YearSummary {
  year_offset: number
  label: string
  plan_pays: number
  you_pay: number
  max_used_end: number
  max_remaining_end: number
}

export interface ScheduleResponse {
  items: ScheduledItem[]
  years: YearSummary[]
  total_you_pay: number
  baseline_you_pay: number
  savings: number
  baseline_items: ScheduledItem[]
  reasons: string[]
}

export interface TraceStep {
  label: string
  amount: number
  note: string
}

export interface SavingsTip {
  id: string
  kind: string
  title: string
  summary: string
  saving: number
  before: number
  after: number
  steps: TraceStep[]
  assumptions: string[]
}

export interface SavingsTipsResponse {
  tips: SavingsTip[]
  note: string
}

export interface DentistQuestion {
  id: string
  text: string
  why: string
}

export interface QuestionSection {
  id: string
  title: string
  questions: DentistQuestion[]
}

export interface QuestionsResponse {
  safety_note: string
  sections: QuestionSection[]
}

export interface BenefitsStatus {
  plan_name: string
  annual_max: number
  max_used: number
  max_remaining: number
  deductible: number
  deductible_met: number
  months_left: number
  reminder: string | null
}
