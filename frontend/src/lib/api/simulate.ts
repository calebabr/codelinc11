import { API_URL, ApiError, apiFailure } from "@/lib/api/planYear"
import type { SimulateRequest, SimulateResponse } from "@/lib/types/simulate"

export async function postSimulate(body: SimulateRequest, token: string | null, signal?: AbortSignal): Promise<SimulateResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(`${API_URL}/simulate`, { method: "POST", headers, body: JSON.stringify(body), signal })
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e
    throw new ApiError("We can't reach the server right now. Please try again in a moment.")
  }
  if (!res.ok) throw await apiFailure(res)
  const data = (await res.json()) as SimulateResponse
  if (!data || !Array.isArray(data.plans) || !Array.isArray(data.bin_edges)) {
    throw new ApiError("The server sent back something we could not read. Please try again.")
  }
  return data
}
