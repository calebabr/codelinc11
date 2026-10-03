import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "react-router"
import type { QuoteHandoff } from "@/features/costs/QuoteView"
import { useSession } from "@/state/SessionContext"
import { errorMessage, getProcedures } from "@/lib/api/planYear"
import type { Procedure } from "@/lib/types/planYear"
import { money } from "@/lib/format"
import { TreatmentBuilder } from "@/features/planYear/TreatmentBuilder"
import { SavingsBanner, Timeline, WhyThisOrder } from "@/features/planYear/ResultView"
import { CalendarReminder, QuestionsCard, SavingsTipsCard } from "@/features/planYear/Extras"
import { SavedPlans } from "@/features/planYear/SavedPlans"
import { useSavedPlans } from "@/features/planYear/useSavedPlans"
import { usePlanYear } from "@/features/planYear/usePlanYear"

function useProcedures() {
  const [state, setState] = useState<{ list: Procedure[]; loading: boolean; error: string | null }>({
    list: [],
    loading: true,
    error: null,
  })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    getProcedures().then(
      (m) => {
        if (!cancelled) setState({ list: m.map((x) => x.procedure), loading: false, error: null })
      },
      (e) => {
        if (!cancelled) setState({ list: [], loading: false, error: errorMessage(e) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [attempt])
  return { ...state, retry: useCallback(() => setAttempt((n) => n + 1), []) }
}

export default function PlanYearPage() {
  const { activeMember, household, token } = useSession()
  const py = usePlanYear(activeMember.id, household.planTier, token, household.id)
  const saved = useSavedPlans(activeMember.id, token)
  const location = useLocation()
  const handoff = (location.state as QuoteHandoff | null)?.treatments
  const { loadItems } = py
  // Load a hand-off from Costs once per navigation, into whoever is active then.
  const handled = useRef<string | null>(null)
  useEffect(() => {
    if (handoff && handoff.length > 0 && handled.current !== location.key) {
      handled.current = location.key
      loadItems(handoff)
    }
  }, [handoff, loadItems, location.key])
  const procs = useProcedures()
  const names = useMemo(() => new Map(procs.list.map((p) => [p.code, p.name])), [procs.list])
  const { schedule, benefits, memberUsage } = py
  const first = activeMember.name.split(" ")[0]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-bold text-burgundy sm:text-5xl">Plan My Year</h1>
        <p className="mt-2 max-w-2xl text-lg text-muted-foreground">
          Timing can change what you pay. Add the treatments {first} needs and we will find the cheapest order.
        </p>
        {benefits.data && (
          <p className="mt-2 text-sm" data-testid="left-this-year">
            <span className="chip chip-ok">{money(benefits.data.max_remaining)} left this year</span>
          </p>
        )}
      </header>

      <p className="note text-sm">Urgent or painful care should never wait. Urgent treatments always stay in the current year.</p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto" data-testid="treatments-column">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-orange" onClick={py.loadDemo}>Try the demo case</button>
            {py.items.length > 0 && (
              <button type="button" className="btn btn-outline" onClick={py.clear}>Start over</button>
            )}
          </div>
          <TreatmentBuilder
            procedures={procs.list}
            loading={procs.loading}
            error={procs.error}
            onRetry={procs.retry}
            items={py.items}
            onAdd={py.addItem}
            onRemove={py.removeItem}
            onUrgency={py.setUrgency}
            onAfter={py.setAfter}
          />
        </div>

        <div className="space-y-6" aria-live="polite">
          {memberUsage.error && <p role="alert" className="note">{memberUsage.error}</p>}
          <SavedPlans
            firstName={first}
            memberId={activeMember.id}
            saved={saved}
            items={py.items}
            openPlanId={py.openPlanId}
            names={names}
            onOpen={(plan) => py.loadItems(plan.items, plan.id)}
            onSavedAs={(plan) => py.setOpenPlanId(plan.id)}
          />
          {py.items.length === 0 && (
            <div className="portal-card text-center">
              <p className="portal-card-title">Your plan will show up here</p>
              <p className="text-sm text-muted-foreground">Add a treatment, or try the demo case, to see the cheapest schedule.</p>
            </div>
          )}
          {py.items.length > 0 && schedule.loading && !schedule.data && (
            <p role="status" className="portal-card text-sm">Finding the best schedule...</p>
          )}
          {schedule.error && <p role="alert" className="note">{schedule.error}</p>}
          {schedule.data && (
            <>
              <SavingsBanner data={schedule.data} />
              <Timeline data={schedule.data} annualMax={benefits.data?.annual_max ?? null} />
              <WhyThisOrder reasons={schedule.data.reasons} />
              <SavingsTipsCard state={py.tips} />
              <QuestionsCard state={py.questions} />
              <CalendarReminder benefits={benefits.data} />
            </>
          )}
          <p className="text-xs text-muted-foreground">
            This is an estimate. Your actual cost depends on your dentist's charges and claim review.
          </p>
        </div>
      </div>
    </div>
  )
}
