import { useCallback, useEffect, useState } from "react"
import { errorMessage, getOverview, getSchedule, postDemoReset, postVisit, visitErrorMessage } from "@/lib/api/home"
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
export function useHomeData(token: string, memberId: string, planTier?: string) {
  const [state, setState] = useState<State<HomeData>>({ data: null, loading: true, error: null })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setState({ data: null, loading: true, error: null })
    Promise.all([getOverview(token, memberId), getSchedule(token, memberId)]).then(
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
  }, [token, memberId, planTier, attempt])
  /** Reload the numbers without blanking the page. */
  const refresh = useCallback(async () => {
    try {
      const [overview, schedule] = await Promise.all([getOverview(token, memberId), getSchedule(token, memberId)])
      setState({ data: { overview, schedule }, loading: false, error: null })
    } catch (e) {
      setState((s) => ({ ...s, error: errorMessage(e) }))
    }
  }, [token, memberId])
  return { ...state, retry: useCallback(() => setAttempt((n) => n + 1), []), refresh }
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

/** The result of the last visit saved for a member (from the backend, never added up here). */
export interface LoggedVisit {
  usage: Usage
  benefits: BenefitsStatus
  last: VisitEstimate
}

/** Saves a visit with POST /members/{id}/visits, then asks the page to reload the overview. */
export function useLogVisit(token: string, memberId: string, onSaved: () => Promise<void> | void) {
  const [logged, setLogged] = useState<Record<string, LoggedVisit>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setError(null), [memberId])

  const log = useCallback(
    async (code: string) => {
      setBusy(true)
      setError(null)
      try {
        const res = await postVisit(token, memberId, code)
        const last = (res.estimate as { in_network?: VisitEstimate }).in_network ?? (res.estimate as VisitEstimate)
        setLogged((l) => ({ ...l, [memberId]: { usage: res.usage, benefits: res.benefits, last } }))
        await onSaved()
      } catch (e) {
        setError(visitErrorMessage(e, "We could not save that visit."))
      } finally {
        setBusy(false)
      }
    },
    [token, memberId, onSaved],
  )
  const clear = useCallback(() => setLogged({}), [])
  return { logged: logged[memberId] ?? null, log, busy, error, clear }
}

/** Primary only. Resets the demo data on the server, then lets the page reload. */
export function useResetDemo(token: string, onDone: () => Promise<void> | void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const reset = useCallback(async () => {
    setBusy(true)
    setError(null)
    setDone(false)
    try {
      await postDemoReset(token)
      await onDone()
      setDone(true)
      return true
    } catch (e) {
      setError(visitErrorMessage(e, "We could not reset the demo data."))
      return false
    } finally {
      setBusy(false)
    }
  }, [token, onDone])
  return { reset, busy, error, done }
}
