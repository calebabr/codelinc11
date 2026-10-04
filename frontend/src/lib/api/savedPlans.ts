// Saved Plan My Year treatment lists. Contract (backend, bearer token):
//   GET    /members/{id}/saved-plans            -> SavedPlan[] (newest first)
//   POST   /members/{id}/saved-plans            -> 201 SavedPlan   {name 1-60 chars, items max 20}
//   PUT    /members/{id}/saved-plans/{plan_id}  -> SavedPlan       {name?, items?}
//   DELETE /members/{id}/saved-plans/{plan_id}  -> 204
// A saved plan stores only the treatment list. Dollar figures are always recomputed by /schedule.

import { API_URL, ApiError, apiFailure } from "@/lib/api/planYear"
import type { TreatmentItem } from "@/lib/types/planYear"

export const MAX_PLAN_ITEMS = 20
export const MAX_NAME_LENGTH = 60

export interface SavedPlan {
  id: string
  member_id: string
  name: string
  items: TreatmentItem[]
  created_at: string
  updated_at: string
}

async function call<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (init.body) headers["Content-Type"] = "application/json"
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers })
  } catch {
    throw new ApiError("We can't reach the server right now. Please try again in a moment.")
  }
  if (!res.ok) throw await apiFailure(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const base = (memberId: string) => `/members/${encodeURIComponent(memberId)}/saved-plans`

/** Keeps only the fields the contract defines. */
function cleanItems(items: TreatmentItem[]): TreatmentItem[] {
  return items.map((i) => ({ id: i.id, code: i.code, urgency: i.urgency, after: i.after }))
}

export const listSavedPlans = (memberId: string, token: string) => call<SavedPlan[]>(base(memberId), token)

export const createSavedPlan = (memberId: string, token: string, name: string, items: TreatmentItem[]) =>
  call<SavedPlan>(base(memberId), token, { method: "POST", body: JSON.stringify({ name, items: cleanItems(items) }) })

export const updateSavedPlan = (
  memberId: string,
  token: string,
  planId: string,
  changes: { name?: string; items?: TreatmentItem[] },
) =>
  call<SavedPlan>(`${base(memberId)}/${encodeURIComponent(planId)}`, token, {
    method: "PUT",
    body: JSON.stringify({
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.items !== undefined ? { items: cleanItems(changes.items) } : {}),
    }),
  })

export const deleteSavedPlan = (memberId: string, token: string, planId: string) =>
  call<void>(`${base(memberId)}/${encodeURIComponent(planId)}`, token, { method: "DELETE" })
