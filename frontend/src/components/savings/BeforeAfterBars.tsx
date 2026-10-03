import { money } from '@/lib/format'

/** Two proportional bars. Widths are only a drawing of the API's before/after, never new dollars. */
export function BeforeAfterBars({ before, after }: { before: number; after: number }) {
  const top = Math.max(before, after, 1)
  const w = (n: number) => `${Math.max((n / top) * 100, n > 0 ? 3 : 0)}%`
  return (
    <div
      role="img"
      aria-label={`Before: ${money(before)}. After: ${money(after)}.`}
      className="space-y-1.5"
    >
      <div className="flex items-center gap-2 text-xs" aria-hidden="true">
        <span className="w-12 shrink-0 text-muted-foreground">Before</span>
        <div className="h-3 flex-1 rounded-full bg-muted">
          <div className="h-3 rounded-full bg-brand/70" style={{ width: w(before) }} />
        </div>
        <span className="w-16 shrink-0 text-right font-medium">{money(before)}</span>
      </div>
      <div className="flex items-center gap-2 text-xs" aria-hidden="true">
        <span className="w-12 shrink-0 text-muted-foreground">After</span>
        <div className="h-3 flex-1 rounded-full bg-muted">
          <div className="h-3 rounded-full bg-brand-orange" style={{ width: w(after) }} />
        </div>
        <span className="w-16 shrink-0 text-right font-medium">{money(after)}</span>
      </div>
    </div>
  )
}
