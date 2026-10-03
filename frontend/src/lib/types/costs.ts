// Shapes for the Costs page. They mirror backend/app/models.py (the API contract).
import type { Category, TraceStep, Urgency } from "@/lib/types/planYear"

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

export interface EstimateResponse {
  in_network: EstimateResult
  out_of_network: EstimateResult
}

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

export interface TreatmentPlanParseResponse {
  items: ParsedTreatment[]
  unmatched_lines: string[]
  notes: string[]
  mode: "rules" | "ollama"
}

export interface CareItem {
  code: string
  count: number
}

export interface AnnualCostRequest {
  tier_id: string
  covered_people: number
  expected_care: CareItem[]
  in_network: boolean
}

export interface AnnualCostPerson {
  person: number
  plan_pays: number
  you_pay: number
  max_used_end: number
}

export interface AnnualCostResponse {
  tier_id: string
  tier_name: string
  covered_people: number
  premiums: number
  plan_pays: number
  out_of_pocket_care: number
  total_cost: number
  per_person: AnnualCostPerson[]
  assumptions: string[]
  disclaimer: string
}
