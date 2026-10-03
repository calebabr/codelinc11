// Shapes for the Home page. They mirror backend/app/models.py (MemberOverview, ScheduleEntry, EstimateResult).
import type { Procedure, Usage } from "@/lib/types/planYear"

export type { Procedure, Usage }

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

export interface PlanTierSummary {
  id: string
  name: string
  monthly_premium: number
  annual_max: number
  deductible: number
  preventive_pct: number
  basic_pct: number
  major_pct: number
  ortho_pct: number
}

export interface MemberUsageDollars {
  plan_year: number
  max_used: number
  deductible_met: number
  visits: number
  cleanings_used: number
}

export interface MemberOverview {
  member: { id: string; name: string; relationship: string; age: number; role: string; status: string }
  plan_tier: PlanTierSummary
  usage: MemberUsageDollars
  benefits: BenefitsStatus
  reminder: string | null
  as_of: string
}

export interface ScheduleEntry {
  id: number
  member_id: string
  member_name: string
  kind: string
  due_date: string
  title: string
  note: string | null
}

export interface VisitEstimate {
  code: string
  name: string
  covered: boolean
  deductible_applied: number
  plan_pays: number
  you_pay: number
  max_used_after: number
}

export interface EstimateResponse {
  in_network: VisitEstimate
  out_of_network: VisitEstimate
}

/** 201 response of POST /members/{id}/visits. */
export interface VisitResponse {
  estimate: VisitEstimate
  usage: Usage
  benefits: BenefitsStatus
}
