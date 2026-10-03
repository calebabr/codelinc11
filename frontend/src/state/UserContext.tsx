// Per-user state for the prototype, saved to localStorage.
//
// This is the "user-specific database record" from the product notes: each
// profile holds its own plan, usage, dental history, must-haves and AI context,
// all keyed by a unique profile id. The chatbot only ever reads and writes the
// ACTIVE profile — the same isolation a real backend would enforce by user_id.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { Account, AiContext, Profile } from "@/lib/types"
import { SEED_ACCOUNTS, SEED_PROFILES } from "@/lib/seed"

const STORAGE_KEY = "pce.profiles.v1"
const ACTIVE_KEY = "pce.activeProfile.v1"

// The signed-in user. In a real app this comes from auth; here it's fixed to
// the seeded account. Every account read is scoped to this id.
const SEED_ACCOUNT = SEED_ACCOUNTS[0]

interface UserState {
  // The signed-in account's unique id. The chatbot is handed this to retrieve data.
  userId: string
  // The whole account record (subscriber + covered people), kept in sync with profiles.
  account: Account
  profiles: Profile[]
  activeId: string
  activeProfile: Profile
  setActiveId: (id: string) => void
  addProfile: (p: Omit<Profile, "id" | "history" | "schedule" | "aiContext"> & Partial<Pick<Profile, "aiContext">>) => void
  learn: (profileId: string, update: Partial<AiContext>) => void
  resetDemo: () => void
}

const Ctx = createContext<UserState | null>(null)

function load(): Profile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Profile[]
  } catch {
    /* ignore */
  }
  return SEED_PROFILES
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>(load)
  const [activeId, setActiveId] = useState<string>(() => {
    return localStorage.getItem(ACTIVE_KEY) ?? SEED_PROFILES[0].id
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
  }, [profiles])

  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, activeId)
  }, [activeId])

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeId) ?? profiles[0],
    [profiles, activeId],
  )

  const account: Account = useMemo(
    () => ({ ...SEED_ACCOUNT, members: profiles }),
    [profiles],
  )

  // Keep the retrieval source (used by the chatbot via getAccountByUserId) in
  // sync with the live, possibly-learned/added profiles for this user.
  useEffect(() => {
    SEED_ACCOUNT.members = profiles
  }, [profiles])

  const value: UserState = {
    userId: SEED_ACCOUNT.userId,
    account,
    profiles,
    activeId: activeProfile.id,
    activeProfile,
    setActiveId,
    addProfile: (p) => {
      const id = `p_${Date.now().toString(36)}`
      const newProfile: Profile = {
        id,
        history: [],
        schedule: [],
        aiContext: p.aiContext ?? {
          planHighlights: [],
          previousProcedures: [],
          previousQuestions: [],
          preferences: [],
        },
        ...p,
      }
      setProfiles((prev) => [...prev, newProfile])
      setActiveId(id)
    },
    learn: (profileId, update) => {
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === profileId ? { ...p, aiContext: { ...p.aiContext, ...update } } : p,
        ),
      )
    },
    resetDemo: () => {
      setProfiles(SEED_PROFILES)
      setActiveId(SEED_PROFILES[0].id)
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useUser(): UserState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useUser must be used inside <UserProvider>")
  return ctx
}
