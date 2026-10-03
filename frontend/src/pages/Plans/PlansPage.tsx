import { useState } from "react"
import { useSession } from "@/state/SessionContext"
import { usePlans } from "@/features/plans/usePlans"
import { CompareTable, CoverageBars, TierCard, frequencyLines, summaryLines } from "@/features/plans/PlanParts"

export default function PlansPage() {
  const { household } = useSession()
  const { plans, loading, error, retry } = usePlans()
  const [picked, setPicked] = useState<string | null>(null)
  const selected = plans.find((p) => p.id === (picked ?? household.planTier)) ?? plans[0]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-bold text-burgundy sm:text-5xl">Plans</h1>
        <p className="mt-2 max-w-2xl text-lg text-muted-foreground">
          Compare the three dental plans and see what each one covers in plain English.
        </p>
      </header>

      {loading && <p role="status" className="portal-card text-sm">Loading plans...</p>}
      {error && (
        <div role="alert" className="note">
          <p>{error}</p>
          <button type="button" className="btn btn-outline mt-2" onClick={retry}>Try again</button>
        </div>
      )}
      {!loading && !error && plans.length === 0 && <p className="portal-card text-sm">No plans are available right now.</p>}

      {selected && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((p) => (
              <TierCard key={p.id} plan={p} selected={p.id === selected.id} isYours={p.id === household.planTier} onSelect={() => setPicked(p.id)} />
            ))}
          </div>

          <section className="portal-card" aria-label={`${selected.name} coverage`}>
            <h2 className="portal-card-title">What {selected.name} covers</h2>
            {selected.description && <p className="mb-4 text-sm text-muted-foreground">{selected.description}</p>}
            <div className="grid gap-6 md:grid-cols-2">
              <CoverageBars plan={selected} />
              <div>
                <ul className="list-disc space-y-1 pl-5 text-sm" data-testid="plan-summary">
                  {summaryLines(selected).map((l) => <li key={l}>{l}</li>)}
                </ul>
                {frequencyLines(selected).length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {frequencyLines(selected).map((l) => <li key={l}>{l}</li>)}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section className="portal-card" aria-label="Side by side">
            <h2 className="portal-card-title">Side by side</h2>
            <CompareTable plans={plans} selectedId={selected.id} />
          </section>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        This is an estimate. Your actual cost depends on your dentist's charges and claim review.
      </p>
    </div>
  )
}
