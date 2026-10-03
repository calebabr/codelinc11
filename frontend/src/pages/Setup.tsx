import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeading } from '@/components/AppShell'
import { MonthStrip, SliderField, VisitChips } from '@/components/Controls'
import { CoverageBars } from '@/components/CoverageBars'
import { Term } from '@/components/Glossary'
import { ErrorState, Skeleton } from '@/components/StateViews'
import { getPlans } from '@/lib/api'
import { money, pct } from '@/lib/format'
import type { Page } from '@/lib/nav'
import type { Plan } from '@/lib/types'
import { useActivePlan, usePlan } from '@/state/PlanContext'

export function PlanSummary({ plan }: { plan: Plan }) {
  return (
    <Card className="border-brand/30 bg-brand/5">
      <CardHeader>
        <CardTitle>{plan.name}: in plain English</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-base">
        <p data-testid="plan-summary">
          Your plan pays {pct(plan.coinsurance.preventive)} of cleanings and checkups,{' '}
          {pct(plan.coinsurance.basic)} of fillings and other basic care, and {pct(plan.coinsurance.major)} of
          crowns and other major work.
        </p>
        <p className="text-sm text-muted-foreground">
          You pay the first {money(plan.deductible)} of non-preventive care yourself (your{' '}
          <Term term="deductible" />
          ). The plan stops paying once it has paid {money(plan.annual_max)} in a plan year (your{' '}
          <Term term="annualMax" />
          ).
        </p>
      </CardContent>
    </Card>
  )
}

/** Sliders for a custom plan, with a live preview of the coverage bars. */
export function CustomPlanBuilder({ initial, onSave }: { initial: Plan | null; onSave: (p: Plan) => void }) {
  const [deductible, setDeductible] = useState(initial?.deductible ?? 50)
  const [annualMax, setAnnualMax] = useState(initial?.annual_max ?? 1500)
  const [prev, setPrev] = useState(Math.round((initial?.coinsurance.preventive ?? 1) * 100))
  const [basic, setBasic] = useState(Math.round((initial?.coinsurance.basic ?? 0.8) * 100))
  const [major, setMajor] = useState(Math.round((initial?.coinsurance.major ?? 0.5) * 100))

  const draft: Plan = {
    id: 'custom',
    name: 'My custom plan',
    description: 'Plan you entered yourself.',
    monthly_premium: 0,
    deductible,
    deductible_waived_for: ['preventive'],
    annual_max: annualMax,
    coinsurance: { preventive: prev / 100, basic: basic / 100, major: major / 100 },
    frequency: { D1110: 2, D0120: 2 },
    plan_year_start_month: 1,
  }

  return (
    <div className="grid gap-5 rounded-xl border bg-card p-4 md:grid-cols-2">
      <div className="space-y-4">
        <SliderField label="Yearly deductible" value={deductible} min={0} max={250} step={25} display={money(deductible)} onChange={setDeductible} />
        <SliderField label="Yearly maximum" value={annualMax} min={500} max={4000} step={100} display={money(annualMax)} onChange={setAnnualMax} />
        <SliderField label="Plan pays for preventive" value={prev} min={0} max={100} step={5} display={`${prev}%`} onChange={setPrev} />
        <SliderField label="Plan pays for basic" value={basic} min={0} max={100} step={5} display={`${basic}%`} onChange={setBasic} />
        <SliderField label="Plan pays for major" value={major} min={0} max={100} step={5} display={`${major}%`} onChange={setMajor} />
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium">Live preview</p>
        <CoverageBars plan={draft} />
        <Button className="h-10 w-full" onClick={() => onSave(draft)}>
          Use this plan
        </Button>
      </div>
    </div>
  )
}

