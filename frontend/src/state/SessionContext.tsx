// Session state for the portal: who is signed in, their bearer token, their
// household (from the backend) and which family member the app is showing
// ("active member").
//
// Sign-in is the demo flow: POST /auth/demo-login (no password). Every visitor gets their
// own demo family (a sandbox copy of the template household, `sandbox: true`). The family id is
// remembered in localStorage (versioned key) so a refresh or a later visit reuses the same
// family; if the server says it is gone (410) we quietly start a new one. On load we sign in
// again only if the person chose an account earlier in this browser tab (remembered in
// sessionStorage only). Otherwise the status is "signed-out" and the app shows /login.
// The token stays in memory. Pages read everything from useSession() and never
// hard-code a person or fetch their own token.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  deleteHouseholdMember,
  demoLogin,
  getDemoAccounts,
  getHousehold,
  patchMemberProfile,
  postHouseholdMember,
  putHouseholdNames,
  putHouseholdPlan,
} from "@/lib/api/family"
import { ApiError, errorMessage } from "@/lib/api/planYear"
import type {
  DemoAccount,
  FamilyHousehold,
  FamilyMember,
  HouseholdNamesRequest,
  NewMemberRequest,
  ProfilePatch,
  SandboxInfo,
} from "@/lib/types/family"

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
  /** The demo family this visitor is in (null if the server did not make one). */
  sandbox: SandboxInfo | null
  /** True right after a new demo family was made and its account holder has not named it yet. */
  namingPending: boolean
  /** Hide the "Name your family" card (Skip, or after saving). */
  dismissNaming: () => void
  /** Rename the people in the demo family (primary only). Every page updates at once. Throws an ApiError on failure. */
  renameFamily: (body: HouseholdNamesRequest) => Promise<void>
  /** Reload the household from the server (for example after the plan changed). */
  refreshHousehold: () => Promise<void>
  /** Save profile changes for one person (only the changed fields). Returns the updated member. Throws an ApiError. */
  updateMember: (memberId: string, patch: ProfilePatch) => Promise<Member>
  /** Add a person to the demo family (primary only). Returns the new member. Throws an ApiError. */
  addMember: (body: NewMemberRequest) => Promise<Member>
  /** Remove a person from the demo family (primary only). Throws an ApiError. */
  removeMember: (memberId: string) => Promise<void>
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
  /** One tap: sign in as the account holder in a brand-new demo family. */
  tryDemo: () => Promise<void>
  /** True if this browser remembers a demo family from an earlier visit. */
  hasFamily: boolean
  /** Forget the remembered demo family, so the next sign-in starts a new one. */
  forgetFamily: () => Promise<void>
  /** Set when status is "ready". */
  session: SessionState | null
}

const STORAGE_KEY = "dental.signedInMemberId"
/** localStorage key for the remembered demo family. The "v1" is the shape version. */
export const FAMILY_KEY = "dental.demoFamily.v1"

interface FamilyRecord {
  v: 1
  household_id: string
  /** The "Name your family" card has not been answered yet. */
  naming_pending: boolean
}

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

