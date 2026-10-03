import { CalendarDays } from 'lucide-react'
import { CATEGORY_STYLES, CategoryChip } from '@/components/CategoryChip'
import { MaxGauge } from '@/components/MaxGauge'
import { money, monthName } from '@/lib/format'
import type { ScheduledItem, YearSummary } from '@/lib/types'

function ItemRow({ item }: { item: ScheduledItem }) {
  return (
    <li className="flex gap-3">
      <div
        className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border text-xs font-semibold ${CATEGORY_STYLES[item.category]}`}
        aria-label={monthName(item.month)}
      >
        <CalendarDays className="size-3.5" aria-hidden="true" />
        {monthName(item.month).slice(0, 3)}
      </div>
      <div className="min-w-0 flex-1 rounded-xl border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.name}</span>
            <CategoryChip category={item.category} />
          </div>
          <span className="text-sm">
            You pay <strong>{money(item.you_pay)}</strong>
            <span className="text-muted-foreground"> · plan pays {money(item.plan_pays)}</span>
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{item.note}</p>
      </div>
    </li>
  )
}

export function YearTimeline({
  items,
  years,
  fallbackLabel = 'This plan year',
}: {
  items: ScheduledItem[]
  years?: YearSummary[]
  fallbackLabel?: string
}) {
  const offsets = Array.from(new Set(items.map((i) => i.year_offset))).sort((a, b) => a - b)
  return (
    <div className="space-y-4">
      {offsets.map((offset, idx) => {
        const summary = years?.find((y) => y.year_offset === offset)
        const group = items.filter((i) => i.year_offset === offset)
        return (
          <div key={offset} className="space-y-3">
            {idx > 0 && (
              <div className="flex items-center gap-3 py-1" role="separator" aria-label="New plan year">
                <div className="h-px flex-1 bg-brand-orange/50" />
                <span className="rounded-full bg-brand-orange px-3 py-1 text-xs font-semibold text-white">
                  New plan year: your maximum resets
                </span>
                <div className="h-px flex-1 bg-brand-orange/50" />
              </div>
            )}
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold">
                {summary?.label ?? (offset === 0 ? fallbackLabel : 'Next plan year')}
              </h3>
              {summary && (
                <span className="text-sm text-muted-foreground">
                  You pay {money(summary.you_pay)} · plan pays {money(summary.plan_pays)}
                </span>
              )}
            </div>
            <ol className="space-y-2" aria-label={summary?.label ?? fallbackLabel}>
              {group.map((it) => (
                <ItemRow key={it.id} item={it} />
              ))}
            </ol>
            {summary && (
              <MaxGauge
                label="Annual max used by end of year"
                used={summary.max_used_end}
                total={summary.max_used_end + summary.max_remaining_end}
                remainingText={`${money(summary.max_remaining_end)} of your maximum left`}
                tone="orange"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
