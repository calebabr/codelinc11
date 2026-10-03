import { API_URL, ApiError } from "@/lib/api/planYear"
import type {
  DemoAccount,
  DemoLoginResponse,
  FamilyHousehold,
  InviteResponse,
  MemberOverview,
} from "@/lib/types/family"

async function call<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (init.body) headers["Content-Type"] = "application/json"
  if (token) headers.Authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers })
  } catch {
    throw new ApiError("We can't reach the server right now. Please try again in a moment.")
  }
  if (!res.ok) {
    let detail = ""
    try {
      const body = await res.json()
      if (typeof body?.detail === "string") detail = body.detail
    } catch {
      /* ignore */
    }
    throw new ApiError(detail || `The server returned an error (${res.status}).`, res.status)
  }
  return (await res.json()) as T
}

export const getDemoAccounts = () => call<DemoAccount[]>("/auth/demo-accounts", null)

export const demoLogin = (memberId: string) =>
  call<DemoLoginResponse>("/auth/demo-login", null, {
    method: "POST",
    body: JSON.stringify({ member_id: memberId }),
  })

export const getHousehold = (id: string, token: string) =>
  call<FamilyHousehold>(`/households/${encodeURIComponent(id)}`, token)

export const getMemberOverview = (id: string, token: string) =>
  call<MemberOverview>(`/members/${encodeURIComponent(id)}/overview`, token)

export const postInvite = (householdId: string, email: string, memberId: string, token: string) =>
  call<InviteResponse>(`/households/${encodeURIComponent(householdId)}/invites`, token, {
    method: "POST",
    body: JSON.stringify({ email, member_id: memberId }),
  })
