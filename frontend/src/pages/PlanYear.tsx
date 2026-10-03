import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeading } from '@/components/AppShell'
import { MonthStrip, SegmentedControl } from '@/components/Controls'
import { Disclaimer } from '@/components/Disclaimer'
import { useCatalog } from '@/components/ProcedureGrid'
import { QuestionsCard } from '@/components/QuestionsCard'
import { SavingsTips } from '@/components/SavingsTips'
import { MaxPerYearChart, ScheduleChart } from '@/components/ScheduleChart'
import { SavingsBanner } from '@/components/SavingsBanner'
import { ErrorState, LoadingBlock } from '@/components/StateViews'
import { TreatmentBuilder } from '@/components/TreatmentBuilder'
import { YearTimeline } from '@/components/YearTimeline'
import { postSchedule } from '@/lib/api'
import type { ScheduleResponse, TreatmentItem } from '@/lib/types'
import { usePlan } from '@/state/PlanContext'

/** Demo case S2: root canal (urgent), crown after it, two fillings. */
const DEMO_ITEMS: TreatmentItem[] = [
  { id: 't1', code: 'D3330', urgency: 'urgent', after: null },
  { id: 't2', code: 'D2740', urgency: 'flexible', after: 't1' },
  { id: 't3', code: 'D2392', urgency: 'flexible', after: null },
  { id: 't4', code: 'D2392', urgency: 'flexible', after: null },
]

type View = 'optimized' | 'baseline'

export function PlanYear() {
  const { planRef, usage, currentMonth, selectPlan, setUsage, setCurrentMonth, draft, clearDraft } = usePlan()
  const [items, setItems] = useState<TreatmentItem[]>(draft.items)
  const [quotedFees] = useState<Record<string, number>>(draft.quotedFees)
  const [view, setView] = useState<View>('optimized')
  const [ranMonth, setRanMonth] = useState(currentMonth)
  const catalog = useCatalog()

  const optimize = useMutation<ScheduleResponse, Error, { list: TreatmentItem[]; month: number }>({
    mutationFn: ({ list, month }) =>
      postSchedule({ ...planRef, items: list, usage, current_month: month }),
    onSuccess: (_d, v) => {
      setView('optimized')
      setRanMonth(v.month)
    },
  })

  // Treatments sent over from the Dentist Quote page: optimize them right away, once.
  const handedOff = useRef(false)
  useEffect(() => {
    if (handedOff.current || draft.items.length === 0) return
    handedOff.current = true
    optimize.mutate({ list: draft.items, month: currentMonth })
    clearDraft()
  }, [draft.items, currentMonth, optimize, clearDraft])

  function changeItems(next: TreatmentItem[]) {
    setItems(next)
    optimize.reset()
  }

  function loadDemo() {
    selectPlan('demo_ppo')
    setUsage({ max_used: 1100, deductible_met: 50, history: [] })
    setCurrentMonth(11)
    setItems(DEMO_ITEMS)
    optimize.mutate({ list: DEMO_ITEMS, month: 11 })
  }

  function changeMonth(m: number) {
    setCurrentMonth(m)
    if (items.length > 0 && optimize.data) optimize.mutate({ list: items, month: m })
  }

  const data = optimize.data
  const shownItems = data ? (view === 'optimized' ? data.items : data.baseline_items) : []

  return (
    <div className="space-y-6">
      <PageHeading
        title="Plan my year"
        subtitle="Timing can change what you pay. Add your treatments and we'll find the cheapest order."
      />

      <Button variant="outline" onClick={loadDemo} className="h-10">
        <Sparkles /> Load demo case
      </Button>

      <TreatmentBuilder
        catalog={catalog.procedures}
        loading={catalog.isLoading}
        error={catalog.error}
        onRetry={() => catalog.refetch()}
        items={items}
        onChange={changeItems}
      />

      <MonthStrip
        label="What if I start in a different month?"
        value={currentMonth}
        onChange={changeMonth}
        caption="Tap a month to see how the plan changes if you start then."
      />

      <Button
        className="h-12 w-full bg-brand-orange text-base text-white hover:bg-brand-orange/90 sm:w-auto sm:px-8"
        disabled={items.length === 0 || optimize.isPending}
        onClick={() => optimize.mutate({ list: items, month: currentMonth })}
      >
        {optimize.isPending ? 'Optimizing…' : 'Optimize my year'}
      </Button>

      {optimize.isPending && <LoadingBlock label="Finding the best schedule" />}
      {optimize.isError && (
        <ErrorState error={optimize.error} onRetry={() => optimize.mutate({ list: items, month: currentMonth })} />
      )}

      {data && (
        <div className="space-y-6">
          <SavingsBanner baseline={data.baseline_you_pay} optimized={data.total_you_pay} savings={data.savings} />

          <SegmentedControl<View>
            label="Schedule view"
            value={view}
            onChange={setView}
            options={[
              { value: 'baseline', label: 'Everything now' },
              { value: 'optimized', label: 'Optimized' },
            ]}
          />

          <ScheduleChart key={view} items={shownItems} currentMonth={ranMonth} />
          {view === 'optimized' && data.years.length > 0 && <MaxPerYearChart years={data.years} />}

          {view === 'optimized' ? (
            <YearTimeline items={data.items} years={data.years} />
          ) : (
            <YearTimeline items={data.baseline_items} fallbackLabel="Everything this plan year" />
          )}

          {data.reasons.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Why this order?</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1.5 pl-5">
                  {data.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          <SavingsTips items={items} quotedFees={quotedFees} />
          <QuestionsCard codes={items.map((i) => i.code)} />
          <p className="text-sm text-muted-foreground">
            Urgent or painful care should never wait. Talk to your dentist about what is safe to schedule later.
          </p>
          <Disclaimer />
        </div>
      )}
    </div>
  )
}
