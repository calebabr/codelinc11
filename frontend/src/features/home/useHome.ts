import { useCallback, useEffect, useState } from "react"
import { errorMessage, getOverview, getSchedule, postBenefits, postEstimate } from "@/lib/api/home"
import { getProcedures } from "@/lib/api/planYear"
import type { BenefitsStatus, MemberOverview, Procedure, ScheduleEntry, Usage, VisitEstimate } from "@/lib/types/home"

export interface HomeData {
  overview: MemberOverview
  schedule: ScheduleEntry[]
}

interface State<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/** Loads the overview and schedule for the active member. Reloads when the member changes. */
export function useHomeData(signInAs: string, memberId: string) {
  const [state, setState] = useState<State<HomeData>>({ data: null, loading: true, error: null })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setState({ data: null, loading: true, error: null })
    Promise.all([getOverview(signInAs, memberId), getSchedule(signInAs, memberId)]).then(
      ([overview, schedule]) => {
        if (!cancelled) setState({ data: { overview, schedule }, loading: false, error: null })
      },
      (e) => {
        if (!cancelled) setState({ data: null, loading: false, error: errorMessage(e) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [signInAs, memberId, attempt])
  return { ...state, retry: useCallback(() => setAttempt((n) => n + 1), []) }
}

export function useProcedureChips() {
  const [list, setList] = useState<Procedure[]>([])
  useEffect(() => {
    let cancelled = false
    getProcedures().then(
      (m) => !cancelled && setList(m.map((x) => x.procedure)),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [])
  return list
}

/** Visits logged on this page for each member. Only the member shown is ever changed. */
export interface LoggedVisit {
  usage: Usage
  benefits: BenefitsStatus
  last: VisitEstimate
}

export function useLogVisit(planId: string, memberId: string, overview: MemberOverview | null) {
  const [logged, setLogged] = useState<Record<string, LoggedVisit>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setError(null), [memberId])

  const log = useCallback(
    async (code: string) => {
      if (!overview) return
      const base: Usage = logged[memberId]?.usage ?? {
        max_used: overview.usage.max_used,
        deductible_met: overview.usage.deductible_met,
        history: Array.from({ length: overview.usage.cleanings_used }, () => "D1110"),
      }
      setBusy(true)
      setError(null)
      try {
        const est = (await postEstimate(planId, code, base)).in_network
        // Carry the engine's results forward as the member's new usage.
        const usage: Usage = {
          max_used: est.max_used_after,
          deductible_met: base.deductible_met + est.deductible_applied,
          history: est.covered ? [...base.history, code] : base.history,
        }
        const benefits = await postBenefits(planId, usage)
        setLogged((l) => ({ ...l, [memberId]: { usage, benefits, last: est } }))
      } catch (e) {
        setError(errorMessage(e))
      } finally {
        setBusy(false)
      }
    },
    [overview, logged, memberId, planId],
  )
  return { logged: logged[memberId] ?? null, log, busy, error }
}
