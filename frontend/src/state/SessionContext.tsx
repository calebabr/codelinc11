// Session state for the portal shell: who is signed in, their household, and
// which family member the app is currently showing ("active member").
//
// Until the household API lands (T05) this is backed by a small fictional mock.
// Pages must read the active member from here and never hard-code a person.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

export type Relationship = "self" | "spouse" | "child"
export type MemberRole = "primary" | "adult" | "managed"
export type MemberStatus = "active" | "pending"
export type PlanTier = "basic" | "preferred" | "premium"

export interface Member {
  id: string
  name: string
  relationship: Relationship
  age: number
  role: MemberRole
  status: MemberStatus
}

export interface Household {
  id: string
  name: string
  planTier: PlanTier
  members: Member[]
}

export interface Account {
  id: string
  name: string
  email: string
}

export interface SessionState {
  account: Account | null
  household: Household
  activeMember: Member
  setActiveMemberId: (id: string) => void
  signOut: () => void
}

// Fictional demo household (see agents/tasks/PLAN.md, "Demo household").
export const MOCK_HOUSEHOLD: Household = {
  id: "hh_rivera",
  name: "Rivera household",
  planTier: "preferred",
  members: [
    { id: "m_jordan", name: "Jordan Rivera", relationship: "self", age: 41, role: "primary", status: "active" },
    { id: "m_alex", name: "Alex Rivera", relationship: "spouse", age: 39, role: "adult", status: "active" },
    { id: "m_maya", name: "Maya Rivera", relationship: "child", age: 9, role: "managed", status: "active" },
    { id: "m_noah", name: "Noah Rivera", relationship: "child", age: 23, role: "adult", status: "pending" },
  ],
}

const MOCK_ACCOUNT: Account = { id: "acct_jordan", name: "Jordan Rivera", email: "jordan@example.com" }

const Ctx = createContext<SessionState | null>(null)

export function SessionProvider({
  children,
  household = MOCK_HOUSEHOLD,
  account = MOCK_ACCOUNT,
  initialMemberId,
}: {
  children: ReactNode
  household?: Household
  account?: Account | null
  initialMemberId?: string
}) {
  const [activeId, setActiveId] = useState(initialMemberId ?? household.members[0].id)
  const [signedInAccount, setAccount] = useState<Account | null>(account)

  const setActiveMemberId = useCallback(
    (id: string) => {
      if (household.members.some((m) => m.id === id)) setActiveId(id)
    },
    [household],
  )
  const signOut = useCallback(() => setAccount(null), [])

  const value = useMemo<SessionState>(() => {
    const activeMember = household.members.find((m) => m.id === activeId) ?? household.members[0]
    return { account: signedInAccount, household, activeMember, setActiveMemberId, signOut }
  }, [signedInAccount, household, activeId, setActiveMemberId, signOut])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): SessionState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>")
  return ctx
}
