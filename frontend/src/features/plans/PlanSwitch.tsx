import type { PlanTier } from "@/lib/types/plans"
import { money, percent } from "@/lib/format"
import { share } from "./PlanParts"

interface Row {
  label: string
  from: string
  to: string
}

function changes(from: PlanTier | undefined, to: PlanTier): Row[] {
  const f = (fn: (p: PlanTier) => string) => (from ? fn(from) : "Not set")
  return [
    { label: "Monthly price", from: f((p) => money(p.monthly_premium)), to: money(to.monthly_premium) },
    { label: "Yearly maximum", from: f((p) => money(p.annual_max)), to: money(to.annual_max) },
    { label: "Deductible", from: f((p) => money(p.deductible)), to: money(to.deductible) },
    { label: "Plan pays for preventive", from: f((p) => percent(share(p, "preventive"))), to: percent(share(to, "preventive")) },
    { label: "Plan pays for basic care", from: f((p) => percent(share(p, "basic"))), to: percent(share(to, "basic")) },
    { label: "Plan pays for major care", from: f((p) => percent(share(p, "major"))), to: percent(share(to, "major")) },
  ]
}

/** Inline confirmation for a plan switch. Shows what changes and that usage so far stays. */
export function ConfirmSwitch({
  current,
  target,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  current: PlanTier | undefined
  target: PlanTier
  busy: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <section className="portal-card" aria-label={`Switch to ${target.name}`} data-testid="confirm-switch">
      <h2 className="portal-card-title">Switch the family to {target.name}?</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        This changes the plan for everyone in the household. Here is what changes:
      </p>
      <dl className="space-y-1 text-sm">
        {changes(current, target).map((r) => (
          <div key={r.label} className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="font-semibold" data-testid={`change-${r.label}`}>
              {r.from} to {r.to}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm">Each person's usage so far (money used, deductible met, cleanings) stays as it is.</p>
      {error && (
        <p role="alert" className="note mt-3 text-sm">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-orange" onClick={onConfirm} disabled={busy}>
          {busy ? "Switching..." : `Yes, switch to ${target.name}`}
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </section>
  )
}
