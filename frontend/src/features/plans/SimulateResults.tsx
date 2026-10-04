import { money } from "@/lib/format"
import type { SimulatePlanResult, SimulateResponse } from "@/lib/types/simulate"

const BAR_FILLS = ["var(--burgundy)", "var(--orange)", "var(--muted)"]

/** Plain SVG bars drawn from the API's shared bin edges and counts. Heights are layout ratios only. */
function Distribution({ result, plans }: { result: SimulateResponse; plans: SimulatePlanResult[] }) {
  const bins = result.bin_edges.length - 1
  const top = Math.max(1, ...plans.flatMap((p) => p.histogram))
  const W = 600
  const H = 160
  const groupW = W / Math.max(bins, 1)
  const barW = Math.max(1, (groupW - 4) / Math.max(plans.length, 1))
  const first = result.bin_edges[0]
  const last = result.bin_edges[result.bin_edges.length - 1]
  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${W} ${H + 4}`}
        className="h-auto w-full max-w-full"
        role="img"
        aria-label="How many simulated years landed in each cost range, for each plan. The table below has the same information."
        data-testid="distribution-chart"
      >
        <line x1="0" y1={H} x2={W} y2={H} stroke="var(--line)" />
        {plans.map((p, pi) =>
          p.histogram.map((count, bi) => {
            const h = (count / top) * (H - 6)
            return (
              <rect
                key={`${p.plan_id}-${bi}`}
                x={bi * groupW + 2 + pi * barW}
                y={H - h}
                width={Math.max(barW - 1, 1)}
                height={h}
                fill={BAR_FILLS[pi % BAR_FILLS.length]}
                opacity={0.9}
              >
                <title>{`${p.name}: ${count} of ${result.n} years`}</title>
              </rect>
            )
          }),
        )}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{money(first)} a year</span>
        <span>{money(last)} a year</span>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-3 text-xs">
        {plans.map((p, i) => (
          <span key={p.plan_id} className="inline-flex items-center gap-1">
            <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: BAR_FILLS[i % BAR_FILLS.length] }} />
            {p.name}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}

export function SimulateResults({
  result,
  planOrder,
  currentPlanId,
  stale,
}: {
  result: SimulateResponse
  planOrder: string[]
  currentPlanId: string
  stale: boolean
}) {
  const plans = [...result.plans].sort((a, b) => {
    const ia = planOrder.indexOf(a.plan_id)
    const ib = planOrder.indexOf(b.plan_id)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
  const winner = plans.find((p) => p.plan_id === result.winner_plan_id)
  const current = plans.find((p) => p.plan_id === currentPlanId)
  return (
    <div className={stale ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={stale}>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const best = p.plan_id === result.winner_plan_id
          return (
            <article
              key={p.plan_id}
              data-testid={`sim-${p.plan_id}`}
              className={`rounded-2xl border-2 bg-white p-4 ${best ? "border-orange" : "border-line"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-burgundy">{p.name}</h3>
                {best && <span className="chip chip-ok">Best for your family</span>}
                {p.plan_id === currentPlanId && <span className="chip border border-line bg-white">Your plan</span>}
              </div>
              <p className="mt-3 text-4xl font-bold text-burgundy" data-testid={`share-${p.plan_id}`}>
                {p.cheapest_share}%
              </p>
              <p className="text-sm text-muted-foreground">Cheapest in {p.cheapest_share}% of years</p>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <dt>Typical year</dt>
                  <dd className="font-semibold">{money(p.median)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Bad year</dt>
                  <dd className="font-semibold">{money(p.p90)}</dd>
                </div>
                <div className="flex justify-between gap-2 text-muted-foreground">
                  <dt>Premiums for the year</dt>
                  <dd>{money(p.premiums_total)}</dd>
                </div>
              </dl>
            </article>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Typical year is the middle result. A bad year is higher than 9 out of 10 simulated years. Totals include premiums and what your family pays.
      </p>

      {winner && current && winner.plan_id !== current.plan_id && (
        <p className="note mt-4 text-sm" data-testid="winner-differs">
          Your family is on {current.name}, but {winner.name} came out cheapest most often in these simulated years.
        </p>
      )}

      <Distribution result={result} plans={plans} />

      <table className="mt-4 w-full text-left text-sm" data-testid="sim-table">
        <caption className="sr-only">Simulated yearly cost for each plan</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="py-1 pr-2">Plan</th>
            <th scope="col" className="py-1 pr-2">Cheapest in</th>
            <th scope="col" className="py-1 pr-2">Typical year</th>
            <th scope="col" className="py-1">Bad year</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.plan_id} className="border-b border-line last:border-0">
              <th scope="row" className="py-1 pr-2 font-semibold">{p.name}</th>
              <td className="py-1 pr-2">{p.cheapest_share}% of years</td>
              <td className="py-1 pr-2">{money(p.median)}</td>
              <td className="py-1">{money(p.p90)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {result.reasons.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold text-burgundy">Why</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm" data-testid="sim-reasons">
            {result.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      )}

      <details className="mt-4 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-burgundy">How we estimated this</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5" data-testid="sim-assumptions">
          {result.assumptions.map((a) => <li key={a}>{a}</li>)}
        </ul>
      </details>

      <p className="mt-4 text-xs text-muted-foreground">
        {result.disclaimer} Based on simulated years with synthetic odds, not a prediction for your family.
      </p>
    </div>
  )
}
