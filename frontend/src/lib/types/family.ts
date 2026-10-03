// Shapes returned by the household API (backend/app/models.py, T05).

export type FamilyRole = "primary" | "adult" | "managed"
export type ServiceName = "preventive" | "basic" | "major" | "orthodontia"

export interface FamilyMember {
  id: string
  household_id: string
  name: string
  relationship: string
  age: number
  role: FamilyRole
  has_login: boolean
  status: string
  status_note: string | null
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

export interface FamilyHousehold {
  id: string
  name: string
  plan_tier: PlanTierSummary
  members: FamilyMember[]
}

export interface DemoAccount {
  account_id: string
  email: string
  display_name: string
  member_id: string
  role: FamilyRole
  household_id: string
  /** Not sent by the API today; if it is, "pending" shows "Waiting for approval". */
  status?: string
}

export interface DemoLoginResponse {
  token: string
  member: FamilyMember
  household: FamilyHousehold
}

export interface ServiceEligibility {
  service: ServiceName
  label: string
  covered: boolean
  plan_share: number
  deductible_applies: boolean
  note: string
}

export interface MemberOverview {
  member: FamilyMember
  plan_tier: PlanTierSummary
  usage: {
    plan_year: number
    max_used: number
    deductible_met: number
    visits: number
    cleanings_used: number
  }
  benefits: {
    plan_name: string
    annual_max: number
    max_used: number
    max_remaining: number
    deductible: number
    deductible_met: number
    deductible_remaining: number
    months_left: number
    reminder: string | null
  }
  reminder: string | null
  eligibility: ServiceEligibility[]
  as_of: string
}

export interface InviteResponse {
  id: string
  household_id: string
  invited_by: string
  member_id: string | null
  email: string
  status: string
  created_at: string
}
