// Saved "Which plan fits us?" comparisons. Contract (backend, bearer token):
//   GET    /members/{id}/saved-simulations           -> SavedSimulation[] (newest first)
//   POST   /members/{id}/saved-simulations           -> 201 SavedSimulation  {name 1-60 chars, request}
//   PUT    /members/{id}/saved-simulations/{sim_id}  -> SavedSimulation      {name?, request?}
//   DELETE /members/{id}/saved-simulations/{sim_id}  -> 204
// The client sends only the choices. The server runs the simulation and stores its own summary.

import { API_URL, ApiError, apiFailure } from "@/lib/api/planYear"
import type { SavedSimulation } from "@/lib/types/savedSimulations"
import type { SimulateRequest } from "@/lib/types/simulate"

export const MAX_SIM_NAME_LENGTH = 60

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

const base = (memberId: string) => `/members/${encodeURIComponent(memberId)}/saved-simulations`

/** Keeps only the choices the contract defines. */
export function cleanRequest(r: SimulateRequest): SimulateRequest {
  return {
    members: r.members.map((m) => ({
      id: m.id,
      name: m.name,
      age: m.age,
      care_level: m.care_level,
      known_care: m.known_care.map((k) => ({ code: k.code, count: k.count })),
    })),
    ...(r.plan_ids ? { plan_ids: [...r.plan_ids] } : {}),
    n: r.n,
    seed: r.seed,
    in_network: r.in_network,
  }
}

export const listSavedSimulations = (memberId: string, token: string) => call<SavedSimulation[]>(base(memberId), token)

export const createSavedSimulation = (memberId: string, token: string, name: string, request: SimulateRequest) =>
  call<SavedSimulation>(base(memberId), token, { method: "POST", body: JSON.stringify({ name, request: cleanRequest(request) }) })

export const updateSavedSimulation = (memberId: string, token: string, simId: string, changes: { name?: string }) =>
  call<SavedSimulation>(`${base(memberId)}/${encodeURIComponent(simId)}`, token, {
    method: "PUT",
    body: JSON.stringify(changes.name !== undefined ? { name: changes.name } : {}),
  })

export const deleteSavedSimulation = (memberId: string, token: string, simId: string) =>
  call<void>(`${base(memberId)}/${encodeURIComponent(simId)}`, token, { method: "DELETE" })
