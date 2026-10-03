// Session state for the portal: who is signed in, their bearer token, their
// household (from the backend) and which family member the app is showing
// ("active member").
//
// Sign-in is the demo flow: POST /auth/demo-login (no password). On load we sign in
// again only if the person chose an account earlier in this browser tab (remembered
// in sessionStorage only). Otherwise the status is "signed-out" and the app shows /login.
// The token stays in memory. Pages read everything from useSession() and never
// hard-code a person or fetch their own token.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { demoLogin, getDemoAccounts, getHousehold, putHouseholdPlan } from "@/lib/api/family"
import { errorMessage } from "@/lib/api/planYear"
import type { DemoAccount, FamilyHousehold, FamilyMember } from "@/lib/types/family"

export type Member = FamilyMember
export type MemberRole = FamilyMember["role"]
export type Household = FamilyHousehold & {
  /** The plan tier id ("basic", "preferred", "premium"). It is the plan id the API expects. */
  planTier: string
}

export interface Account {
  id: string
  name: string
  email: string
}

export interface SessionState {
  /** The demo account that is signed in (name and email). */
  account: Account | null
  /** The signed-in person. */
  user: Member
  household: Household
  /** The person the pages are showing. Starts as the signed-in person. */
  activeMember: Member
  setActiveMemberId: (id: string) => void
  /** Bearer token for API calls. */
  token: string
  /** Demo accounts, for the sign-in cards and the account switcher. */
  accounts: DemoAccount[]
  signIn: (memberId: string) => Promise<void>
  signOut: () => void
  /** Reload the household from the server (for example after the plan changed). */
  refreshHousehold: () => Promise<void>
  /** Switch the household to another plan tier (primary only). Every page updates at once. Throws an ApiError on failure. */
  changePlan: (tierId: string) => Promise<void>
}

export type SessionStatus = "loading" | "ready" | "error" | "signed-out"

export interface SessionGateState {
  status: SessionStatus
  error: string | null
  retry: () => void
  accounts: DemoAccount[]
  signIn: (memberId: string) => Promise<void>
  /** Set when status is "ready". */
  session: SessionState | null
}

const STORAGE_KEY = "dental.signedInMemberId"

function remembered(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}
function remember(id: string | null) {
  try {
    if (id) sessionStorage.setItem(STORAGE_KEY, id)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage may be blocked; the session still works */
  }
}

export function toHousehold(h: FamilyHousehold): Household {
  return { ...h, planTier: h.plan_tier.id }
}

const Ctx = createContext<SessionGateState | null>(null)

/** Used by tests and previews to supply a fixed session without calling the API. */
export const SessionGateContext = Ctx

interface Signed {
  token: string
  user: Member
  household: Household
}

export function SessionProvider({ children, initialMemberId }: { children: ReactNode; initialMemberId?: string }) {
  const [accounts, setAccounts] = useState<DemoAccount[]>([])
  const [signed, setSigned] = useState<Signed | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [status, setStatus] = useState<SessionStatus>("loading")
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const doSignIn = useCallback(async (memberId: string) => {
    const login = await demoLogin(memberId)
    // Reload the household with the new token so the member list is the server's current view.
    let household = login.household
    try {
      household = await getHousehold(login.household.id, login.token)
    } catch {
      /* the login response already carries the household */
    }
    remember(memberId)
    setSigned({ token: login.token, user: login.member, household: toHousehold(household) })
    setActiveId(login.member.id)
  }, [])

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    setError(null)
    const run = async () => {
      try {
        const list = await getDemoAccounts()
        if (cancelled) return
        setAccounts(list)
        const wanted = initialMemberId ?? remembered()
        const pick = wanted ? list.find((a) => a.member_id === wanted) : undefined
        if (!pick) {
          // Nobody signed in yet: the app sends the visitor to /login.
          if (list.length === 0) throw new Error("No demo accounts are available.")
          if (wanted) remember(null)
          setStatus("signed-out")
          return
        }
        await doSignIn(pick.member_id)
        if (!cancelled) setStatus("ready")
      } catch (e) {
        if (!cancelled) {
          setError(errorMessage(e))
          setStatus("error")
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
    // initialMemberId is only a first guess; it is not tracked after the first sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, doSignIn])

  const signIn = useCallback(
    async (memberId: string) => {
      await doSignIn(memberId)
      setStatus("ready")
    },
    [doSignIn],
  )
  const signOut = useCallback(() => {
    remember(null)
    setSigned(null)
    setActiveId(null)
    setStatus("signed-out")
  }, [])
  const refreshHousehold = useCallback(async () => {
    if (!signed) return
    const fresh = await getHousehold(signed.household.id, signed.token)
    setSigned((cur) => (cur ? { ...cur, household: toHousehold(fresh) } : cur))
  }, [signed])
  const changePlan = useCallback(
    async (tierId: string) => {
      if (!signed) return
      const fresh = await putHouseholdPlan(signed.household.id, tierId, signed.token)
      setSigned((cur) => (cur ? { ...cur, household: toHousehold(fresh) } : cur))
    },
    [signed],
  )
  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  const value = useMemo<SessionGateState>(() => {
    let session: SessionState | null = null
    if (signed && status === "ready") {
      const acct = accounts.find((a) => a.member_id === signed.user.id)
      const activeMember = signed.household.members.find((m) => m.id === activeId) ?? signed.user
      session = {
        account: acct ? { id: acct.account_id, name: acct.display_name, email: acct.email } : null,
        user: signed.user,
        household: signed.household,
        activeMember,
        setActiveMemberId: (id: string) => {
          if (signed.household.members.some((m) => m.id === id)) setActiveId(id)
        },
        token: signed.token,
        accounts,
        signIn,
        signOut,
        refreshHousehold,
        changePlan,
      }
    }
    return { status, error, retry, accounts, signIn, session }
  }, [signed, status, error, retry, accounts, activeId, signIn, signOut, refreshHousehold, changePlan])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** For the shell and the login page: loading, error and signed-out states. */
// eslint-disable-next-line react-refresh/only-export-components
export function useSessionGate(): SessionGateState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useSessionGate must be used inside <SessionProvider>")
  return ctx
}

/** For pages: the signed-in session. Pages are only shown once the session is ready. */
// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): SessionState {
  const { session } = useSessionGate()
  if (!session) throw new Error("useSession needs a signed-in session. Render pages inside the app shell.")
  return session
}
