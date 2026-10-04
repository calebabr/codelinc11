import { API_URL, ApiError, apiFailure, DEMO_MONTH } from "@/lib/api/planYear"
import type { AnnualCostRequest, AnnualCostResponse, EstimateResponse, TreatmentPlanParseResponse } from "@/lib/types/costs"
import type { SavingsTipsResponse, TreatmentItem, Usage } from "@/lib/types/planYear"

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError("We can't reach the server right now. Please try again in a moment.")
  }
  if (!res.ok) throw await apiFailure(res)
  return (await res.json()) as T
}

export const postEstimate = (planId: string, code: string, usage: Usage) =>
  post<EstimateResponse>("/estimate", { plan_id: planId, code, usage })

export const postParseQuote = (planId: string, text: string) =>
  post<TreatmentPlanParseResponse>("/treatment-plan/parse", { plan_id: planId, text })

export const postSavingsTipsWithQuotes = (
  planId: string,
  items: TreatmentItem[],
  quotedFees: Record<string, number>,
  usage: Usage,
) => post<SavingsTipsResponse>("/savings-tips", { plan_id: planId, items, usage, quoted_fees: quotedFees, current_month: DEMO_MONTH })

export const postAnnualCost = (req: AnnualCostRequest) => post<AnnualCostResponse>("/annual-cost", req)

/** The three plan tiers shown side by side on the Yearly cost view. */
export const TIER_IDS = ["basic", "preferred", "premium"] as const
