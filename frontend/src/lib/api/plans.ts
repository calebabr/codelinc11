import { API_URL, ApiError, apiFailure } from "@/lib/api/planYear"
import type { PlanTier } from "@/lib/types/plans"

export async function getPlans(): Promise<PlanTier[]> {
  let res: Response
  try {
    res = await fetch(`${API_URL}/plans`)
  } catch {
    throw new ApiError("We can't reach the server right now. Please try again in a moment.")
  }
  if (!res.ok) throw await apiFailure(res)
  return (await res.json()) as PlanTier[]
}
