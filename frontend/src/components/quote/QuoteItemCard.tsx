import { X } from 'lucide-react'
import { CategoryChip } from '@/components/CategoryChip'
import { SegmentedControl } from '@/components/Controls'
import { Button } from '@/components/ui/button'
import { isAboveTypical, PriceBars } from '@/components/quote/PriceBars'
import type { Category, ParsedTreatment, Urgency } from '@/lib/types'

const URGENCY_OPTIONS: { value: Urgency; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'soon', label: 'Soon' },
  { value: 'flexible', label: 'Flexible' },
]

export function QuoteItemCard({
  item,
  category,
  onUrgency,
  onRemove,
}: {
  item: ParsedTreatment
  category?: Category
  onUrgency: (u: Urgency) => void
  onRemove: () => void
}) {
  const above = isAboveTypical(item.quoted_fee, item.typical_fee)
  const label = `${item.name}${item.tooth ? ` tooth ${item.tooth}` : ''}`
  return (
    <li
      className={`space-y-3 rounded-xl border bg-card p-4 shadow-sm ${item.matched ? '' : 'opacity-70'}`}
      data-testid="quote-item"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {category && <CategoryChip category={category} />}
            {item.code && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">{item.code}</span>
            )}
            {item.tooth && (
              <span className="rounded-full border border-brand/30 bg-brand/5 px-2 py-0.5 text-xs font-medium text-brand">
                Tooth {item.tooth}
              </span>
            )}
            {item.phase && <span className="text-xs text-muted-foreground">{item.phase}</span>}
          </div>
          <h3 className="text-base font-semibold break-words">{item.name}</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label={`Remove ${label}`}>
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <PriceBars quoted={item.quoted_fee} typical={item.typical_fee} />
      {above && (
        <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-900">
          Above typical
        </span>
      )}

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">How soon does this need to be done?</p>
        <SegmentedControl<Urgency>
          label={`Urgency for ${label}`}
          options={URGENCY_OPTIONS}
          value={item.urgency}
          onChange={onUrgency}
          size="sm"
        />
      </div>
    </li>
  )
}
