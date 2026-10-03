import { useCallback, useEffect, useState } from "react"
import { getPlans } from "@/lib/api/plans"
import type { PlanTier } from "@/lib/types/plans"

export function usePlans() {
  const [state, setState] = useState<{ plans: PlanTier[]; loading: boolean; error: string | null }>({
    plans: [],
    loading: true,
    error: null,
  })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    getPlans().then(
      (plans) => {
        if (!cancelled) setState({ plans, loading: false, error: null })
      },
      (e) => {
        if (!cancelled) setState({ plans: [], loading: false, error: e instanceof Error ? e.message : "Something went wrong." })
      },
    )
    return () => {
      cancelled = true
    }
  }, [attempt])
  return { ...state, retry: useCallback(() => setAttempt((n) => n + 1), []) }
}
