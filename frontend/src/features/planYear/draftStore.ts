// One treatment-list draft per person, kept in memory so it outlives the page and
// mirrored to localStorage so a reload keeps it. Keyed by household and member id.
// Storage is versioned, wrapped in try/catch and ignores bad JSON.

import { useCallback, useSyncExternalStore } from "react"
import type { TreatmentItem, Urgency } from "@/lib/types/planYear"

export interface Draft {
  items: TreatmentItem[]
  /** Id of the saved plan this draft was opened from or saved as, if any. */
  openPlanId: string | null
}

export const STORAGE_KEY = "dental.planYear.drafts.v1"
const EMPTY: Draft = { items: [], openPlanId: null }

let drafts: Record<string, Draft> | null = null
const listeners = new Set<() => void>()

const URGENCIES: Urgency[] = ["urgent", "soon", "flexible"]

function validItem(x: unknown): x is TreatmentItem {
  if (!x || typeof x !== "object") return false
  const i = x as Record<string, unknown>
  return (
    typeof i.id === "string" &&
    typeof i.code === "string" &&
    URGENCIES.includes(i.urgency as Urgency) &&
    (i.after === null || typeof i.after === "string")
  )
}

function readStorage(): Record<string, Draft> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as { v?: unknown; drafts?: unknown }
    if (parsed?.v !== 1 || !parsed.drafts || typeof parsed.drafts !== "object") return {}
    const out: Record<string, Draft> = {}
    for (const [key, value] of Object.entries(parsed.drafts as Record<string, unknown>)) {
      const d = value as { items?: unknown; openPlanId?: unknown }
      if (!d || !Array.isArray(d.items)) continue
      out[key] = {
        items: d.items.filter(validItem),
        openPlanId: typeof d.openPlanId === "string" ? d.openPlanId : null,
      }
    }
    return out
  } catch {
    return {}
  }
}

function writeStorage(all: Record<string, Draft>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, drafts: all }))
  } catch {
    /* storage may be blocked or full; drafts still live in memory */
  }
}

function current(): Record<string, Draft> {
  if (drafts === null) drafts = readStorage()
  return drafts
}

export const draftKey = (householdId: string, memberId: string) => `${householdId}|${memberId}`

export function getDraft(key: string): Draft {
  return current()[key] ?? EMPTY
}

export function setDraft(key: string, update: (d: Draft) => Draft) {
  const all = current()
  const next = update(all[key] ?? EMPTY)
  const copy = { ...all }
  if (next.items.length === 0 && next.openPlanId === null) delete copy[key]
  else copy[key] = next
  drafts = copy
  writeStorage(copy)
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** The draft for one person and a setter. The same draft comes back after a remount. */
export function useDraft(key: string): [Draft, (update: (d: Draft) => Draft) => void] {
  const draft = useSyncExternalStore(subscribe, () => getDraft(key))
  const set = useCallback((update: (d: Draft) => Draft) => setDraft(key, update), [key])
  return [draft, set]
}

/** Test helper. Forgets memory; with `clearStorage` also wipes localStorage, otherwise the next read reloads from it. */
export function resetDraftStoreForTests(clearStorage = true) {
  drafts = null
  if (clearStorage) {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l())
}
