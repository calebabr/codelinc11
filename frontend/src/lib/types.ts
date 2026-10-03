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

// A single person's record. This is the "user-specific database record":
// everything the AI needs lives here, scoped to one profile id.
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
