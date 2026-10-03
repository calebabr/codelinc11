import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { money } from '@/lib/format'
import type { TraceStep } from '@/lib/types'

function StepTip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const step = payload[0].payload as TraceStep & { name: string }
  return (
    <div className="max-w-64 rounded-lg border bg-popover p-3 text-xs shadow-md">
      <p className="text-sm font-semibold">
        {step.name}: {money(step.amount)}
      </p>
      <p className="mt-1 text-muted-foreground">{step.note}</p>
    </div>
  )
}

/** Interactive bar chart of the calculation steps. Values and notes come from the API trace. */
export function TraceWaterfall({ trace, animateKey }: { trace: TraceStep[]; animateKey?: string }) {
  const data = trace.map((t) => ({ ...t, name: t.label }))
  const last = data.length - 1
  return (
    <Card>
      <CardHeader>
        <CardTitle>How the cost adds up</CardTitle>
        <p className="text-xs text-muted-foreground">Hover or tap a bar to see what it means.</p>
      </CardHeader>
      <CardContent>
        <div
          role="img"
          aria-label={`Chart of cost steps: ${trace.map((t) => `${t.label} ${money(t.amount)}`).join(', ')}`}
          style={{ width: '100%', height: Math.max(200, data.length * 56) }}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={150}>
            <BarChart
              key={animateKey}
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 64, bottom: 4, left: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={StepTip} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
              <Bar dataKey="amount" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={700}>
                {data.map((_, i) => (
                  <Cell key={i} fill={i === last ? '#6b0f2a' : '#f5591f'} fillOpacity={i === last ? 1 : 0.75} />
                ))}
                <LabelList dataKey="amount" position="right" formatter={(v) => money(Number(v))} fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
