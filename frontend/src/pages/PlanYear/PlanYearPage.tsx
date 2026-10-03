import { useCallback, useEffect, useState } from "react"
import { useLocation } from "react-router"
import type { QuoteHandoff } from "@/features/costs/QuoteView"
import { useSession } from "@/state/SessionContext"
import { errorMessage, getProcedures } from "@/lib/api/planYear"
import type { Procedure } from "@/lib/types/planYear"
import { money } from "@/lib/format"
import { TreatmentBuilder } from "@/features/planYear/TreatmentBuilder"
import { SavingsBanner, Timeline, WhyThisOrder } from "@/features/planYear/ResultView"
import { CalendarReminder, QuestionsCard, SavingsTipsCard } from "@/features/planYear/Extras"
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
  const py = usePlanYear(activeMember.id, household.planTier, token)
  const location = useLocation()
  const handoff = (location.state as QuoteHandoff | null)?.treatments
  const { loadItems } = py
  useEffect(() => {
    if (handoff && handoff.length > 0) loadItems(handoff)
  }, [handoff, loadItems])
  const procs = useProcedures()
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
        <div className="space-y-4">
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
