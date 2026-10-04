// Shape of POST /simulate (docs/features/F7-choose-a-plan-monte-carlo.md). Values are shown, never calculated.
export type CareLevel = "low" | "average" | "high"

export interface SimulateKnownCare {
  code: string
  count: number
}

export interface SimulateMember {
  id: string
  name: string
  age: number
  care_level: CareLevel
  known_care: SimulateKnownCare[]
}

export interface SimulateRequest {
  members: SimulateMember[]
  plan_ids?: string[]
  n: number
  seed: number
  in_network: boolean
}

export interface SimulatePlanResult {
  plan_id: string
  name: string
  monthly_premium: number
  premiums_total: number
  mean: number
  median: number
  p10: number
  p90: number
  min: number
  max: number
  cheapest_share: number
  histogram: number[]
}

export interface SimulateResponse {
  n: number
  seed: number
  in_network: boolean
  plans: SimulatePlanResult[]
  bin_edges: number[]
  winner_plan_id: string
  reasons: string[]
  assumptions: string[]
  disclaimer: string
}
