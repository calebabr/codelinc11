import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { PiggyBank } from 'lucide-react'
import { SliderField } from '@/components/Controls'
import { ErrorState, Skeleton } from '@/components/StateViews'
import { TipCard } from '@/components/savings/TipCard'
import { postSavingsTips } from '@/lib/api'
import type { TreatmentItem } from '@/lib/types'
import { usePlan } from '@/state/PlanContext'

const DEFAULT_RATE_PCT = 25
const NO_FEES: Record<string, number> = {}

export function SavingsTips({
  items,
  quotedFees,
}: {
  items: TreatmentItem[]
  quotedFees?: Record<string, number>
}) {
  const { planRef, usage, currentMonth } = usePlan()
  const [ratePct, setRatePct] = useState(DEFAULT_RATE_PCT)
  const [debounced, setDebounced] = useState(DEFAULT_RATE_PCT)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(ratePct), 250)
    return () => clearTimeout(t)
  }, [ratePct])

  const fees = quotedFees ?? NO_FEES
  const q = useQuery({
    queryKey: ['savings-tips', planRef, usage, currentMonth, items, fees, debounced],
    queryFn: () =>
      postSavingsTips({
        ...planRef,
        usage,
        current_month: currentMonth,
        items,
        quoted_fees: fees,
        tax_rate: debounced / 100,
      }),
    placeholderData: keepPreviousData,
  })

  if (q.isError) {
    return (
      <section aria-label="Ways to save">
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </section>
    )
  }
  if (q.isLoading) {
    return (
      <section aria-label="Ways to save" role="status" className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-28 w-full" />
      </section>
    )
  }
  const tips = q.data?.tips ?? []
  if (tips.length === 0) return null

  return (
    <section aria-labelledby="ways-to-save" className="space-y-3 rounded-2xl border bg-background p-4">
      <div className="flex items-center gap-2">
        <PiggyBank className="size-6 text-brand" aria-hidden="true" />
        <h2 id="ways-to-save" className="text-xl font-semibold">
          Ways to save
        </h2>
      </div>
      {q.data?.note && <p className="text-sm text-muted-foreground">{q.data.note}</p>}
      <ul className="space-y-3">
        {tips.map((tip) => (
          <TipCard key={tip.id} tip={tip}>
            {tip.kind === 'fsa_hsa' && (
              <SliderField
                label="Assumed tax rate"
                value={ratePct}
                min={10}
                max={40}
                step={1}
                display={`${ratePct}%`}
                onChange={setRatePct}
                hint="Your own rate may differ. The savings above update from this."
              />
            )}
          </TipCard>
        ))}
      </ul>
    </section>
  )
}
