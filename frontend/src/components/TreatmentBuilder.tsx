import { useState } from 'react'
import { Link2, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CATEGORY_STYLES } from '@/components/CategoryChip'
import { SegmentedControl } from '@/components/Controls'
import { ProcedureGrid } from '@/components/ProcedureGrid'
import { money } from '@/lib/format'
import type { Procedure, TreatmentItem, Urgency } from '@/lib/types'

const URGENCY_OPTIONS: { value: Urgency; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'soon', label: 'Soon' },
  { value: 'flexible', label: 'Flexible' },
]

export function nextItemId(items: TreatmentItem[]): string {
  let n = items.length + 1
  while (items.some((i) => i.id === `t${n}`)) n++
  return `t${n}`
}

/** Procedure cards add to a tray; each tray chip has a 3-way urgency toggle and an order link. */
export function TreatmentBuilder({
  catalog,
  loading,
  error,
  onRetry,
  items,
  onChange,
}: {
  catalog: Procedure[]
  loading?: boolean
  error?: unknown
  onRetry?: () => void
  items: TreatmentItem[]
  onChange: (items: TreatmentItem[]) => void
}) {
  const [linking, setLinking] = useState<string | null>(null)
  const find = (c: string) => catalog.find((p) => p.code === c)
  const nameOf = (c: string) => find(c)?.name ?? c

  function add(p: Procedure) {
    if (items.length >= 10) return
    onChange([...items, { id: nextItemId(items), code: p.code, urgency: 'flexible', after: null }])
  }
  function patch(id: string, p: Partial<TreatmentItem>) {
    onChange(items.map((i) => (i.id === id ? { ...i, ...p } : i)))
  }
  function remove(id: string) {
    setLinking(null)
    onChange(items.filter((i) => i.id !== id).map((i) => (i.after === id ? { ...i, after: null } : i)))
  }
  function pickFirst(firstId: string) {
    if (!linking || linking === firstId) return
    const first = items.find((i) => i.id === firstId)
    if (first?.after === linking) return // would create a loop
    patch(linking, { after: firstId })
    setLinking(null)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Tap treatments to add them</CardTitle>
        </CardHeader>
        <CardContent>
          <ProcedureGrid
            procedures={catalog}
            loading={loading}
            error={error}
            onRetry={onRetry}
            onPick={add}
            verb="Add"
          />
          {items.length >= 10 && (
            <p className="mt-3 text-xs text-muted-foreground">You can plan up to 10 procedures at a time.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My treatment tray ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing here yet. Tap a card above, or load the demo case.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2" aria-label="My treatment tray">
              {items.map((it) => {
                const proc = find(it.code)
                const firstItem = it.after ? items.find((x) => x.id === it.after) : undefined
                const canBeFirst = !!linking && linking !== it.id && items.find((x) => x.id === linking)?.id !== it.after
                return (
                  <li
                    key={it.id}
                    className={`space-y-2 rounded-xl border-2 p-3 ${
                      proc ? CATEGORY_STYLES[proc.category] : 'bg-card'
                    } ${linking === it.id ? 'ring-2 ring-brand' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold leading-tight">{nameOf(it.code)}</p>
                        {proc && <p className="text-xs opacity-80">Typically {money(proc.fee_p50)}</p>}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${nameOf(it.code)}`}
                        onClick={() => remove(it.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <SegmentedControl<Urgency>
                      label={`Urgency for ${nameOf(it.code)}`}
                      size="sm"
                      options={URGENCY_OPTIONS}
                      value={it.urgency}
                      onChange={(u) => patch(it.id, { urgency: u })}
                    />
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {firstItem ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1">
                          <Link2 className="size-3" aria-hidden="true" /> After {nameOf(firstItem.code)}
                          <button
                            type="button"
                            aria-label={`Remove order link for ${nameOf(it.code)}`}
                            onClick={() => patch(it.id, { after: null })}
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ) : linking === it.id ? (
                        <>
                          <span className="font-medium">Now tap the treatment that comes first</span>
                          <button type="button" className="underline" onClick={() => setLinking(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Set order for ${nameOf(it.code)}: must come after another treatment`}
                          className="inline-flex items-center gap-1 rounded-full border border-current/30 bg-white/60 px-2 py-1 font-medium hover:bg-white"
                          onClick={() => setLinking(it.id)}
                        >
                          <Link2 className="size-3" aria-hidden="true" /> Must come after…
                        </button>
                      )}
                      {canBeFirst && (
                        <button
                          type="button"
                          aria-label={`Do ${nameOf(it.code)} first`}
                          className="rounded-full bg-brand px-2 py-1 font-medium text-white"
                          onClick={() => pickFirst(it.id)}
                        >
                          Do this first
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
