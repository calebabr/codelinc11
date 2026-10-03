import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeading } from '@/components/AppShell'
import { BreakdownCard } from '@/components/BreakdownCard'
import { SegmentedControl } from '@/components/Controls'
import { Disclaimer } from '@/components/Disclaimer'
import { QuestionsCard } from '@/components/QuestionsCard'
import { SavingsTips } from '@/components/SavingsTips'
import { MathTrace } from '@/components/MathTrace'
import { NetworkCompare } from '@/components/NetworkCompare'
import { ProcedureGrid, useCatalog } from '@/components/ProcedureGrid'
import { ProcedureSearch } from '@/components/ProcedureSearch'
import { ErrorState, LoadingBlock } from '@/components/StateViews'
import { TraceWaterfall } from '@/components/TraceWaterfall'
import { postEstimate } from '@/lib/api'
import type { Procedure } from '@/lib/types'
import { usePlan } from '@/state/PlanContext'

type Network = 'in' | 'out'

export function Estimate() {
  const { planRef, usage } = usePlan()
  const [selected, setSelected] = useState<Procedure | null>(null)
  const [network, setNetwork] = useState<Network>('in')
  const catalog = useCatalog()

  const q = useQuery({
    queryKey: ['estimate', selected?.code, planRef, usage],
    queryFn: () => postEstimate({ ...planRef, code: selected!.code, usage }),
    enabled: !!selected,
  })

  const shown = q.data && (network === 'in' ? q.data.in_network : q.data.out_of_network)

  return (
    <div className="space-y-6">
      <PageHeading
        title="What will I owe?"
        subtitle="Search or tap a procedure to see your cost before you book."
      />
      <ProcedureSearch onSelect={setSelected} />
      <ProcedureGrid
        procedures={catalog.procedures}
        loading={catalog.isLoading}
        error={catalog.error}
        onRetry={() => catalog.refetch()}
        onPick={setSelected}
        selectedCode={selected?.code}
        verb="Estimate"
      />

      {!selected && (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          Pick a procedure above to see what you'd pay.
        </p>
      )}
      {selected && q.isLoading && <LoadingBlock label="Calculating your estimate" />}
      {selected && q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && shown && (
        <div className="space-y-5">
          <SegmentedControl<Network>
            label="Dentist network"
            value={network}
            onChange={setNetwork}
            options={[
              { value: 'in', label: 'In-network dentist' },
              { value: 'out', label: 'Out-of-network dentist' },
            ]}
          />
          <BreakdownCard result={shown} />
          <TraceWaterfall trace={shown.trace} animateKey={`${selected?.code}-${network}`} />
          <NetworkCompare data={q.data} />
          <MathTrace trace={shown.trace} />
          <SavingsTips items={[{ id: 'e1', code: shown.code, urgency: 'flexible', after: null }]} />
          <QuestionsCard codes={[shown.code]} />
          <Disclaimer />
        </div>
      )}
    </div>
  )
}
