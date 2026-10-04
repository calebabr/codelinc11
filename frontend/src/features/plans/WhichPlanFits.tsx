import { useEffect, useMemo, useRef, useState } from "react"
import { useSession } from "@/state/SessionContext"
import { getProcedures } from "@/lib/api/planYear"
import type { Procedure } from "@/lib/types/planYear"
import type { CareLevel, SimulateRequest } from "@/lib/types/simulate"
import { useSimulate } from "./useSimulate"
import { SimulateResults } from "./SimulateResults"
import { SaveComparison } from "./SaveComparison"

const LEVELS: { value: CareLevel; label: string }[] = [
  { value: "low", label: "Low care" },
  { value: "average", label: "Average care" },
  { value: "high", label: "High care" },
]

interface KnownItem {
  id: number
  code: string
  memberId: string
}

const MAX_PER_CODE = 5
const MAX_ITEMS = 10

function chipClass(on: boolean) {
  return `chip cursor-pointer border ${on ? "border-burgundy bg-burgundy text-white" : "border-line bg-white"}`
}

const firstName = (full: string) => full.split(" ")[0]

/** A saved comparison to fill in. `key` changes once per "Open", so it is applied once. */
export interface SimulationPreset {
  key: string
  request: SimulateRequest
}

export function WhichPlanFits({ planOrder, preset }: { planOrder: string[]; preset?: SimulationPreset | null }) {
  const { household, token } = useSession()
  const members = household.members
  const [off, setOff] = useState<string[]>([])
  const [levels, setLevels] = useState<Record<string, CareLevel>>({})
  const [known, setKnown] = useState<KnownItem[]>([])
  const [inNetwork, setInNetwork] = useState(true)
  const [query, setQuery] = useState("")
  const [procs, setProcs] = useState<Procedure[]>([])
  const [procError, setProcError] = useState(false)
  const [nextId, setNextId] = useState(1)

  useEffect(() => {
    let cancelled = false
    getProcedures().then(
      (m) => {
        if (!cancelled) setProcs(m.map((x) => x.procedure))
      },
      () => {
        if (!cancelled) setProcError(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const sectionRef = useRef<HTMLElement>(null)
  const appliedPreset = useRef<string | null>(null)
  useEffect(() => {
    if (!preset || appliedPreset.current === preset.key) return
    appliedPreset.current = preset.key
    const saved = preset.request.members
    const inHousehold = saved.filter((s) => members.some((m) => m.id === s.id))
    if (inHousehold.length === 0) return
    setOff(members.filter((m) => !inHousehold.some((s) => s.id === m.id)).map((m) => m.id))
    setLevels(Object.fromEntries(inHousehold.map((s) => [s.id, s.care_level])))
    let id = 1
    const rows: KnownItem[] = []
    for (const s of inHousehold) for (const k of s.known_care) for (let i = 0; i < k.count && rows.length < MAX_ITEMS; i++) rows.push({ id: id++, code: k.code, memberId: s.id })
    setKnown(rows)
    setNextId(id)
    setInNetwork(preset.request.in_network)
    sectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" })
  }, [preset, members])

  const covered = members.filter((m) => !off.includes(m.id))
  const nameOf = (code: string) => procs.find((p) => p.code === code)?.name ?? code

  const request = useMemo<SimulateRequest | null>(() => {
    const on = members.filter((m) => !off.includes(m.id))
    if (on.length === 0) return null
    return {
      members: on.map((m) => {
        const counts = new Map<string, number>()
        for (const k of known) if (k.memberId === m.id) counts.set(k.code, (counts.get(k.code) ?? 0) + 1)
        return {
          id: m.id,
          name: firstName(m.name),
          age: m.age,
          care_level: levels[m.id] ?? "average",
          known_care: [...counts].map(([code, count]) => ({ code, count })),
        }
      }),
      n: 5000,
      seed: 42,
      in_network: inNetwork,
    }
  }, [members, off, levels, known, inNetwork])

  const sim = useSimulate(request, token)

  const toggleCovered = (id: string) =>
    setOff((o) => {
      if (o.includes(id)) return o.filter((x) => x !== id)
      return covered.length <= 1 ? o : [...o, id]
    })

  const addKnown = (code: string, memberId: string) => {
    if (known.length >= MAX_ITEMS) return
    if (known.filter((k) => k.code === code && k.memberId === memberId).length >= MAX_PER_CODE) return
    setKnown((k) => [...k, { id: nextId, code, memberId }])
    setNextId((n) => n + 1)
  }
  const defaultMember = covered[0]
  // "Try <partner>'s crown" uses the spouse or partner (by relationship), else another adult on the plan.
  const crownPerson =
    members.find((m) => /spouse|partner|husband|wife/i.test(m.relationship)) ??
    members.find((m) => m.role === "adult")
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? procs.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.synonyms.some((s) => s.toLowerCase().includes(q)))
      : procs
    return list.slice(0, 12)
  }, [procs, query])

  return (
    <section ref={sectionRef} className="portal-card space-y-5" aria-labelledby="wpf-title" data-testid="which-plan">
      <header>
        <h2 id="wpf-title" className="portal-card-title">Which plan fits us?</h2>
        <p className="text-sm text-muted-foreground">
          Nobody knows next year's dental care ahead of time. We try thousands of possible years for your family and show how each plan does.
        </p>
      </header>

      <div>
        <h3 className="font-semibold text-burgundy">Who is covered</h3>
        <ul className="mt-2 grid gap-3 sm:grid-cols-2">
          {members.map((m) => {
            const on = !off.includes(m.id)
            const level = levels[m.id] ?? "average"
            const first = firstName(m.name)
            return (
              <li key={m.id} className={`rounded-2xl border-2 p-3 ${on ? "border-orange bg-white" : "border-line bg-muted"}`} data-testid={`who-${m.id}`}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
                  aria-pressed={on}
                  aria-label={`${first}, age ${m.age}, ${on ? "covered" : "not covered"}`}
                  onClick={() => toggleCovered(m.id)}
                >
                  <span className="font-semibold text-burgundy">{first}</span>
                  <span className="text-sm text-muted-foreground">Age {m.age} · {on ? "Covered" : "Not covered"}</span>
                </button>
                <div role="group" aria-label={`Care level for ${first}`} className="mt-2 flex flex-wrap gap-2">
                  {LEVELS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      aria-pressed={level === l.value}
                      disabled={!on}
                      onClick={() => setLevels((s) => ({ ...s, [m.id]: l.value }))}
                      className={chipClass(level === l.value)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Low is healthy teeth. High is frequent dental work. At least one person stays covered.</p>
      </div>

      <div>
        <h3 className="font-semibold text-burgundy">Care you already know about</h3>
        {crownPerson && procs.some((p) => p.code === "D2740") && (
          <button
            type="button"
            className="btn btn-outline mt-2"
            onClick={() => {
              setOff((o) => o.filter((x) => x !== crownPerson.id))
              addKnown("D2740", crownPerson.id)
            }}
          >
            Try {firstName(crownPerson.name)}'s crown
          </button>
        )}
        <label className="mt-3 block text-sm font-semibold" htmlFor="wpf-search">Search treatments</label>
        <input
          id="wpf-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="For example: crown, filling, root canal"
          className="mt-1 min-h-11 w-full rounded-full border border-line bg-white px-4"
        />
        {procError && <p role="alert" className="note mt-2 text-sm">We couldn't load the treatment list. You can still compare plans without it.</p>}
        <ul className="mt-3 grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2" aria-label="Treatments you can add">
          {shown.map((p) => (
            <li key={p.code}>
              <button
                type="button"
                className="portal-card-select w-full rounded-2xl border border-line bg-white p-3 text-left"
                aria-label={`Add ${p.name} to known care`}
                disabled={!defaultMember}
                onClick={() => defaultMember && addKnown(p.code, defaultMember.id)}
              >
                <span className="block font-semibold text-burgundy">{p.name}</span>
                <span className="block text-xs text-muted-foreground">{p.code} · {p.category}</span>
              </button>
            </li>
          ))}
        </ul>
        {known.length > 0 && (
          <ul className="mt-3 space-y-2" aria-label="Known care">
            {known.map((k) => (
              <li key={k.id} className="rounded-2xl border border-line p-3" data-testid="known-row">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{nameOf(k.code)}</p>
                  <button
                    type="button"
                    className="btn btn-outline !min-h-9 !px-3 text-sm"
                    aria-label={`Remove ${nameOf(k.code)}`}
                    onClick={() => setKnown((s) => s.filter((x) => x.id !== k.id))}
                  >
                    Remove
                  </button>
                </div>
                <div role="group" aria-label={`Who needs ${nameOf(k.code)}?`} className="mt-2 flex flex-wrap gap-2">
                  {covered.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={k.memberId === m.id}
                      onClick={() => setKnown((s) => s.map((x) => (x.id === k.id ? { ...x, memberId: m.id } : x)))}
                      className={chipClass(k.memberId === m.id)}
                    >
                      {firstName(m.name)}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div role="group" aria-label="Network" className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={inNetwork} onClick={() => setInNetwork(true)} className={chipClass(inNetwork)}>In network</button>
        <button type="button" aria-pressed={!inNetwork} onClick={() => setInNetwork(false)} className={chipClass(!inNetwork)}>Out of network</button>
      </div>

      <div aria-live="polite">
        {sim.unavailable && (
          <p role="status" className="note text-sm">Simulation is not available on the server yet. Please try again after the server is updated.</p>
        )}
        {sim.error && (
          <div role="alert" className="note">
            <p>{sim.error}</p>
            <button type="button" className="btn btn-outline mt-2" onClick={sim.retry}>Try again</button>
          </div>
        )}
        {sim.loading && !sim.result && !sim.unavailable && (
          <div role="status" aria-label="Working out your results" data-testid="sim-skeleton" className="grid animate-pulse gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-40 rounded-2xl bg-muted" />)}
          </div>
        )}
        {sim.result && (
          <SimulateResults result={sim.result} planOrder={planOrder} currentPlanId={household.planTier} stale={sim.loading} />
        )}
        {sim.result && request && (
          <SaveComparison
            request={request}
            planOrder={planOrder}
            winnerName={sim.result.plans.find((p) => p.plan_id === sim.result!.winner_plan_id)?.name ?? "Your best plan"}
          />
        )}
      </div>
    </section>
  )
}
