import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, Clock, FileSearch, HeartPulse, Landmark, Network, Repeat } from 'lucide-react'
import { money } from '@/lib/format'
import type { SavingsTip, TipKind } from '@/lib/types'
import { BeforeAfterBars } from './BeforeAfterBars'

const ICONS: Record<TipKind, typeof Clock> = {
  timing: Clock,
  network: Network,
  preventive: HeartPulse,
  alternative: Repeat,
  fsa_hsa: Landmark,
  quote_check: FileSearch,
}

export function TipCard({ tip, children }: { tip: SavingsTip; children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const Icon = ICONS[tip.kind]
  const panelId = `tip-${tip.id}-details`
  return (
    <li className="rounded-xl border bg-card" data-testid={`tip-${tip.kind}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-start"
      >
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"
        >
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1 space-y-3">
          <span className="block space-y-1">
            <span className="block font-semibold">{tip.title}</span>
            <span className="block text-sm text-muted-foreground">{tip.summary}</span>
          </span>
          <BeforeAfterBars before={tip.before} after={tip.after} />
        </span>
        <span className="flex items-center gap-2 sm:flex-col sm:items-end">
          <span className="rounded-lg bg-brand-orange/10 px-3 py-1.5 text-right">
            <span className="block text-[10px] font-medium uppercase tracking-wide text-brand-orange">
              You could save
            </span>
            <span className="block text-2xl font-bold text-brand-orange" data-testid="tip-saving">
              {money(tip.saving)}
            </span>
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {open ? 'Hide details' : 'How we calculated this'}
            <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        </span>
      </button>
      {children && <div className="px-4 pb-4">{children}</div>}
      {open && (
        <div id={panelId} className="space-y-3 border-t px-4 py-3 text-sm">
          <p className="font-medium">How we calculated this</p>
          <ol className="space-y-2">
            {tip.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white"
                >
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{s.label}</span>
                    <span className="font-semibold">{money(s.amount)}</span>
                  </div>
                  <p className="text-muted-foreground">{s.note}</p>
                </div>
              </li>
            ))}
          </ol>
          {tip.assumptions.length > 0 && (
            <div>
              <p className="font-medium">What we assumed</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {tip.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