export function Setup({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { planId, customPlan, usage, currentMonth, selectPlan, setCustomPlan, setUsage, setCurrentMonth } =
    usePlan()
  const plans = useQuery({ queryKey: ['plans'], queryFn: getPlans })
  const { plan } = useActivePlan()
  const [showCustom, setShowCustom] = useState(!!customPlan)

  const cleaningLimit = plan?.frequency.D1110 ?? 2
  const cleanings = usage.history.filter((c) => c === 'D1110').length
  function setCleanings(n: number) {
    const others = usage.history.filter((c) => c !== 'D1110')
    setUsage({ ...usage, history: [...others, ...Array<string>(n).fill('D1110')] })
  }

  return (
    <div className="space-y-8">
      <PageHeading title="Set up your plan" subtitle="Two quick steps so every estimate fits you." />

      <section aria-labelledby="step1" className="space-y-3">
        <h2 id="step1" className="text-lg font-semibold">
          Step 1. Pick your plan
        </h2>
        {plans.isLoading && (
          <div className="grid gap-3 sm:grid-cols-2" role="status" aria-label="Loading plans">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        )}
        {plans.isError && <ErrorState error={plans.error} onRetry={() => plans.refetch()} />}
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.data?.map((p) => {
            const selected = !customPlan && planId === p.id
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={selected}
                aria-label={`Choose ${p.name}`}
                onClick={() => {
                  setShowCustom(false)
                  selectPlan(p.id)
                }}
                className={`space-y-3 rounded-xl border-2 bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  selected ? 'border-brand bg-brand/5' : 'border-border'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-lg font-semibold">{p.name}</span>
                  {selected && <Check className="size-5 text-brand" aria-label="Selected" />}
                </span>
                <span className="block text-sm text-muted-foreground">{p.description}</span>
                <CoverageBars plan={p} compact />
              </button>
            )
          })}
          <button
            type="button"
            aria-pressed={!!customPlan || showCustom}
            onClick={() => setShowCustom((v) => !v)}
            className={`rounded-xl border-2 border-dashed bg-card p-4 text-left hover:border-brand/60 ${
              customPlan ? 'border-brand bg-brand/5' : 'border-border'
            }`}
          >
            <span className="text-lg font-semibold">Enter my own plan</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Slide to set your deductible, yearly maximum and coverage percentages.
            </span>
          </button>
        </div>
        {showCustom && <CustomPlanBuilder initial={customPlan} onSave={setCustomPlan} />}
      </section>

      <section aria-labelledby="step2" className="space-y-3">
        <h2 id="step2" className="text-lg font-semibold">
          Step 2. What have you used this year?
        </h2>
        <Card>
          <CardContent className="space-y-6 pt-4">
            {plan ? (
              <>
                <SliderField
                  label="Yearly maximum used so far"
                  value={usage.max_used}
                  min={0}
                  max={plan.annual_max}
                  step={25}
                  display={`${money(usage.max_used)} of ${money(plan.annual_max)}`}
                  onChange={(n) => setUsage({ ...usage, max_used: n })}
                  hint="Drag to show how much your plan has already paid this year. Leave at $0 if you haven't had work yet."
                />
                <SliderField
                  label="Deductible met so far"
                  value={usage.deductible_met}
                  min={0}
                  max={plan.deductible}
                  step={5}
                  display={`${money(usage.deductible_met)} of ${money(plan.deductible)}`}
                  onChange={(n) => setUsage({ ...usage, deductible_met: n })}
                />
                <VisitChips label="Cleanings done this year" limit={cleaningLimit} count={Math.min(cleanings, cleaningLimit)} onChange={setCleanings} />
              </>
            ) : (
              <Skeleton className="h-40" />
            )}
            <MonthStrip label="What month is it now?" value={currentMonth} onChange={setCurrentMonth} />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="step3" className="space-y-3">
        <h2 id="step3" className="text-lg font-semibold">
          Your plan summary
        </h2>
        {plan ? <PlanSummary plan={plan} /> : <Skeleton className="h-32" />}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button className="h-11 px-6 text-base" onClick={() => onNavigate('estimate')}>
          Estimate a procedure
        </Button>
        <Button variant="outline" className="h-11 px-6 text-base" onClick={() => onNavigate('plan-year')}>
          Plan my year
        </Button>
        <Button variant="outline" className="h-11 px-6 text-base" onClick={() => onNavigate('benefits')}>
          See my benefits
        </Button>
      </div>
    </div>
  )
}
