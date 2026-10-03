import type { PlanTier } from "@/lib/types/plans"
import { money, percent } from "@/lib/format"

export const SERVICES = [
  { key: "preventive", label: "Preventive", example: "cleanings and exams" },
  { key: "basic", label: "Basic", example: "fillings" },
  { key: "major", label: "Major", example: "crowns" },
] as const

const FREQ_LABELS: Record<string, string> = { D1110: "cleanings", D0120: "exams" }

/** Plan's share for a service, 0..1. Orthodontia is for children only. */
export function share(plan: PlanTier, key: "preventive" | "basic" | "major" | "orthodontia"): number {
  return key === "orthodontia" ? plan.orthodontia_child : (plan.coinsurance[key] ?? 0)
}

const BAR_ROWS = [
  ...SERVICES.map((s) => ({ key: s.key, label: s.label })),
  { key: "orthodontia" as const, label: "Orthodontia (children)" },
]

export function TierCard({ plan, selected, isYours, onSelect }: { plan: PlanTier; selected: boolean; isYours: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className="portal-card portal-card-select w-full text-left"
      aria-pressed={selected}
      onClick={onSelect}
      data-testid={`tier-${plan.id}`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="portal-card-title">{plan.name}</span>
        {isYours && <span className="chip chip-ok">Your plan</span>}
      </span>
      <span className="money mt-2 block text-3xl text-burgundy">
        {money(plan.monthly_premium)}
        <span className="text-base font-normal text-muted-foreground"> / month</span>
      </span>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Yearly maximum</dt>
          <dd className="font-semibold">{money(plan.annual_max)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Deductible</dt>
          <dd className="font-semibold">{money(plan.deductible)}</dd>
        </div>
      </dl>
    </button>
  )
}

export function CoverageBars({ plan }: { plan: PlanTier }) {
  return (
    <div className="space-y-4" data-testid="coverage-bars">
      {BAR_ROWS.map((r) => {
        const v = share(plan, r.key)
        return (
          <div key={r.key}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-semibold">{r.label}</span>
              <span>{v > 0 ? `Plan pays ${percent(v)}` : "Not covered"}</span>
            </div>
            <div className="coverage" role="progressbar" aria-label={`${r.label} coverage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
              <i style={{ width: `${Math.round(v * 100)}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Plain-English sentences built only from plan values. */
export function summaryLines(plan: PlanTier): string[] {
  const lines: string[] = []
  const waived = plan.deductible_waived_for.includes("preventive")
  for (const s of SERVICES) {
    const v = share(plan, s.key)
    if (v <= 0) {
      lines.push(`${s.label} care (${s.example}) is not covered.`)
    } else if (s.key === "preventive" && waived) {
      lines.push(`Plan pays ${percent(v)} of ${s.example}, with no deductible.`)
    } else {
      lines.push(`Plan pays ${percent(v)} of ${s.example} after a ${money(plan.deductible)} deductible, up to ${money(plan.annual_max)} a year.`)
    }
  }
  if (plan.orthodontia_child > 0) lines.push(`For children, the plan pays ${percent(plan.orthodontia_child)} of braces.`)
  else lines.push("Braces for children are not covered.")
  return lines
}

export function frequencyLines(plan: PlanTier): string[] {
  return Object.entries(plan.frequency).map(([code, n]) => `${FREQ_LABELS[code] ?? code}: covered ${n} times a year`)
}

export function CompareTable({ plans, selectedId }: { plans: PlanTier[]; selectedId: string }) {
  const rows: { label: string; value: (p: PlanTier) => string }[] = [
    { label: "Monthly price", value: (p) => money(p.monthly_premium) },
    { label: "Yearly maximum", value: (p) => money(p.annual_max) },
    { label: "Deductible", value: (p) => money(p.deductible) },
    ...SERVICES.map((s) => ({ label: s.label, value: (p: PlanTier) => (share(p, s.key) > 0 ? percent(share(p, s.key)) : "Not covered") })),
    { label: "Orthodontia (children)", value: (p) => (p.orthodontia_child > 0 ? percent(p.orthodontia_child) : "Not covered") },
  ]
  const cell = (id: string) => (id === selectedId ? "bg-tint-orange font-semibold" : "")
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-sm" data-testid="compare-table">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="py-2 pr-2 font-semibold"><span className="sr-only">Benefit</span></th>
            {plans.map((p) => (
              <th key={p.id} scope="col" className={`px-2 py-2 text-burgundy ${cell(p.id)}`} data-selected={p.id === selectedId}>{p.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line">
              <th scope="row" className="py-2 pr-2 font-normal text-muted-foreground">{r.label}</th>
              {plans.map((p) => (
                <td key={p.id} className={`px-2 py-2 ${cell(p.id)}`} data-selected={p.id === selectedId}>{r.value(p)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
