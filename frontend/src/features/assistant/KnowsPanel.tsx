import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { useAssistantContext } from "./useAssistant"

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <h3 className="eyebrow">{title}</h3>
      <div className="mt-1 text-sm text-ink">{children}</div>
    </section>
  )
}

function List({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-[var(--muted)]">{empty}</p>
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  )
}

/** "What Your Assistant Knows" about the active member. refreshKey reloads it after a new question. */
export function KnowsPanel({
  token,
  memberId,
  refreshKey,
}: {
  token: string
  memberId: string
  refreshKey: number
}) {
  const { data, loading, error, retry } = useAssistantContext(token, memberId, refreshKey)
  // Phones and tablets: collapsed behind a button. Large screens: always open, in a side column.
  const [open, setOpen] = useState(false)
  const body = open ? "block" : "hidden lg:block"
  return (
    <aside
      className="portal-card !p-3 lg:sticky lg:top-2 lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto"
      aria-label="What Your Assistant Knows"
      data-testid="knows-panel"
    >
      <h2 className="portal-card-title !mb-0 hidden !text-base lg:block">What Your Assistant Knows</h2>
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm font-bold text-burgundy lg:hidden"
        aria-expanded={open}
        aria-controls="knows-body"
        data-testid="knows-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        What Your Assistant Knows
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <div id="knows-body" data-testid="knows-body" className={body}>
      {loading && !data && <p className="mt-3 text-sm text-[var(--muted)]">Loading…</p>}
      {error && (
        <div role="alert" className="note mt-3">
          <p>{error}</p>
          <button type="button" className="btn btn-outline mt-2" onClick={retry}>
            Try again
          </button>
        </div>
      )}
      {data && (
        <div className="mt-3">
          <Group title="Plan">
            <p className="font-semibold">{data.plan}</p>
            <p>{data.plan_highlights}</p>
          </Group>
          <Group title="Dental history">
            <List items={data.history} empty="No visits on record." />
          </Group>
          <Group title="Preferences">
            <List items={data.preferences} empty="None saved yet." />
          </Group>
          <Group title="Must-haves">
            <List items={data.must_haves} empty="None saved yet." />
          </Group>
          <Group title="Recent questions">
            <List
              items={data.chat_memory.filter((c) => c.role === "user").map((c) => c.content)}
              empty="No questions yet."
            />
          </Group>
          <p className="mt-4 text-xs text-[var(--muted)]">
            Only {data.name.split(" ")[0]}&apos;s information is shared: {data.shared_with_assistant.join("; ")}.
          </p>
        </div>
      )}
      </div>
    </aside>
  )
}
