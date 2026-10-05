// A fixed session for page tests, with the real backend ids (hh-rivera, m-jordan,
// m-alex, m-noah, m-maya). No network calls. The token is `tok-<signed-in id>`.

import { useCallback, useMemo, useState, type ReactNode } from "react"
import { deleteHouseholdMember, patchMemberProfile, postHouseholdMember, putHouseholdNames, putHouseholdPlan } from "@/lib/api/family"
import { SessionGateContext, toHousehold, type SessionGateState, type SessionState } from "@/state/SessionContext"
import type { DemoAccount, FamilyHousehold, FamilyMember, HouseholdNamesRequest, PlanTierSummary, SandboxInfo } from "@/lib/types/family"

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
  jordan: { ...base, id: "m-jordan", name: "Abraham Lincoln", relationship: "self", age: 41, role: "primary", has_login: true, status: "active" },
  alex: { ...base, id: "m-alex", name: "Mary", relationship: "spouse", age: 39, role: "adult", has_login: true, status: "active" },
  maya: { ...base, id: "m-maya", name: "Tad", relationship: "child", age: 9, role: "managed", has_login: false, status: "active" },
  noah: {
    ...base,
    id: "m-noah",
    name: "Robert",
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
  { account_id: "acct-jordan", email: "abraham.lincoln@example.test", display_name: "Abraham Lincoln", member_id: "m-jordan", role: "primary", household_id: "hh-rivera" },
  { account_id: "acct-alex", email: "mary.lincoln@example.test", display_name: "Mary", member_id: "m-alex", role: "adult", household_id: "hh-rivera" },
  { account_id: "acct-noah", email: "robert.lincoln@example.test", display_name: "Robert", member_id: "m-noah", role: "adult", household_id: "hh-rivera", status: "pending" },
]

/** What the backend returns for this person: the primary sees everyone, others only themselves. */
export function householdFor(memberId: string, all: FamilyMember[] = ALL_MEMBERS): FamilyHousehold {
  const me = all.find((m) => m.id === memberId)!
  return {
    id: "hh-rivera",
    name: "Lincoln household",
    plan_tier: TIER,
    members: me.role === "primary" ? all : [me],
  }
}

export function TestSessionProvider({
  children,
  signedInId = "m-jordan",
  activeId,
  members = ALL_MEMBERS,
  namingPending = false,
  sandbox = null,
}: {
  children: ReactNode
  /** Who is signed in. */
  signedInId?: string
  /** Who is shown first. Defaults to the signed-in person. */
  activeId?: string
  /** Replace the household members (for example to give Robert no login). */
  members?: FamilyMember[]
  /** Show the "Name your family" card (first sign-in in a new demo family). */
  namingPending?: boolean
  /** The demo family info; set it to show the Rename family entry. */
  sandbox?: SandboxInfo | null
}) {
  const [signed, setSigned] = useState(signedInId)
  const [active, setActive] = useState(activeId ?? signedInId)
  const [fresh, setFresh] = useState<FamilyHousehold | null>(null)
  const [naming, setNaming] = useState(namingPending)
  const signIn = useCallback(async (id: string) => {
    setSigned(id)
    setFresh(null)
    setActive(id)
  }, [])

  const value = useMemo<SessionGateState>(() => {
    const household = toHousehold(fresh ?? householdFor(signed, members))
    const apply = async (h: FamilyHousehold) => setFresh(h)
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
      sandbox,
      namingPending: naming,
      dismissNaming: () => setNaming(false),
      renameFamily: async (body: HouseholdNamesRequest) => {
        await apply(await putHouseholdNames(household.id, body, `tok-${signed}`))
        setNaming(false)
      },
      refreshHousehold: async () => undefined,
      updateMember: async (id, patch) => {
        const saved = await patchMemberProfile(id, patch, `tok-${signed}`)
        await apply({ ...household, members: household.members.map((m) => (m.id === saved.id ? saved : m)) })
        return saved
      },
      addMember: async (body) => {
        const saved = await postHouseholdMember(household.id, body, `tok-${signed}`)
        await apply({ ...household, members: [...household.members, saved] })
        return saved
      },
      removeMember: async (id) => {
        await deleteHouseholdMember(household.id, id, `tok-${signed}`)
        await apply({ ...household, members: household.members.filter((m) => m.id !== id) })
      },
      changePlan: async (tierId) => apply(await putHouseholdPlan(household.id, tierId, `tok-${signed}`)),
    }
    return {
      status: "ready",
      error: null,
      retry: () => undefined,
      accounts: ACCOUNTS,
      signIn,
      tryDemo: async () => undefined,
      hasFamily: false,
      forgetFamily: async () => undefined,
      session,
    }
  }, [signed, active, signIn, members, fresh, naming, sandbox])

  return <SessionGateContext.Provider value={value}>{children}</SessionGateContext.Provider>
}
