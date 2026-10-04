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
  /** Profile details (demo families). Optional: older servers do not send them. */
  dob?: string | null
  email?: string | null
  /** Digits only, for example "3345550143". */
  phone?: string | null
  zip?: string | null
  notes?: string | null
  primary_dentist_id?: string | null
}

export type ProfileField = "name" | "dob" | "email" | "phone" | "zip" | "notes"
/** Only the changed fields. null clears email, phone, zip and notes. */
export type ProfilePatch = Partial<Record<ProfileField, string | null>> & {
  /** "My dentist": a provider id, or null to clear it. */
  primary_dentist_id?: string | null
}

export type NewRelationship = "spouse" | "partner" | "child" | "other"
export interface NewMemberRequest {
  name: string
  relationship: NewRelationship
  dob: string
  email?: string
  phone?: string
  zip?: string
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

/** The visitor's own demo family (a sandbox copy of the template household). */
export interface SandboxInfo {
  household_id: string
  /** ISO 8601, UTC. */
  expires_at: string
}

export interface DemoLoginResponse {
  token: string
  member: FamilyMember
  household: FamilyHousehold
  /** Set when the sign-in is to a demo family. */
  sandbox?: SandboxInfo | null
}

/** Body of PUT /households/{id}/names. */
export interface HouseholdNamesRequest {
  household_name?: string
  members: { member_id: string; name: string }[]
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
