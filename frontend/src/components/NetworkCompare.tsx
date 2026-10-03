import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Term } from '@/components/Glossary'
import { money } from '@/lib/format'
import type { EstimateResponse, EstimateResult } from '@/lib/types'

function Column({ title, r, highlight }: { title: string; r: EstimateResult; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'border-brand/40' : ''}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-3xl font-bold text-brand" aria-label={`${title}: you pay ${money(r.you_pay)}`}>
          {money(r.you_pay)}
        </p>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Dentist charges</dt>
            <dd className="font-medium">{money(r.billed)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Plan pays</dt>
            <dd className="font-medium text-emerald-700">{money(r.plan_pays)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">
              Extra from <Term term="balanceBilling" />
            </dt>
            <dd className={`font-medium ${r.balance_bill > 0 ? 'text-brand-orange' : ''}`}>
              {money(r.balance_bill)}
            </dd>
          </div>
        </dl>
        {r.balance_bill > 0 && (
          <p className="rounded-lg bg-orange-50 p-2 text-xs text-orange-900">
            Out-of-network dentists can bill you the difference between their price and what your plan allows.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function NetworkCompare({ data }: { data: EstimateResponse }) {
  return (
    <section aria-label="In-network versus out-of-network" className="space-y-2">
      <h3 className="text-base font-semibold">In-network vs out-of-network</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Column title="In-network dentist" r={data.in_network} highlight />
        <Column title="Out-of-network dentist" r={data.out_of_network} />
      </div>
    </section>
  )
}
