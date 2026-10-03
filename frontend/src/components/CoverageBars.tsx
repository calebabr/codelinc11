import { money, pct } from '@/lib/format'
import type { Category, Plan } from '@/lib/types'

const ROWS: { cat: Category; label: string; bar: string }[] = [
  { cat: 'preventive', label: 'Preventive', bar: 'bg-emerald-500' },
  { cat: 'basic', label: 'Basic', bar: 'bg-sky-500' },
  { cat: 'major', label: 'Major', bar: 'bg-amber-500' },
]

/** Three coverage tiles with bars plus the yearly maximum. Percentages are plan fields. */
export function CoverageBars({ plan, compact = false }: { plan: Plan; compact?: boolean }) {
  return (
    <div className="space-y-3" aria-label={`Coverage for ${plan.name}`}>
      <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
        {ROWS.map((r) => {
          const share = plan.coinsurance[r.cat]
          return (
            <div key={r.cat} className="rounded-lg border bg-card p-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">{r.label}</span>
                <span className="text-lg font-bold">{pct(share)}</span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${r.bar}`}
                  style={{ width: `${Math.min(100, Math.max(0, share * 100))}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="rounded-lg border bg-card p-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Yearly maximum</span>
          <span className="text-lg font-bold text-brand">{money(plan.annual_max)}</span>
        </div>
        <div className="mt-1.5 h-2.5 rounded-full bg-gradient-to-r from-brand to-brand-orange" />
        <p className="mt-1 text-xs text-muted-foreground">Deductible: {money(plan.deductible)}</p>
      </div>
    </div>
  )
}
