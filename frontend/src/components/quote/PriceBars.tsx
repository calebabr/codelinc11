import { money } from '@/lib/format'

/** More than this far above the typical price earns an "above typical" badge. */
export const ABOVE_TYPICAL_RATIO = 1.15

export function isAboveTypical(quoted: number | null, typical: number | null): boolean {
  return quoted != null && typical != null && typical > 0 && quoted > typical * ABOVE_TYPICAL_RATIO
}

/** Two horizontal bars: the fee on the dentist's quote vs. the typical in-network fee. Values come from the API. */
export function PriceBars({ quoted, typical }: { quoted: number | null; typical: number | null }) {
  if (quoted == null && typical == null) return null
  const top = Math.max(quoted ?? 0, typical ?? 0) || 1
  const row = (label: string, value: number | null, color: string) => (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="h-3 flex-1 rounded-full bg-muted" aria-hidden="true">
        {value != null && (
          <div className={`h-3 rounded-full ${color}`} style={{ width: `${Math.max(3, (value / top) * 100)}%` }} />
        )}
      </div>
      <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums">
        {value != null ? money(value) : 'n/a'}
      </span>
    </div>
  )
  return (
    <div className="space-y-1.5" role="group" aria-label="Quoted price compared with typical price">
      {row('Quoted', quoted, isAboveTypical(quoted, typical) ? 'bg-brand-orange' : 'bg-brand')}
      {row('Typical', typical, 'bg-emerald-500')}
    </div>
  )
}
