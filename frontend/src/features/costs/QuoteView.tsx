import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { money } from "@/lib/format"
import { useSession } from "@/state/SessionContext"
import { errorMessage, getMemberUsage } from "@/lib/api/planYear"
import { postParseQuote, postSavingsTipsWithQuotes } from "@/lib/api/costs"
import type { SavingsTip, TreatmentItem, Usage } from "@/lib/types/planYear"
import type { ParsedTreatment, TreatmentPlanParseResponse } from "@/lib/types/costs"
import { useLoad } from "./useLoad"

export const SAMPLE_QUOTE = `Treatment plan: Phase 1 (urgent)
  Tooth 19   Root canal, molar        D3330    $1,100
Phase 2
  Tooth 19   Crown, porcelain         D2740    $1,650
  Tooth 14   Filling, 2 surfaces      D2392    $200
  Tooth 15   Filling, 2 surfaces      D2392    $200
Routine
  Cleaning, adult                     D1110    $120
`

/** The route state the Plan My Year page can read to start from these treatments. */
export interface QuoteHandoff {
  treatments: TreatmentItem[]
}

export function toTreatmentItems(items: ParsedTreatment[]): TreatmentItem[] {
  const matched = items.filter((i) => i.matched && i.code)
  const ids = new Set(matched.map((i) => i.id))
  return matched.map((i) => ({
    id: i.id,
    code: i.code as string,
    urgency: i.urgency,
    after: i.after && ids.has(i.after) ? i.after : null,
  }))
}

function QuoteCard({ item, flag }: { item: ParsedTreatment; flag: SavingsTip | undefined }) {
  return (
    <li className="portal-card" data-testid="quote-item">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="portal-card-title">{item.name}</p>
          <p className="text-xs text-muted-foreground">
            {item.code ?? "No code found"}
            {item.tooth ? ` · tooth ${item.tooth}` : ""}
            {item.phase ? ` · ${item.phase}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.matched ? <span className="chip chip-ok">Matched</span> : <span className="chip chip-warn">Not matched</span>}
          {flag && <span className="chip chip-warn" data-testid="high-flag">Looks high</span>}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Your quote</dt>
          <dd className="money text-xl text-burgundy">{item.quoted_fee === null ? "Not listed" : money(item.quoted_fee)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Typical price</dt>
          <dd className="money text-xl">{item.typical_fee === null ? "Not available" : money(item.typical_fee)}</dd>
        </div>
      </dl>
      {flag && <p className="note mt-3 text-sm">{flag.summary}</p>}
    </li>
  )
}

interface Props {
  memberId: string
  planId: string
}

export function QuoteView({ memberId, planId }: Props) {
  const { token } = useSession()
  const navigate = useNavigate()
  const [text, setText] = useState("")
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<TreatmentPlanParseResponse | null>(null)

  const [usage, setUsage] = useState<Usage | null>(null)
  useEffect(() => {
    let cancelled = false
    getMemberUsage(memberId, token).then(
      (u) => {
        if (!cancelled) setUsage(u.usage)
      },
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [memberId, token])

  async function read() {
    setReading(true)
    setError(null)
    try {
      setParsed(await postParseQuote(planId, text))
    } catch (e) {
      setParsed(null)
      setError(errorMessage(e))
    } finally {
      setReading(false)
    }
  }

  const matched = parsed ? toTreatmentItems(parsed.items) : []
  const quoted: Record<string, number> = {}
  for (const i of parsed?.items ?? []) if (i.matched && i.quoted_fee !== null) quoted[i.id] = i.quoted_fee
  const flags = useLoad(parsed !== null && matched.length > 0 && usage !== null, `q|${planId}|${JSON.stringify(parsed)}|${JSON.stringify(usage)}`, () =>
    postSavingsTipsWithQuotes(planId, matched, quoted, usage!).then((r) => r.tips),
  )

  const flagFor = (id: string) => flags.data?.find((t) => t.kind === "quote_check" && t.id === `quote_check-${id}`)
  const matchedCount = parsed?.items.filter((i) => i.matched).length ?? 0

  return (
    <div className="space-y-6">
      <section aria-labelledby="qt-paste" className="portal-card">
        <h2 id="qt-paste" className="portal-card-title">Paste your dentist's quote</h2>
        <p className="text-sm text-muted-foreground">Copy the treatment list from your quote and paste it here. We will match each line to a procedure.</p>
        <label htmlFor="qt-text" className="mt-3 block text-sm font-semibold">Quote text</label>
        <textarea
          id="qt-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          className="mt-1 w-full rounded-2xl border border-line bg-white p-3 font-mono text-sm"
          placeholder="Tooth 19  Crown, porcelain  D2740  $1,200"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-orange" disabled={reading || text.trim() === ""} onClick={read}>
            {reading ? "Reading..." : "Read my quote"}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setText(SAMPLE_QUOTE)}>
            Use a sample quote
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Please do not paste names or other personal details. To upload a PDF, ask the Assistant.</p>
      </section>

      {error && <p role="alert" className="note">{error}</p>}

      {parsed && (
        <section aria-labelledby="qt-results" className="space-y-4">
          <h2 id="qt-results" className="portal-card-title">
            {parsed.items.length === 0 ? "We did not find any treatments" : `We found ${parsed.items.length} treatments`}
          </h2>
          {parsed.items.length > 0 && (
            <p className="text-sm text-muted-foreground" data-testid="match-count">
              {matchedCount} matched to a known procedure.
            </p>
          )}
          {parsed.notes.map((n, i) => (
            <p key={i} className="note text-sm">{n}</p>
          ))}
          {flags.error && <p role="alert" className="note text-sm">Price check: {flags.error}</p>}
          <ul className="grid gap-4 md:grid-cols-2">
            {parsed.items.map((i) => (
              <QuoteCard key={i.id} item={i} flag={flagFor(i.id)} />
            ))}
          </ul>
          {parsed.unmatched_lines.length > 0 && (
            <div className="note text-sm">
              <p className="font-semibold">We could not match these lines:</p>
              <ul className="list-disc pl-5">
                {parsed.unmatched_lines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          )}
          {matched.length > 0 && (
            <div className="portal-card flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">Timing can change what you pay. See the cheapest order for these treatments.</p>
              <button
                type="button"
                className="btn btn-orange"
                onClick={() => navigate("/plan-year", { state: { treatments: matched } satisfies QuoteHandoff })}
              >
                Optimize my year
              </button>
            </div>
          )}
        </section>
      )}
      <p className="text-xs text-muted-foreground">
        This is an estimate. Your actual cost depends on your dentist's charges and claim review.
      </p>
    </div>
  )
}
