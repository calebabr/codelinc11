import { useState } from "react"
import { money } from "@/lib/format"
import { postAnnualCost, TIER_IDS } from "@/lib/api/costs"
import type { AnnualCostResponse, CareItem } from "@/lib/types/costs"
import { useLoad } from "./useLoad"

function Slider({
  id,
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
  hint: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-semibold">{label}</label>
        <output htmlFor={id} className="money text-xl text-burgundy">{value}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-11 w-full accent-[var(--orange-dark)]"
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

export function YearlyView({ activeTier }: { activeTier: string }) {
  const [people, setPeople] = useState(2)
  const [visits, setVisits] = useState(2)
  const [major, setMajor] = useState(0)
  const [inNetwork, setInNetwork] = useState(true)

  const care: CareItem[] = []
  if (visits > 0) care.push({ code: "D1110", count: visits })
  if (major > 0) care.push({ code: "D2740", count: major })
  const key = `${people}|${visits}|${major}|${inNetwork}`

  const tiers = useLoad<AnnualCostResponse[]>(
    true,
    key,
    () => Promise.all(TIER_IDS.map((t) => postAnnualCost({ tier_id: t, covered_people: people, expected_care: care, in_network: inNetwork }))),
    250,
  )
  const list = tiers.data ?? []
  // The cheapest tier is found by comparing the totals the server returned.
  const cheapest = list.length > 0 ? list.reduce((a, b) => (b.total_cost < a.total_cost ? b : a)).tier_id : null
  const assumptions = list[0]?.assumptions ?? []

  return (
    <div className="space-y-6">
      <section aria-labelledby="yr-inputs" className="portal-card">
        <h2 id="yr-inputs" className="portal-card-title">Tell us what to expect</h2>
        <div className="mt-3 grid gap-6 md:grid-cols-3">
          <Slider id="yr-people" label="People covered" value={people} min={1} max={6} onChange={setPeople} hint="Everyone on the plan." />
          <Slider id="yr-visits" label="Cleanings per person" value={visits} min={0} max={4} onChange={setVisits} hint="Most plans cover 2 a year." />
          <Slider id="yr-major" label="Crowns per person" value={major} min={0} max={3} onChange={setMajor} hint="Big work you expect this year." />
        </div>
        <div role="group" aria-label="Network" className="mt-4 flex flex-wrap gap-2">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={inNetwork === v}
              onClick={() => setInNetwork(v)}
              className={`chip cursor-pointer border ${inNetwork === v ? "border-burgundy bg-burgundy text-white" : "border-line bg-white"}`}
            >
              {v ? "In network" : "Out of network"}
            </button>
          ))}
        </div>
      </section>

      {tiers.loading && !tiers.data && <p role="status" className="portal-card text-sm">Working out each plan...</p>}
      {tiers.error && <p role="alert" className="note">{tiers.error}</p>}

      {list.length > 0 && (
        <section aria-labelledby="yr-tiers" aria-live="polite" className="space-y-3">
          <h2 id="yr-tiers" className="portal-card-title">Your yearly cost, plan by plan</h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {list.map((t) => (
              <li
                key={t.tier_id}
                data-testid={`tier-${t.tier_id}`}
                className="portal-card"
                data-selected={t.tier_id === activeTier ? "true" : undefined}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="portal-card-title">{t.tier_name}</p>
                  <div className="flex gap-2">
                    {t.tier_id === activeTier && <span className="chip chip-pending">Your plan</span>}
                    {t.tier_id === cheapest && <span className="chip chip-ok">Lowest total</span>}
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Total for the year</p>
                <p className="money text-4xl text-burgundy" data-testid={`total-${t.tier_id}`}>{money(t.total_cost)}</p>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between gap-2"><dt>Premiums</dt><dd className="money" data-testid={`premiums-${t.tier_id}`}>{money(t.premiums)}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Care you pay for</dt><dd className="money" data-testid={`care-${t.tier_id}`}>{money(t.out_of_pocket_care)}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Plan pays</dt><dd className="money">{money(t.plan_pays)}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
          {assumptions.length > 0 && (
            <div className="portal-card">
              <h3 className="font-bold">What we assumed</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm" data-testid="assumptions">
                {assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
      <p className="text-xs text-muted-foreground">
        {list[0]?.disclaimer ?? "This is an estimate. Your actual cost depends on your dentist's charges and claim review."}
      </p>
    </div>
  )
}
