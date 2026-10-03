import { Card, CardContent } from '@/components/ui/card'
import { CategoryChip } from '@/components/CategoryChip'
import { Term } from '@/components/Glossary'
import { money } from '@/lib/format'
import type { EstimateResult } from '@/lib/types'

export function BreakdownCard({ result }: { result: EstimateResult }) {
  return (
    <Card className="overflow-hidden border-brand/20">
      <div className="h-1.5 bg-gradient-to-r from-brand to-brand-orange" />
      <CardContent className="space-y-5 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{result.name}</h2>
          <CategoryChip category={result.category} />
          <span className="text-xs text-muted-foreground">{result.code}</span>
        </div>

        <div>
          <p className="text-sm font-medium text-muted-foreground">You pay</p>
          <p
            data-testid="you-pay"
            aria-label={`You pay ${money(result.you_pay)}`}
            className="text-6xl font-bold tracking-tight text-brand sm:text-7xl"
          >
            {money(result.you_pay)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.in_network ? "with a dentist in your plan's network" : 'with a dentist outside your network'}
          </p>
        </div>

        {!result.covered && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="status">
            Your plan has reached its limit for this service this year, so it isn't covered right now.
            You'd pay the full price.
          </p>
        )}

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-muted/60 p-3">
            <dt className="text-muted-foreground">Plan pays</dt>
            <dd className="text-xl font-semibold text-emerald-700">{money(result.plan_pays)}</dd>
          </div>
          <div className="rounded-lg bg-muted/60 p-3">
            <dt className="text-muted-foreground">Dentist's typical price</dt>
            <dd className="text-xl font-semibold">{money(result.billed)}</dd>
          </div>
          <div className="rounded-lg bg-muted/60 p-3">
            <dt className="text-muted-foreground">
              Applied to your <Term term="deductible" />
            </dt>
            <dd className="text-xl font-semibold">{money(result.deductible_applied)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
