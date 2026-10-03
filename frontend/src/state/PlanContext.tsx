/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPlans } from '@/lib/api'
import type { Plan, PlanRef, TreatmentItem, Usage } from '@/lib/types'

const STORAGE_KEY = 'dental-copilot-state-v1'

interface StoredState {
  planId: string | null
  customPlan: Plan | null
  usage: Usage
  currentMonth: number
}

const EMPTY_USAGE: Usage = { max_used: 0, deductible_met: 0, history: [] }

const DEFAULT_STATE: StoredState = {
  planId: 'demo_ppo',
  customPlan: null,
  usage: EMPTY_USAGE,
  currentMonth: 11,
}

function load(): StoredState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const p = JSON.parse(raw) as Partial<StoredState>
    return {
      planId: p.planId ?? (p.customPlan ? null : 'demo_ppo'),
      customPlan: p.customPlan ?? null,
      usage: {
        max_used: Number(p.usage?.max_used ?? 0),
        deductible_met: Number(p.usage?.deductible_met ?? 0),
        history: Array.isArray(p.usage?.history) ? p.usage!.history.map(String) : [],
      },
      currentMonth: Math.min(12, Math.max(1, Number(p.currentMonth ?? 11))),
    }
  } catch {
    return DEFAULT_STATE
  }
}

function save(state: StoredState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* storage unavailable: ignore */
  }
}

/** Treatments handed from the Dentist Quote page to Plan My Year (kept in memory only: health info). */
export interface TreatmentDraft {
  items: TreatmentItem[]
  /** treatment item id -> fee written on the dentist's quote */
  quotedFees: Record<string, number>
}

const EMPTY_DRAFT: TreatmentDraft = { items: [], quotedFees: {} }

interface PlanContextValue extends StoredState {
  draft: TreatmentDraft
  setDraft: (draft: TreatmentDraft) => void
  clearDraft: () => void
  /** What to send to the API so it knows which plan to use. */
  planRef: PlanRef
  selectPlan: (id: string) => void
  setCustomPlan: (plan: Plan) => void
  setUsage: (usage: Usage) => void
  setCurrentMonth: (month: number) => void
  /** Record a visit using values returned by the API. */
  logVisit: (code: string, maxUsedAfter: number, deductibleApplied: number) => void
  resetUsage: () => void
}

const PlanContext = createContext<PlanContextValue | null>(null)

export function PlanProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredState>(load)
  const [draft, setDraftState] = useState<TreatmentDraft>(EMPTY_DRAFT)
  const setDraft = useCallback((d: TreatmentDraft) => setDraftState(d), [])
  const clearDraft = useCallback(() => setDraftState(EMPTY_DRAFT), [])

  useEffect(() => {
    save(state)
  }, [state])

  const selectPlan = useCallback(
    (id: string) => setState((s) => ({ ...s, planId: id, customPlan: null })),
    [],
  )
  const setCustomPlan = useCallback(
    (plan: Plan) => setState((s) => ({ ...s, planId: null, customPlan: plan })),
    [],
  )
  const setUsage = useCallback((usage: Usage) => setState((s) => ({ ...s, usage })), [])
  const setCurrentMonth = useCallback(
    (currentMonth: number) => setState((s) => ({ ...s, currentMonth })),
    [],
  )
  const logVisit = useCallback(
    (code: string, maxUsedAfter: number, deductibleApplied: number) =>
      setState((s) => ({
        ...s,
        usage: {
          max_used: maxUsedAfter,
          deductible_met: s.usage.deductible_met + deductibleApplied,
          history: [...s.usage.history, code],
        },
      })),
    [],
  )
  const resetUsage = useCallback(() => setState((s) => ({ ...s, usage: EMPTY_USAGE })), [])

  const value = useMemo<PlanContextValue>(
    () => ({
      ...state,
      draft,
      setDraft,
      clearDraft,
      planRef: state.customPlan ? { plan: state.customPlan } : { plan_id: state.planId ?? 'demo_ppo' },
      selectPlan,
      setCustomPlan,
      setUsage,
      setCurrentMonth,
      logVisit,
      resetUsage,
    }),
    [state, draft, setDraft, clearDraft, selectPlan, setCustomPlan, setUsage, setCurrentMonth, logVisit, resetUsage],
  )

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext)
  if (!ctx) throw new Error('usePlan must be used inside <PlanProvider>')
  return ctx
}

/** The full Plan object for the current selection (custom plan or one fetched from /plans). */
export function useActivePlan() {
  const { planId, customPlan } = usePlan()
  const plans = useQuery({ queryKey: ['plans'], queryFn: getPlans, enabled: !customPlan })
  const plan: Plan | undefined = customPlan
    ? customPlan
    : plans.data?.find((p) => p.id === (planId ?? 'demo_ppo'))
  return { plan, isLoading: plans.isLoading && !customPlan, error: plans.error, refetch: plans.refetch }
}
