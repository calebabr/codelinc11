import { useMemo, useState } from "react"
import type { Procedure, TreatmentItem, Urgency } from "@/lib/types/planYear"

const URGENCY: { value: Urgency; label: string; hint: string }[] = [
  { value: "urgent", label: "Urgent", hint: "Needs care now. Stays in this plan year." },
  { value: "soon", label: "Soon", hint: "Should be done in the next few months." },
  { value: "flexible", label: "Flexible", hint: "Can wait if waiting saves money." },
]

function chipClass(on: boolean) {
  return `chip cursor-pointer border ${on ? "border-burgundy bg-burgundy text-white" : "border-line bg-white"}`
}

interface Props {
  procedures: Procedure[]
  loading: boolean
  error: string | null
  onRetry: () => void
  items: TreatmentItem[]
  onAdd: (code: string) => void
  onRemove: (id: string) => void
  onUrgency: (id: string, u: Urgency) => void
  onAfter: (id: string, after: string | null) => void
}

export function TreatmentBuilder({ procedures, loading, error, onRetry, items, onAdd, onRemove, onUrgency, onAfter }: Props) {
  const [query, setQuery] = useState("")
  const byCode = useMemo(() => new Map(procedures.map((p) => [p.code, p])), [procedures])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return procedures
    return procedures.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.synonyms.some((s) => s.toLowerCase().includes(q)),
    )
  }, [procedures, query])

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="py-pick" className="portal-card order-2 lg:order-1">
        <h2 id="py-pick" className="portal-card-title">Tap the treatments you need</h2>
        <p className="text-sm text-muted-foreground">Tap one more than once if you need it more than once.</p>
        <label className="mt-3 block text-sm font-semibold" htmlFor="py-search">Search treatments</label>
        <input
          id="py-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="For example: crown, filling, root canal"
          className="mt-1 min-h-11 w-full rounded-full border border-line bg-white px-4"
        />
        {loading && <p role="status" className="mt-3 text-sm text-muted-foreground">Loading treatments...</p>}
        {error && (
          <div role="alert" className="note mt-3">
            <p>{error}</p>
            <button type="button" className="btn btn-outline mt-2" onClick={onRetry}>Try again</button>
          </div>
        )}
        {!loading && !error && shown.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">No treatments match "{query}".</p>
        )}
        <ul className="mt-3 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2" aria-label="Treatments you can add">
          {shown.map((p) => (
            <li key={p.code}>
              <button
                type="button"
                className="portal-card-select w-full rounded-2xl border border-line bg-white p-3 text-left"
                aria-label={`Add ${p.name}`}
                onClick={() => onAdd(p.code)}
              >
                <span className="block font-semibold text-burgundy">{p.name}</span>
                <span className="block text-xs text-muted-foreground">{p.code} · {p.category}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="py-list" className="portal-card order-1 lg:order-2">
        <h2 id="py-list" className="portal-card-title">Your treatments</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing added yet. Tap a treatment above, or try the demo case.</p>
        ) : (
          <ol className="mt-2 space-y-4">
            {items.map((item, idx) => {
              const earlier = items.slice(0, idx)
              const name = byCode.get(item.code)?.name ?? item.code
              return (
                <li key={item.id} className="rounded-2xl border border-line p-3" data-testid="treatment-row">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{idx + 1}. {name}</p>
                    <button
                      type="button"
                      className="btn btn-outline !min-h-9 !px-3 text-sm"
                      onClick={() => onRemove(item.id)}
                      aria-label={`Remove ${name}`}
                    >
                      Remove
                    </button>
                  </div>
                  <div role="group" aria-label={`How urgent is ${name}?`} className="mt-2 flex flex-wrap gap-2">
                    {URGENCY.map((u) => (
                      <button
                        key={u.value}
                        type="button"
                        aria-pressed={item.urgency === u.value}
                        title={u.hint}
                        onClick={() => onUrgency(item.id, u.value)}
                        className={chipClass(item.urgency === u.value)}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                  {earlier.length > 0 && (
                    <div role="group" aria-label={`${name} comes after`} className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">Comes after:</span>
                      <button
                        type="button"
                        aria-pressed={item.after === null}
                        onClick={() => onAfter(item.id, null)}
                        className={chipClass(item.after === null)}
                      >
                        Nothing
                      </button>
                      {earlier.map((e, i) => (
                        <button
                          key={e.id}
                          type="button"
                          aria-pressed={item.after === e.id}
                          onClick={() => onAfter(item.id, e.id)}
                          className={chipClass(item.after === e.id)}
                        >
                          {i + 1}. {byCode.get(e.code)?.name ?? e.code}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
