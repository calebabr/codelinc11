// Shared domain types for the Plan Coverage Explainer prototype.
// These mirror the backend contract described in docs/FEATURES.md and the
// path1 deep dive. In the prototype the values come from the mock API
// (src/lib/mockApi.ts); the UI never computes dollar amounts itself.

export type Category = "preventive" | "basic" | "major" | "ortho"

export type CoverageTier = "employee" | "employee_spouse" | "employee_family"

export interface Plan {
  id: string
  name: string
  monthlyPremium: number
  planYearStart: string // ISO month-day style label, e.g. "January 1"
  deductible: number
  deductibleWaivedFor: Category[]
  annualMax: number
  coinsurance: Record<Category, number> // fraction the PLAN pays, e.g. 0.8
  coverageTier: CoverageTier
  benefitPeriod: string // human label, e.g. "Jan 1 – Dec 31"
  dependentAgeLimit: number
  fullTimeStudentAgeLimit: number
  // Per-service rules shown on the plan detail view.
  services: PlanService[]
}

export interface PlanService {
  code: string
  name: string
  category: Category
  frequency: string // e.g. "2 per plan year"
  ageLimit?: string
  notes?: string
}

export interface Procedure {
  code: string
  name: string
  category: Category
  synonyms: string[]
  typicalFee: number // in-network p50
  outOfNetworkBilled: number // p80
}

export interface BenefitUsage {
  maxUsed: number
  deductibleMet: number
  cleaningsUsed: number
  cleaningsLimit: number
  // Dental visits (exams/cleanings) used this plan year, per person.
  visitsUsed: number
  visitsPerYear: number
}

export interface DentalHistoryItem {
  id: string
  date: string
  procedureName: string
  code: string
  youPaid: number
  planPaid: number
}

export interface ScheduleEvent {
  id: string
  title: string
  date: string
  kind: "cleaning" | "procedure" | "reminder"
  note?: string
}

// A single covered person on the account. This is one person's record;
// everything the AI needs about them lives here, scoped to a profile id.
export interface Profile {
  id: string
  name: string
  relationship: "self" | "spouse" | "child"
  age: number
  isFullTimeStudent: boolean
  planId: string
  usage: BenefitUsage
  history: DentalHistoryItem[]
  mustHaves: string[] // coverage the person needs, e.g. "orthodontics"
  schedule: ScheduleEvent[]
  // AI Context: learned, per-profile. The chatbot reads and appends to this.
  aiContext: AiContext
}

// How a plan is sold to the subscriber.
export type PlanTier = "basic" | "standard" | "premium"
export type CoverageType = "PPO" | "HMO" | "indemnity"

// The ACCOUNT is the top-level record, keyed by a unique user_id. The chatbot
// is given the user_id, looks the account up, and only ever sees the people and
// data belonging to that id (data isolation). An account owns the subscriber
// plus any covered dependents (the "covered people").
export interface Account {
  userId: string
  subscriberName: string
  planId: string
  planTier: PlanTier
  coverageType: CoverageType
  // Everyone covered under this account, including the subscriber (relationship "self").
  members: Profile[]
}

export interface AiContext {
  planHighlights: string[]
  previousProcedures: string[]
  previousQuestions: string[]
  preferences: string[]
}

// ----- Chat / estimate response shapes (what the mock "API" returns) -----

export interface TraceStep {
  label: string
  amount?: number
  detail?: string
}

export interface EstimateResult {
  procedureName: string
  code: string
  billed: number
  planPays: number
  youPay: number
  inNetwork: boolean
  balanceBilling?: number
  covered: boolean
  reason?: string
  trace: TraceStep[]
}

// ----- Eligibility ("know your profile") shapes -----

// Per-person eligibility snapshot the chatbot reads.
export interface MemberEligibility {
  id: string
  name: string
  relationship: Profile["relationship"]
  age: number
  isFullTimeStudent: boolean
  // Is this person eligible to be covered on the plan right now?
  eligible: boolean
  eligibilityReason: string
  ageLimit: number
  visitsUsed: number
  visitsPerYear: number
  visitsLeft: number
  hadMajorWorkThisYear: boolean
  majorWorkThisYear: string[] // procedure names, major category, this plan year
}

export interface AccountEligibility {
  userId: string
  subscriberName: string
  planName: string
  planTier: PlanTier
  coverageType: CoverageType
  coveredCount: number
  members: MemberEligibility[]
}

export type ChatRole = "user" | "assistant"

export interface ToolCall {
  name: string
  status: "running" | "done"
}

export interface ChatMessage {
  id: string
  role: ChatRole
  text: string
  tools?: ToolCall[]
}
