import { API_URL, ApiError, apiFailure } from "@/lib/api/planYear"
import type { Provider, ProviderQuery } from "@/lib/types/providers"

/** The query string for GET /providers. Empty and default values are left out. */
export function providersQuery(q: ProviderQuery): string {
  const p = new URLSearchParams()
  if (q.zip) p.set("zip", q.zip)
  p.set("radius_mi", String(q.radius_mi))
  p.set("network", q.network)
  if (q.specialty) p.set("specialty", q.specialty)
  if (q.accepting) p.set("accepting", "1")
  if (q.q && q.q.trim()) p.set("q", q.q.trim())
  if (q.code) p.set("code", q.code)
  if (q.member_id) p.set("member_id", q.member_id)
  return p.toString()
}

/** Nearby providers, nearest first (the server sorts). 422 carries a plain message about the ZIP. */
export async function getProviders(q: ProviderQuery, token: string, signal?: AbortSignal): Promise<Provider[]> {
  let res: Response
  try {
    res = await fetch(`${API_URL}/providers?${providersQuery(q)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    })
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") throw e
    throw new ApiError("We can't reach the server right now. Please try again in a moment.")
  }
  if (!res.ok) throw await apiFailure(res)
  return (await res.json()) as Provider[]
}
