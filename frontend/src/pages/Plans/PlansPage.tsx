import { useState } from "react"
import { useSession } from "@/state/SessionContext"
import { ApiError } from "@/lib/api/planYear"
import { usePlans } from "@/features/plans/usePlans"
import { ConfirmSwitch } from "@/features/plans/PlanSwitch"
import { CompareTable, CoverageBars, TierCard, frequencyLines, summaryLines } from "@/features/plans/PlanParts"

export default function PlansPage() {
  const { household, user, accounts, changePlan } = useSession()
  const { plans, loading, error, retry } = usePlans()
  const [picked, setPicked] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const selected = plans.find((p) => p.id === (picked ?? household.planTier)) ?? plans[0]
  const current = plans.find((p) => p.id === household.planTier)
  const target = plans.find((p) => p.id === confirming)
  const isPrimary = user.role === "primary"
  const primaryName =
    accounts.find((a) => a.role === "primary" && a.household_id === household.id)?.display_name.split(" ")[0] ?? "the account holder"

  const select = (id: string) => {
    setPicked(id)
    setConfirming(null)
    setSwitchError(null)
  }
  const startSwitch = (id: string) => {
    setPicked(id)
    setDone(null)
    setSwitchError(null)
    setConfirming(id)
  }
  const confirm = async () => {
    if (!target) return
    setBusy(true)
    setSwitchError(null)
    try {
      await changePlan(target.id)
      setPicked(null)
      setConfirming(null)
      setDone(`Done. Your family is now on the ${target.name} plan. Each person's usage so far stayed the same.`)
    } catch (e) {
      const status = e instanceof ApiError ? e.status : undefined
      setSwitchError(
        status === 404
          ? "Switching plans is not available on the server yet. Please ask for the server to be restarted with the latest update, then try again."
          : status === 403
            ? `Only ${primaryName} can change the family plan.`
            : e instanceof Error
              ? e.message
              : "Something went wrong. Please try again.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-bold text-burgundy sm:text-5xl">Plans</h1>
        <p className="mt-2 max-w-2xl text-lg text-muted-foreground">
          Compare the three dental plans and see what each one covers in plain English.
        </p>
      </header>

      {loading && <p role="status" className="portal-card text-sm">Loading plans...</p>}
      {error && (
        <div role="alert" className="note">
          <p>{error}</p>
          <button type="button" className="btn btn-outline mt-2" onClick={retry}>Try again</button>
        </div>
      )}
      {!loading && !error && plans.length === 0 && <p className="portal-card text-sm">No plans are available right now.</p>}

      {selected && (
        <>
          {done && (
            <p role="status" className="note text-sm" data-testid="switch-done">
              {done}
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((p) => (
              <TierCard key={p.id} plan={p} selected={p.id === selected.id} isYours={p.id === household.planTier} onSelect={() => select(p.id)} />
            ))}
          </div>

          {selected.id !== household.planTier && !target && (
            <div className="portal-card flex flex-wrap items-center justify-between gap-3" data-testid="switch-bar">
              {isPrimary ? (
                <>
                  <p className="text-sm">
                    You are looking at {selected.name}. Your family is on {current?.name ?? household.plan_tier.name}.
                  </p>
                  <button type="button" className="btn btn-orange" onClick={() => startSwitch(selected.id)}>
                    Switch to this plan
                  </button>
                </>
              ) : (
                <p className="text-sm">Only {primaryName} can change the family plan.</p>
              )}
            </div>
          )}

          {target && (
            <ConfirmSwitch
              current={current}
              target={target}
              busy={busy}
              error={switchError}
              onConfirm={() => void confirm()}
              onCancel={() => {
                setConfirming(null)
                setSwitchError(null)
              }}
            />
          )}

          {isPrimary && household.planTier !== "preferred" && !target && plans.some((p) => p.id === "preferred") && (
            <button type="button" className="btn btn-outline" onClick={() => startSwitch("preferred")}>
              Back to Preferred (demo plan)
            </button>
          )}

          <section className="portal-card" aria-label={`${selected.name} coverage`}>
            <h2 className="portal-card-title">What {selected.name} covers</h2>
            {selected.description && <p className="mb-4 text-sm text-muted-foreground">{selected.description}</p>}
            <div className="grid gap-6 md:grid-cols-2">
              <CoverageBars plan={selected} />
              <div>
                <ul className="list-disc space-y-1 pl-5 text-sm" data-testid="plan-summary">
                  {summaryLines(selected).map((l) => <li key={l}>{l}</li>)}
                </ul>
                {frequencyLines(selected).length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {frequencyLines(selected).map((l) => <li key={l}>{l}</li>)}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section className="portal-card" aria-label="Side by side">
            <h2 className="portal-card-title">Side by side</h2>
            <CompareTable plans={plans} selectedId={selected.id} />
          </section>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        This is an estimate. Your actual cost depends on your dentist's charges and claim review.
      </p>
    </div>
  )
}
