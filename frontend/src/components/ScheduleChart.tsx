import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CategoryChip } from '@/components/CategoryChip'
import { money, monthName, monthShort } from '@/lib/format'
import type { Category, ScheduledItem, YearSummary } from '@/lib/types'

const COLORS: Record<Category, string> = {
  preventive: '#059669',
  basic: '#0284c7',
  major: '#d97706',
}

interface Slot {
  slot: string
  [itemId: string]: string | number
}

function slotKey(offset: number, month: number) {
  return `y${offset}-${month}`
}
function slotLabel(key: string) {
  const [y, m] = key.slice(1).split('-').map(Number)
  return `${monthShort(m)}${y === 1 ? ' ’' : ''}`
}

function ItemTip({ active, payload, items }: TooltipContentProps & { items: ScheduledItem[] }) {
  if (!active || !payload?.length) return null
  const slot = String((payload[0].payload as Slot).slot)
  const here = items.filter((i) => slotKey(i.year_offset, i.month) === slot)
  return (
    <div className="max-w-64 space-y-2 rounded-lg border bg-popover p-3 text-xs shadow-md">
      {here.map((i) => (
        <div key={i.id}>
          <p className="text-sm font-semibold">
            {i.name} · {monthName(i.month)}
          </p>
          <p>
            You pay {money(i.you_pay)}, plan pays {money(i.plan_pays)}
          </p>
          <p className="text-muted-foreground">{i.note}</p>
        </div>
      ))}
    </div>
  )
}

/** Month-by-month chart: this plan year then the next, with a reset line. Click a bar for details. */
export function ScheduleChart({ items, currentMonth }: { items: ScheduledItem[]; currentMonth: number }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const hasNext = items.some((i) => i.year_offset === 1)
  const startMonth = Math.min(currentMonth, ...items.filter((i) => i.year_offset === 0).map((i) => i.month))

  const slots: string[] = []
  for (let m = startMonth; m <= 12; m++) slots.push(slotKey(0, m))
  if (hasNext) for (let m = 1; m <= 12; m++) slots.push(slotKey(1, m))

  const data: Slot[] = slots.map((s) => {
    const row: Slot = { slot: s }
    items.filter((i) => slotKey(i.year_offset, i.month) === s).forEach((i) => (row[i.id] = i.you_pay))
    return row
  })
  const selected = items.find((i) => i.id === selectedId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your year, month by month</CardTitle>
        <p className="text-xs text-muted-foreground">
          Each bar is one treatment (what you pay). Hover or tap a bar for details.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <div
            role="img"
            aria-label={`Schedule chart: ${items.map((i) => `${i.name} in ${monthName(i.month)}${i.year_offset ? ' next plan year' : ''}, you pay ${money(i.you_pay)}`).join('; ')}`}
            style={{ height: 300, minWidth: slots.length * 44 + 60 }}
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={300}>
              <BarChart data={data} margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="slot" tickFormatter={slotLabel} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => money(Number(v))} width={56} tick={{ fontSize: 11 }} />
                <Tooltip content={(p) => <ItemTip {...p} items={items} />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                <Legend content={() => null} />
                {hasNext && (
                  <ReferenceLine
                    x={slotKey(1, 1)}
                    stroke="#f5591f"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    label={{ value: 'New plan year', position: 'insideTopRight', fill: '#f5591f', fontSize: 11 }}
                  />
                )}
                {items.map((i) => (
                  <Bar
                    key={i.id}
                    dataKey={i.id}
                    stackId="a"
                    fill={COLORS[i.category]}
                    fillOpacity={selectedId && selectedId !== i.id ? 0.4 : 1}
                    radius={3}
                    isAnimationActive
                    animationDuration={600}
                    cursor="pointer"
                    onClick={() => setSelectedId(i.id === selectedId ? null : i.id)}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Treatments in this schedule">
          {items.map((i) => (
            <button
              key={i.id}
              type="button"
              aria-pressed={selectedId === i.id}
              onClick={() => setSelectedId(selectedId === i.id ? null : i.id)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted aria-pressed:border-brand aria-pressed:bg-brand/10"
            >
              <span className="size-2.5 rounded-full" style={{ background: COLORS[i.category] }} aria-hidden="true" />
              {monthShort(i.month)}
              {i.year_offset === 1 ? ' (next yr)' : ''}: {i.name}
            </button>
          ))}
        </div>
        {selected && (
          <div className="rounded-xl border bg-muted/40 p-3 text-sm" role="status">
            <div className="flex flex-wrap items-center gap-2">
              <strong>{selected.name}</strong>
              <CategoryChip category={selected.category} />
              <span>
                {monthName(selected.month)}
                {selected.year_offset === 1 ? ', next plan year' : ''}
              </span>
            </div>
            <p className="mt-1">
              You pay {money(selected.you_pay)} · plan pays {money(selected.plan_pays)}
            </p>
            <p className="text-muted-foreground">{selected.note}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Stacked bars of annual max used vs left for each plan year (API fields). */
export function MaxPerYearChart({ years }: { years: YearSummary[] }) {
  const data = years.map((y) => ({
    name: y.label,
    used: y.max_used_end,
    left: y.max_remaining_end,
  }))
  return (
    <Card>
      <CardHeader>
        <CardTitle>Yearly maximum used</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          role="img"
          aria-label={`Yearly maximum: ${years.map((y) => `${y.label}, ${money(y.max_used_end)} used, ${money(y.max_remaining_end)} left`).join('; ')}`}
          style={{ height: 200 }}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={200}>
            <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12 }}>
              <XAxis type="number" tickFormatter={(v) => money(Number(v))} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => money(Number(v))} />
              <Legend />
              <Bar dataKey="used" name="Used" stackId="m" fill="#6b0f2a" isAnimationActive animationDuration={600} />
              <Bar dataKey="left" name="Left" stackId="m" fill="#f5591f" fillOpacity={0.45} isAnimationActive animationDuration={600} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
