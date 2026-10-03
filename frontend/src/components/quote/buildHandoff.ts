import type { TreatmentDraft } from '@/state/PlanContext'
import type { ParsedTreatment } from '@/lib/types'

/** Turn the (possibly edited) parsed items into what Plan My Year expects. Matched items only. */
export function buildHandoff(items: ParsedTreatment[]): TreatmentDraft {
  const matched = items.filter((i) => i.matched && i.code)
  const ids = new Set(matched.map((i) => i.id))
  const quotedFees: Record<string, number> = {}
  for (const i of matched) if (i.quoted_fee != null) quotedFees[i.id] = i.quoted_fee
  return {
    items: matched.map((i) => ({
      id: i.id,
      code: i.code as string,
      urgency: i.urgency,
      after: i.after && ids.has(i.after) ? i.after : null,
    })),
    quotedFees,
  }
}
