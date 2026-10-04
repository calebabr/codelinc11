// Shape of the saved "Which plan fits us?" comparisons (agents/tasks/T34-T35-save-simulations.md).
// The summary is computed by the server and only displayed here.
import type { SimulateRequest } from "@/lib/types/simulate"

export interface SavedSimulationPlan {
  plan_id: string
  name: string
  cheapest_share: number
  median: number
  p90: number
}

export interface SavedSimulationSummary {
  winner_plan_id: string
  winner_name: string
  winner_share: number
  plans: SavedSimulationPlan[]
  current_plan_id: string
}

export interface SavedSimulation {
  id: string
  member_id: string
  name: string
  request: SimulateRequest
  summary: SavedSimulationSummary
  created_at: string
  updated_at: string
}
