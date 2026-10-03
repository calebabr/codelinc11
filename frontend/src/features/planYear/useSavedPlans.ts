import { useCallback, useEffect, useState } from "react"
import {
  createSavedPlan,
  deleteSavedPlan,
  listSavedPlans,
  updateSavedPlan,
  type SavedPlan,
} from "@/lib/api/savedPlans"
import { errorMessage } from "@/lib/api/planYear"
import type { TreatmentItem } from "@/lib/types/planYear"

interface State {
  plans: SavedPlan[]
  loading: boolean
  error: string | null
  /** The saved-plans routes are not there yet (404). The rest of the page still works. */
  unavailable: boolean
}

const is404 = (e: unknown) => (e as { status?: number } | null)?.status === 404

/** Saved plans for one member. Reloads when the member changes. */
export function useSavedPlans(memberId: string, token: string) {
  const [state, setState] = useState<State>({ plans: [], loading: true, error: null, unavailable: false })
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setState({ plans: [], loading: true, error: null, unavailable: false })
    setActionError(null)
    listSavedPlans(memberId, token).then(
      (plans) => {
        if (!cancelled) setState({ plans, loading: false, error: null, unavailable: false })
      },
      (e) => {
        if (cancelled) return
        if (is404(e)) setState({ plans: [], loading: false, error: null, unavailable: true })
        else setState({ plans: [], loading: false, error: errorMessage(e), unavailable: false })
      },
    )
    return () => {
      cancelled = true
    }
  }, [memberId, token, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  /** Runs one change. Returns the result, or null after setting `actionError`. */
  const act = useCallback(async <T,>(run: () => Promise<T>): Promise<T | null> => {
    setBusy(true)
    setActionError(null)
    try {
      return await run()
    } catch (e) {
      setActionError(is404(e) ? "Saved plans are not available right now." : errorMessage(e))
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const create = useCallback(
    async (name: string, items: TreatmentItem[]) => {
      const rec = await act(() => createSavedPlan(memberId, token, name, items))
      if (rec) setState((s) => ({ ...s, plans: [rec, ...s.plans] }))
      return rec
    },
    [act, memberId, token],
  )
  const update = useCallback(
    async (planId: string, changes: { name?: string; items?: TreatmentItem[] }) => {
      const rec = await act(() => updateSavedPlan(memberId, token, planId, changes))
      if (rec) setState((s) => ({ ...s, plans: s.plans.map((p) => (p.id === planId ? rec : p)) }))
      return rec
    },
    [act, memberId, token],
  )
  const remove = useCallback(
    async (planId: string) => {
      const ok = await act(async () => {
        await deleteSavedPlan(memberId, token, planId)
        return true
      })
      if (ok) setState((s) => ({ ...s, plans: s.plans.filter((p) => p.id !== planId) }))
      return ok === true
    },
    [act, memberId, token],
  )

  return { ...state, busy, actionError, retry, create, update, remove }
}
