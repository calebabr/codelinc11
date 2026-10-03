import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts'
import { Progress } from '@/components/ui/progress'
import { money } from '@/lib/format'

/** Radial gauge of the yearly maximum. Dollar figures are API fields; the arc is a display ratio. */
export function MaxRadialGauge({
  used,
  total,
  remaining,
}: {
  used: number
  total: number
  remaining: number
}) {
  const percent = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0
  return (
    <div
      className="relative mx-auto h-56 w-56"
      role="img"
      aria-label={`Yearly maximum: ${money(used)} used of ${money(total)}, ${money(remaining)} left`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={150} minHeight={150}>
        <RadialBarChart
          data={[{ name: 'Used', value: percent }]}
          innerRadius="72%"
          outerRadius="100%"
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={12} background={{ fill: '#f1e3e7' }} fill="#6b0f2a" isAnimationActive animationDuration={800} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-brand" data-testid="max-remaining">
          {money(remaining)}
        </span>
        <span className="text-xs text-muted-foreground">left of {money(total)}</span>
      </div>
    </div>
  )
}

/** Progress bar. `used` and `total` are API fields; the bar width is only a ratio for display. */
export function MaxGauge({
  label,
  used,
  total,
  remainingText,
  tone = 'brand',
}: {
  label: string
  used: number
  total: number
  remainingText?: string
  tone?: 'brand' | 'orange'
}) {
  const percent = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {money(used)} of {money(total)}
        </span>
      </div>
      <Progress
        value={percent}
        aria-label={`${label}: ${money(used)} of ${money(total)}`}
        className={`h-3 ${tone === 'orange' ? '[&>div]:bg-brand-orange' : ''}`}
      />
      {remainingText && <p className="text-xs text-muted-foreground">{remainingText}</p>}
    </div>
  )
}
