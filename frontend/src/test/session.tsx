// A fixed session for page tests, with the real backend ids (hh-rivera, m-jordan,
// m-alex, m-noah, m-maya). No network calls. The token is `tok-<signed-in id>`.

import { useCallback, useMemo, useState, type ReactNode } from "react"
import { SessionGateContext, toHousehold, type SessionGateState, type SessionState } from "@/state/SessionContext"
import type { DemoAccount, FamilyHousehold, FamilyMember, PlanTierSummary } from "@/lib/types/family"

export const TIER: PlanTierSummary = {
  id: "preferred",
  name: "Preferred",
  monthly_premium: 44,
  annual_max: 1500,
  deductible: 50,
  preventive_pct: 100,
  basic_pct: 80,
  major_pct: 50,
  ortho_pct: 50,
}

const base = { household_id: "hh-rivera", status_note: null }
export const MEMBERS: Record<"jordan" | "alex" | "maya" | "noah", FamilyMember> = {
  jordan: { ...base, id: "m-jordan", name: "Jordan Rivera", relationship: "self", age: 41, role: "primary", has_login: true, status: "active" },
  alex: { ...base, id: "m-alex", name: "Alex Rivera", relationship: "spouse", age: 39, role: "adult", has_login: true, status: "active" },
  maya: { ...base, id: "m-maya", name: "Maya Rivera", relationship: "child", age: 9, role: "managed", has_login: false, status: "active" },
  noah: {
    ...base,
    id: "m-noah",
    name: "Noah Rivera",
    relationship: "child",
    age: 23,
    role: "adult",
    has_login: true,
    status: "pending",
    status_note: "Waiting for proof of full-time student status.",
  },
}
export const ALL_MEMBERS: FamilyMember[] = [MEMBERS.jordan, MEMBERS.alex, MEMBERS.maya, MEMBERS.noah]

export const ACCOUNTS: DemoAccount[] = [
  { account_id: "acct-jordan", email: "jordan.rivera@example.test", display_name: "Jordan Rivera", member_id: "m-jordan", role: "primary", household_id: "hh-rivera" },
  { account_id: "acct-alex", email: "alex.rivera@example.test", display_name: "Alex Rivera", member_id: "m-alex", role: "adult", household_id: "hh-rivera" },
  { account_id: "acct-noah", email: "noah.rivera@example.test", display_name: "Noah Rivera", member_id: "m-noah", role: "adult", household_id: "hh-rivera" },
]

/** What the backend returns for this person: the primary sees everyone, others only themselves. */
export function householdFor(memberId: string, all: FamilyMember[] = ALL_MEMBERS): FamilyHousehold {
  const me = all.find((m) => m.id === memberId)!
  return {
    id: "hh-rivera",
    name: "Rivera household",
    plan_tier: TIER,
    members: me.role === "primary" ? all : [me],
  }
}

export function TestSessionProvider({
  children,
  signedInId = "m-jordan",
  activeId,
  members = ALL_MEMBERS,
}: {
  children: ReactNode
  /** Who is signed in. */
  signedInId?: string
  /** Who is shown first. Defaults to the signed-in person. */
  activeId?: string
  /** Replace the household members (for example to give Noah no login). */
  members?: FamilyMember[]
}) {
  const [signed, setSigned] = useState(signedInId)
  const [active, setActive] = useState(activeId ?? signedInId)
  const signIn = useCallback(async (id: string) => {
    setSigned(id)
    setActive(id)
  }, [])

  const value = useMemo<SessionGateState>(() => {
    const household = toHousehold(householdFor(signed, members))
    const user = members.find((m) => m.id === signed)!
    const acct = ACCOUNTS.find((a) => a.member_id === signed)
    const session: SessionState = {
      account: acct ? { id: acct.account_id, name: acct.display_name, email: acct.email } : null,
      user,
      household,
      activeMember: household.members.find((m) => m.id === active) ?? user,
      setActiveMemberId: (id) => {
        if (household.members.some((m) => m.id === id)) setActive(id)
      },
      token: `tok-${signed}`,
      accounts: ACCOUNTS,
      signIn,
      signOut: () => undefined,
    }
    return { status: "ready", error: null, retry: () => undefined, accounts: ACCOUNTS, signIn, session }
  }, [signed, active, signIn, members])

  return <SessionGateContext.Provider value={value}>{children}</SessionGateContext.Provider>
}
