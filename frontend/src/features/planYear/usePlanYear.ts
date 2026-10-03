import { useCallback, useEffect, useState } from "react"
import {
  errorMessage,
  getMemberUsage,
  postBenefitsStatus,
  postQuestions,
  postSavingsTips,
  postSchedule,
  type MemberUsage,
} from "@/lib/api/planYear"
import type {
  BenefitsStatus,
  QuestionsResponse,
  SavingsTipsResponse,
  ScheduleResponse,
  TreatmentItem,
  Urgency,
} from "@/lib/types/planYear"

/** Demo case S2: root canal (urgent), crown after it, two fillings. */
export const DEMO_ITEMS: TreatmentItem[] = [
  { id: "t1", code: "D3330", urgency: "urgent", after: null },
  { id: "t2", code: "D2740", urgency: "flexible", after: "t1" },
  { id: "t3", code: "D2392", urgency: "flexible", after: null },
  { id: "t4", code: "D2392", urgency: "flexible", after: null },
]

export interface Loadable<T> {
  data: T | null
  loading: boolean
  error: string | null
}

function idle<T>(): Loadable<T> {
  return { data: null, loading: false, error: null }
}

/** Runs one request whenever `key` changes; ignores answers that arrive late. */
function useRequest<T>(enabled: boolean, key: string, run: () => Promise<T>): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>(idle)
  useEffect(() => {
    if (!enabled) {
      setState(idle())
      return
    }
    let cancelled = false
    setState((s) => ({ data: s.data, loading: true, error: null }))
    run().then(
      (data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      },
      (err) => {
        if (!cancelled) setState({ data: null, loading: false, error: errorMessage(err) })
      },
    )
    return () => {
      cancelled = true
    }
    // `key` stands in for everything `run` closes over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key])
  return state
}

export function usePlanYear(memberId: string, planId: string, token: string) {
  const [items, setItems] = useState<TreatmentItem[]>([])
  const [nextId, setNextId] = useState(1)

  // Usage for the active member. Treatments are kept when switching; the schedule recomputes.
  const [memberUsage, setMemberUsage] = useState<Loadable<MemberUsage>>({ data: null, loading: true, error: null })
  useEffect(() => {
    let cancelled = false
    setMemberUsage({ data: null, loading: true, error: null })
    getMemberUsage(memberId, token).then(
      (data) => {
        if (!cancelled) setMemberUsage({ data, loading: false, error: null })
      },
      (err) => {
        if (!cancelled) setMemberUsage({ data: null, loading: false, error: errorMessage(err) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [memberId, token])

  const usage = memberUsage.data?.usage ?? null
  const plan = { plan_id: planId }
  const itemsKey = JSON.stringify(items)
  const baseKey = `${memberId}|${planId}|${JSON.stringify(usage)}`
  const ready = usage !== null
  const hasItems = items.length > 0
  const codes = [...new Set(items.map((i) => i.code))]

  const schedule = useRequest<ScheduleResponse>(ready && hasItems, `${baseKey}|${itemsKey}`, () =>
    postSchedule(plan, items, usage!),
  )
  const tips = useRequest<SavingsTipsResponse>(ready && hasItems, `${baseKey}|${itemsKey}`, () =>
    postSavingsTips(plan, items, usage!),
  )
  const questions = useRequest<QuestionsResponse>(ready && hasItems, `${baseKey}|${codes.join(",")}`, () =>
    postQuestions(plan, codes, usage!),
  )
  const benefits = useRequest<BenefitsStatus>(ready, baseKey, () => postBenefitsStatus(plan, usage!))

  const addItem = useCallback(
    (code: string) => {
      setItems((prev) => [...prev, { id: `t${nextId}`, code, urgency: "flexible", after: null }])
      setNextId((n) => n + 1)
    },
    [nextId],
  )
  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id).map((i) => (i.after === id ? { ...i, after: null } : i)))
  }, [])
  const setUrgency = useCallback((id: string, urgency: Urgency) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, urgency } : i)))
  }, [])
  const setAfter = useCallback((id: string, after: string | null) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, after } : i)))
  }, [])
  const loadDemo = useCallback(() => {
    setItems(DEMO_ITEMS)
    setNextId(DEMO_ITEMS.length + 1)
  }, [])
  const loadItems = useCallback((next: TreatmentItem[]) => {
    setItems(next)
    setNextId(next.length + 100)
  }, [])
  const clear = useCallback(() => setItems([]), [])

  return {
    items,
    addItem,
    removeItem,
    setUrgency,
    setAfter,
    loadDemo,
    loadItems,
    clear,
    memberUsage,
    schedule,
    tips,
    questions,
    benefits,
  }
}
