import { ArrowRight } from 'lucide-react'
import { money } from '@/lib/format'

export function SavingsBanner({
  baseline,
  optimized,
  savings,
}: {
  baseline: number
  optimized: number
  savings: number
}) {
  return (
    <section
      aria-label="Savings summary"
      className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-[#8e1a3d] p-5 text-white shadow-md"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/70">Doing everything now</p>
            <p className="text-2xl font-semibold line-through decoration-white/50">{money(baseline)}</p>
          </div>
          <ArrowRight className="size-5 text-white/70" aria-hidden="true" />
          <div>
            <p className="text-xs uppercase tracking-wide text-white/70">Optimized</p>
            <p className="text-2xl font-semibold">{money(optimized)}</p>
          </div>
        </div>
        <div className="rounded-xl bg-brand-orange px-4 py-3 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-white/90">You save</p>
          <p className="text-3xl font-bold" data-testid="savings-amount">
            {money(savings)}
          </p>
        </div>
      </div>
      <p className="sr-only">
        Doing everything now: {money(baseline)}. Optimized: {money(optimized)}. You save {money(savings)}.
      </p>
    </section>
  )
}
