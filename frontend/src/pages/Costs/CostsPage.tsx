import { useState } from "react"
import { useSession } from "@/state/SessionContext"
import { EstimateView } from "@/features/costs/EstimateView"
import { QuoteView } from "@/features/costs/QuoteView"
import { YearlyView } from "@/features/costs/YearlyView"

type View = "estimate" | "quote" | "yearly"

const VIEWS: { id: View; label: string }[] = [
  { id: "estimate", label: "Estimate a procedure" },
  { id: "quote", label: "Read my dentist's quote" },
  { id: "yearly", label: "Yearly cost" },
]

export default function CostsPage() {
  const { activeMember, household } = useSession()
  const [view, setView] = useState<View>("estimate")
  const first = activeMember.name.split(" ")[0]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-bold text-burgundy sm:text-5xl">Costs</h1>
        <p className="mt-2 max-w-2xl text-lg text-muted-foreground">
          See what dental care could cost {first}, before the visit.
        </p>
        <p className="mt-1 text-sm font-semibold text-burgundy" data-testid="costs-plan">
          Using the {household.plan_tier.name} plan
        </p>
      </header>

      <div role="group" aria-label="Choose a view" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            onClick={() => setView(v.id)}
            className={`btn ${view === v.id ? "btn-orange" : "btn-outline"}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <p className="note text-sm">Urgent or painful care should never wait. Use these numbers to plan, not to put off care.</p>

      {view === "estimate" && (
        <EstimateView key={activeMember.id} memberId={activeMember.id} memberName={activeMember.name} planId={household.planTier} />
      )}
      {view === "quote" && <QuoteView key={activeMember.id} memberId={activeMember.id} planId={household.planTier} />}
      {view === "yearly" && <YearlyView activeTier={household.planTier} />}
    </div>
  )
}
