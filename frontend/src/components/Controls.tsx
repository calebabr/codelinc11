import { useId } from 'react'
import type { ReactNode } from 'react'
import { Slider } from '@/components/ui/slider'
import { MONTH_OPTIONS, monthShort } from '@/lib/format'

/** Two/three-option segmented toggle (role=radiogroup, buttons are role=radio). */
export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  className = '',
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex rounded-lg border bg-muted p-1 ${className}`}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`rounded-md font-medium transition-all ${
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-1.5 text-sm'
            } ${on ? 'bg-white text-brand shadow-sm ring-1 ring-brand/20' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Clickable Jan..Dec strip. Months from `value` onward are tinted as "still ahead". */
export function MonthStrip({
  label,
  value,
  onChange,
  caption,
}: {
  label: string
  value: number
  onChange: (m: number) => void
  caption?: string
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium" id={`${label}-lbl`}>
        {label}
      </p>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
        {MONTH_OPTIONS.map((m) => {
          const here = m.value === value
          const ahead = m.value > value
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={here}
              aria-label={m.label}
              onClick={() => onChange(m.value)}
              className={`relative flex h-12 flex-col items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                here
                  ? 'border-brand bg-brand text-white'
                  : ahead
                    ? 'border-brand-orange/40 bg-orange-50 text-orange-950 hover:bg-orange-100'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {monthShort(m.value)}
              {here && <span className="text-[10px] leading-none font-normal">you are here</span>}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {caption ?? 'Your plan year runs January to December. Orange months are still ahead of you.'}
      </p>
    </div>
  )
}

/** Slider with a live value label. `value` and `onChange` are user inputs, not computed dollars. */
export function SliderField({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (n: number) => void
  hint?: ReactNode
}) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id} className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span id={id} className="text-sm font-medium">
          {label}
        </span>
        <output className="text-lg font-bold text-brand" aria-live="polite">
          {display}
        </output>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        className="py-2 [&_[data-slot=slider-range]]:bg-brand-orange [&_[data-slot=slider-thumb]]:size-6 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-brand [&_[data-slot=slider-track]]:h-3"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Tappable visit chips: tap chip n to mark n visits done; tap the last done chip to undo it. */
export function VisitChips({
  label,
  limit,
  count,
  onChange,
}: {
  label: string
  limit: number
  count: number
  onChange: (n: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {Array.from({ length: limit }, (_, i) => i + 1).map((n) => {
          const done = n <= count
          return (
            <button
              key={n}
              type="button"
              aria-pressed={done}
              aria-label={`${label} ${n} ${done ? 'done' : 'not done'}`}
              onClick={() => onChange(done && n === count ? n - 1 : n)}
              className={`flex h-14 min-w-24 flex-col items-center justify-center rounded-xl border-2 px-3 text-sm font-medium transition-colors ${
                done
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                  : 'border-dashed border-border bg-card text-muted-foreground hover:border-emerald-400'
              }`}
            >
              <span aria-hidden="true">{done ? '🦷 ✓' : '🦷'}</span>
              <span>Visit {n} {done ? 'done' : 'open'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