function readFamily(): FamilyRecord | null {
  try {
    const raw = localStorage.getItem(FAMILY_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<FamilyRecord> | null
    if (!v || v.v !== 1 || typeof v.household_id !== "string" || !v.household_id) return null
    return { v: 1, household_id: v.household_id, naming_pending: v.naming_pending === true }
  } catch {
    return null // blocked storage or bad JSON: act as if nothing was remembered
  }
}
function writeFamily(rec: FamilyRecord | null) {
  try {
    if (rec) localStorage.setItem(FAMILY_KEY, JSON.stringify(rec))
    else localStorage.removeItem(FAMILY_KEY)
  } catch {
    /* storage may be blocked; the session still works */
  }
}

/** A demo-family id ends in a six-character suffix ("<id>.3f9a1c"). The template id is what comes before it. */
function templateId(id: string): string {
  return id.replace(/\.[0-9a-f]{6}$/, "")
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
  const [family, setFamily] = useState<FamilyRecord | null>(() => readFamily())
  const [sandbox, setSandbox] = useState<SandboxInfo | null>(null)

  const saveFamily = useCallback((rec: FamilyRecord | null) => {
    writeFamily(rec)
    setFamily(rec)
  }, [])

  /** Sign in to the visitor's demo family: reuse the remembered one, or make a new one (also if it is gone). */
  const doSignIn = useCallback(
    async (memberId: string, fresh = false) => {
      let familyId = fresh ? null : (readFamily()?.household_id ?? null)
      let login
      try {
        login = await demoLogin(memberId, familyId)
      } catch (e) {
        if (!(familyId && e instanceof ApiError && e.status === 410)) throw e
        // The family expired or no longer exists: start a new one as the same person.
        saveFamily(null)
        familyId = null
        login = await demoLogin(templateId(memberId), null)
      }
      // Reload the household with the new token so the member list is the server's current view.
      let household = login.household
      try {
        household = await getHousehold(login.household.id, login.token)
      } catch {
        /* the login response already carries the household */
      }
      if (login.sandbox) {
        const created = !familyId
        saveFamily({
          v: 1,
          household_id: login.sandbox.household_id,
          naming_pending: created ? login.member.role === "primary" : (readFamily()?.naming_pending ?? false),
        })
        setSandbox(login.sandbox)
        // The sign-in cards and account switcher should list this family's own accounts.
        try {
          setAccounts(await getDemoAccounts(login.sandbox.household_id))
        } catch {
          /* keep the list we have */
        }
      } else {
        setSandbox(null)
      }
      remember(login.member.id)
      setSigned({ token: login.token, user: login.member, household: toHousehold(household) })
      setActiveId(login.member.id)
    },
    [saveFamily],
  )

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    setError(null)
    const run = async () => {
      try {
        let list: DemoAccount[]
        const fam = readFamily()
        try {
          list = await getDemoAccounts(fam?.household_id)
        } catch (e) {
          if (!(fam && e instanceof ApiError && e.status === 410)) throw e
          saveFamily(null) // that family is gone: show the template accounts instead
          list = await getDemoAccounts()
        }
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
  const tryDemo = useCallback(async () => {
    // Always from the template accounts: the account holder in a brand-new family.
    const template = await getDemoAccounts()
    const primary = template.find((a) => a.role === "primary")
    if (!primary) throw new ApiError("The demo is not available right now. Please try again in a moment.")
    await doSignIn(primary.member_id, true)
    setStatus("ready")
  }, [doSignIn])
  const forgetFamily = useCallback(async () => {
    saveFamily(null)
    setSandbox(null)
    try {
      setAccounts(await getDemoAccounts())
    } catch {
      /* the login page shows the error when the visitor tries again */
    }
  }, [saveFamily])
  const signOut = useCallback(() => {
    remember(null)
    setSigned(null)
    setActiveId(null)
    setStatus("signed-out")
  }, [])

  /** Names can change (rename, reset), so the signed-in person and the account list follow the household. */
  const applyHousehold = useCallback(
    async (fresh: FamilyHousehold) => {
      setSigned((cur) => {
        if (!cur) return cur
        const me = fresh.members.find((m) => m.id === cur.user.id)
        return { ...cur, user: me ?? cur.user, household: toHousehold(fresh) }
      })
      if (sandbox) {
        try {
          setAccounts(await getDemoAccounts(sandbox.household_id))
        } catch {
          /* keep the list we have */
        }
      }
    },
    [sandbox],
  )
  const refreshHousehold = useCallback(async () => {
    if (!signed) return
    await applyHousehold(await getHousehold(signed.household.id, signed.token))
  }, [signed, applyHousehold])
  const dismissNaming = useCallback(() => {
    setFamily((cur) => {
      if (!cur) return cur
      const next = { ...cur, naming_pending: false }
      writeFamily(next)
      return next
    })
  }, [])
  const renameFamily = useCallback(
    async (body: HouseholdNamesRequest) => {
      if (!signed) return
      await applyHousehold(await putHouseholdNames(signed.household.id, body, signed.token))
      dismissNaming()
    },
    [signed, applyHousehold, dismissNaming],
  )
  const changePlan = useCallback(
    async (tierId: string) => {
      if (!signed) return
      const fresh = await putHouseholdPlan(signed.household.id, tierId, signed.token)
      setSigned((cur) => (cur ? { ...cur, household: toHousehold(fresh) } : cur))
    },
    [signed],
  )
  /** Show a change at once, then quietly reload the household from the server. */
  const applyMembers = useCallback(
    async (change: (members: Member[]) => Member[]) => {
      if (!signed) return
      const next = { ...signed.household, members: change(signed.household.members) }
      await applyHousehold(next)
      try {
        await applyHousehold(await getHousehold(signed.household.id, signed.token))
      } catch {
        /* the local change already shows */
      }
    },
    [signed, applyHousehold],
  )
  const updateMember = useCallback(
    async (memberId: string, patch: ProfilePatch) => {
      if (!signed) throw new ApiError("Please sign in again.")
      const saved = await patchMemberProfile(memberId, patch, signed.token)
      await applyMembers((ms) => ms.map((m) => (m.id === saved.id ? saved : m)))
      return saved
    },
    [signed, applyMembers],
  )
  const addMember = useCallback(
    async (body: NewMemberRequest) => {
      if (!signed) throw new ApiError("Please sign in again.")
      const saved = await postHouseholdMember(signed.household.id, body, signed.token)
      await applyMembers((ms) => [...ms.filter((m) => m.id !== saved.id), saved])
      return saved
    },
    [signed, applyMembers],
  )
  const removeMember = useCallback(
    async (memberId: string) => {
      if (!signed) throw new ApiError("Please sign in again.")
      await deleteHouseholdMember(signed.household.id, memberId, signed.token)
      await applyMembers((ms) => ms.filter((m) => m.id !== memberId))
      setActiveId((cur) => (cur === memberId ? signed.user.id : cur))
    },
    [signed, applyMembers],
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
        sandbox,
        namingPending: !!family?.naming_pending && signed.user.role === "primary",
        dismissNaming,
        renameFamily,
        refreshHousehold,
        updateMember,
        addMember,
        removeMember,
        changePlan,
      }
    }
    return { status, error, retry, accounts, signIn, tryDemo, hasFamily: family !== null, forgetFamily, session }
  }, [
    signed, status, error, retry, accounts, activeId, signIn, tryDemo, forgetFamily, family, sandbox,
    signOut, dismissNaming, renameFamily, refreshHousehold, updateMember, addMember, removeMember, changePlan,
  ])

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
