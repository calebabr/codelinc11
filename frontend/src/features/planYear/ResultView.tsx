import { money } from "@/lib/format"
import type { ScheduledItem, ScheduleResponse, YearSummary } from "@/lib/types/planYear"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

/** Bar width for display only (a layout ratio, not a dollar amount shown to anyone). */
function barWidth(value: number, max: number): number {
  if (!(max > 0)) return 0
  return Math.max(0, Math.min(100, (value / max) * 100))
}

export function SavingsBanner({ data }: { data: ScheduleResponse }) {
  return (
    <section aria-labelledby="py-savings" className="result-panel rounded-[var(--radius-card)] p-6 sm:p-8">
      <h2 id="py-savings" className="eyebrow">Your savings</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-sm opacity-90">Doing everything now</p>
          <p className="money text-3xl sm:text-4xl" data-testid="baseline-total">{money(data.baseline_you_pay)}</p>
        </div>
        <div>
          <p className="text-sm opacity-90">Best order for the year</p>
          <p className="money text-3xl sm:text-4xl" data-testid="optimized-total">{money(data.total_you_pay)}</p>
        </div>
        <div>
          <p className="text-sm opacity-90">You save</p>
          <p className="money text-4xl sm:text-5xl" data-testid="savings-total">{money(data.savings)}</p>
        </div>
      </div>
      <p className="mt-4 text-sm opacity-90">These are the amounts you pay after your plan pays its share.</p>
    </section>
  )
}

function YearBlock({ year, items, annualMax }: { year: YearSummary; items: ScheduledItem[]; annualMax: number | null }) {
  const mine = items.filter((i) => i.year_offset === year.year_offset)
  const byMonth = new Map<number, ScheduledItem[]>()
  for (const it of mine) byMonth.set(it.month, [...(byMonth.get(it.month) ?? []), it])
  const months = [...byMonth.keys()].sort((a, b) => a - b)

  return (
    <section aria-label={year.label} className="portal-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="portal-card-title !mb-0">{year.label}</h3>
        <p className="text-sm">
          You pay <strong className="money text-lg text-burgundy">{money(year.you_pay)}</strong>
        </p>
      </div>
      {annualMax !== null && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Yearly maximum used: <strong className="text-ink">{money(year.max_used_end)}</strong> of {money(annualMax)}
          </p>
          <div
            className="coverage mt-1"
            role="progressbar"
            aria-label={`${year.label} yearly maximum used`}
            aria-valuemin={0}
            aria-valuemax={annualMax}
            aria-valuenow={year.max_used_end}
            aria-valuetext={`${money(year.max_used_end)} of ${money(annualMax)}`}
          >
            <i style={{ width: `${barWidth(year.max_used_end, annualMax)}%` }} />
          </div>
        </div>
      )}
      {months.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No treatments in this year.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {months.map((m) => (
            <li key={m} className="grid gap-2 sm:grid-cols-[7rem_1fr]">
              <p className="font-bold text-burgundy">{MONTHS[m - 1]}</p>
              <ul className="space-y-2">
                {byMonth.get(m)!.map((it) => (
                  <li key={it.id} className="rounded-2xl border border-line bg-white p-3" data-testid="timeline-item">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold">{it.name}</p>
                      <p className="text-sm">
                        You pay <strong className="money">{money(it.you_pay)}</strong>
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">Plan pays {money(it.plan_pays)}. {it.note}</p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export function Timeline({ data, annualMax }: { data: ScheduleResponse; annualMax: number | null }) {
  const years = [...data.years].sort((a, b) => a.year_offset - b.year_offset)
  return (
    <section aria-labelledby="py-timeline" className="space-y-3">
      <h2 id="py-timeline" className="text-2xl font-bold text-burgundy">Month by month</h2>
      {years.map((y, idx) => (
        <div key={y.year_offset}>
          {idx > 0 && (
            <div className="my-3 flex items-center gap-3" role="separator" aria-label="Your plan year resets">
              <span className="h-px flex-1 bg-line" />
              <span className="chip chip-ok">Your yearly maximum resets in January</span>
              <span className="h-px flex-1 bg-line" />
            </div>
          )}
          <YearBlock year={y} items={data.items} annualMax={annualMax} />
        </div>
      ))}
    </section>
  )
}

export function WhyThisOrder({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null
  return (
    <section aria-labelledby="py-why" className="portal-card">
      <h2 id="py-why" className="portal-card-title">Why this order</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        {reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </section>
  )
}
