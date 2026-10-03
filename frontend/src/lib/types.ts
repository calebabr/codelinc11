// Hand-written mirror of backend/app/models.py (the API contract).
// All money values are US dollars computed by the backend.

export type Category = 'preventive' | 'basic' | 'major'
export type Urgency = 'urgent' | 'soon' | 'flexible'

export interface Plan {
  id: string
  name: string
  description: string
  monthly_premium: number
  deductible: number
  deductible_waived_for: Category[]
  annual_max: number
  coinsurance: Record<Category, number>
  frequency: Record<string, number>
  plan_year_start_month: number
}

export interface Procedure {
  code: string
  name: string
  category: Category
  description: string
  synonyms: string[]
  fee_p50: number
  fee_p80: number
}

export interface Usage {
  max_used: number
  deductible_met: number
  history: string[]
}

export interface TraceStep {
  label: string
  amount: number
  note: string
}

export interface EstimateResult {
  code: string
  name: string
  category: Category
  in_network: boolean
  covered: boolean
  billed: number
  allowed: number
  deductible_applied: number
  plan_pays: number
  you_pay: number
  balance_bill: number
  max_used_after: number
  trace: TraceStep[]
}

export interface PlanRef {
  plan_id?: string | null
  plan?: Plan | null
}

export interface EstimateRequest extends PlanRef {
  code: string
  usage: Usage
}

export interface EstimateResponse {
  in_network: EstimateResult
  out_of_network: EstimateResult
}

export interface ProcedureMatch {
  procedure: Procedure
  score: number
}

export interface TreatmentItem {
  id: string
  code: string
  urgency: Urgency
  after?: string | null
}

export interface ScheduleRequest extends PlanRef {
  items: TreatmentItem[]
  usage: Usage
  current_month: number
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

export interface BenefitsStatusRequest extends PlanRef {
  usage: Usage
  current_month: number
}

export interface FrequencyStatus {
  code: string
  name: string
  used: number
  limit: number
  remaining: number
}

export interface BenefitsStatus {
  plan_name: string
  annual_max: number
  max_used: number
  max_remaining: number
  deductible: number
  deductible_met: number
  deductible_remaining: number
  frequencies: FrequencyStatus[]
  unused_preventive_value: number
  months_left: number
  reminder: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest extends PlanRef {
  messages: ChatMessage[]
  usage: Usage
  current_month: number
}

export type ChatMode = 'ollama' | 'fallback'

export interface HealthResponse {
  ok: boolean
  ollama_available: boolean
  ollama_model: string
  chat_mode: ChatMode
}

// ---- Treatment plan (dentist quote) ----
export interface ParsedTreatment {
  id: string
  code: string | null
  name: string
  tooth: string | null
  quoted_fee: number | null
  typical_fee: number | null
  urgency: Urgency
  after: string | null
  phase: string | null
  matched: boolean
  confidence: number
  source_line: string
}

export interface TreatmentPlanParseRequest {
  text: string
  plan_id?: string | null
  plan?: Plan | null
}

export interface TreatmentPlanParseResponse {
  items: ParsedTreatment[]
  unmatched_lines: string[]
  notes: string[]
  mode: 'rules' | 'ollama'
}

// ---- Questions to ask your dentist ----
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

export interface QuestionsRequest extends PlanRef {
  codes: string[]
  usage: Usage
  current_month: number
}

export interface QuestionsResponse {
  safety_note: string
  sections: QuestionSection[]
}

// ---- Savings tips ----
export type TipKind = 'timing' | 'network' | 'preventive' | 'alternative' | 'fsa_hsa' | 'quote_check'

export interface SavingsTip {
  id: string
  kind: TipKind
  title: string
  summary: string
  saving: number
  before: number
  after: number
  steps: TraceStep[]
  assumptions: string[]
}

export interface SavingsTipsRequest extends PlanRef {
  usage: Usage
  current_month: number
  items: TreatmentItem[]
  quoted_fees: Record<string, number>
  tax_rate?: number
}

export interface SavingsTipsResponse {
  tips: SavingsTip[]
  note: string
}
