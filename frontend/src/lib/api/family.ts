import { API_URL, ApiError, apiFailure } from "@/lib/api/planYear"
import type {
  DemoAccount,
  DemoLoginResponse,
  FamilyHousehold,
  HouseholdNamesRequest,
  InviteResponse,
  NewMemberRequest,
  ProfilePatch,
  FamilyMember,
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
  if (!res.ok) throw await apiFailure(res)
  return (await res.json()) as T
}

/** The demo accounts: the template ones, or (with a family id) that demo family's own. 410 if the family is gone. */
export const getDemoAccounts = (householdId?: string | null) =>
  call<DemoAccount[]>(
    householdId ? `/auth/demo-accounts?household_id=${encodeURIComponent(householdId)}` : "/auth/demo-accounts",
    null,
  )

/**
 * Sign in to the visitor's own demo family. Without `householdId` the server makes a new family;
 * with it, the server reuses that family (410 if it is unknown or has expired).
 */
export const demoLogin = (memberId: string, householdId?: string | null) =>
  call<DemoLoginResponse>("/auth/demo-login", null, {
    method: "POST",
    body: JSON.stringify({ member_id: memberId, sandbox: true, ...(householdId ? { household_id: householdId } : {}) }),
  })

/** Rename the people in the demo family (primary only, demo families only). Returns the updated household. */
export const putHouseholdNames = (householdId: string, body: HouseholdNamesRequest, token: string) =>
  call<FamilyHousehold>(`/households/${encodeURIComponent(householdId)}/names`, token, {
    method: "PUT",
    body: JSON.stringify(body),
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

/** Switch the household's plan tier. Primary only. Returns the updated household. */
export const putHouseholdPlan = (householdId: string, tierId: string, token: string) =>
  call<FamilyHousehold>(`/households/${encodeURIComponent(householdId)}/plan`, token, {
    method: "PUT",
    body: JSON.stringify({ tier_id: tierId }),
  })


/** Change one person's profile. Send only the changed fields. Returns the updated member. */
export const patchMemberProfile = (memberId: string, body: ProfilePatch, token: string) =>
  call<FamilyMember>(`/members/${encodeURIComponent(memberId)}/profile`, token, {
    method: "PATCH",
    body: JSON.stringify(body),
  })

/** Add a person to the demo family (primary only). Returns the new member. */
export const postHouseholdMember = (householdId: string, body: NewMemberRequest, token: string) =>
  call<FamilyMember>(`/households/${encodeURIComponent(householdId)}/members`, token, {
    method: "POST",
    body: JSON.stringify(body),
  })

/** Remove a person and their saved data (primary only; never the primary). */
export const deleteHouseholdMember = (householdId: string, memberId: string, token: string) =>
  call<{ ok: boolean; member_id: string }>(
    `/households/${encodeURIComponent(householdId)}/members/${encodeURIComponent(memberId)}`,
    token,
    { method: "DELETE" },
  )
