import { useCallback, useEffect, useMemo, useState } from "react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { money } from "@/lib/format"
import { useSession } from "@/state/SessionContext"
import { errorMessage, getMemberUsage, getProcedures, postQuestions, postSavingsTips } from "@/lib/api/planYear"
import { postEstimate } from "@/lib/api/costs"
import type { Procedure, QuestionsResponse, SavingsTipsResponse, Usage } from "@/lib/types/planYear"
import type { EstimateResult, EstimateResponse } from "@/lib/types/costs"
import { QuestionsCard, SavingsTipsCard } from "@/features/planYear/Extras"
import { useLoad } from "./useLoad"

function chipClass(on: boolean) {
  return `chip cursor-pointer border ${on ? "border-burgundy bg-burgundy text-white" : "border-line bg-white"}`
}

function ResultPanel({ r }: { r: EstimateResult }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-4">
      <div className="result-panel" data-testid="estimate-result">
        <p className="text-sm font-semibold uppercase tracking-wide">
          {r.name} · {r.in_network ? "In network" : "Out of network"}
        </p>
        <p className="mt-2 text-sm">You pay</p>
        <p className="money text-5xl sm:text-6xl" data-testid="you-pay">{money(r.you_pay)}</p>
        <p className="mt-2 text-lg">
          Plan pays <span className="money" data-testid="plan-pays">{money(r.plan_pays)}</span>
        </p>
        {!r.covered && (
          <p className="mt-2 text-sm" data-testid="not-covered">
            Not covered by your plan this year. See the math below for why.
          </p>
        )}
        {!r.in_network && r.balance_bill > 0 && (
          <p className="mt-3 text-sm" data-testid="balance-bill">
            <span className="money">{money(r.balance_bill)}</span> of your cost is balance billing: the part your dentist
            can charge above what your plan allows.
          </p>
        )}
      </div>

      {r.trace.length > 0 && (
        <div className="portal-card" aria-hidden="true">
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={r.trace} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 12 }} />
                <Bar dataKey="amount" fill="var(--orange)" radius={6} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <section className="portal-card">
        <button
          type="button"
          className="btn btn-outline"
          aria-expanded={open}
          aria-controls="est-math"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide the math" : "Show the math"}
        </button>
        {open && (
          <ol id="est-math" className="mt-3 space-y-2" data-testid="trace">
            {r.trace.map((s, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
                <span>
                  <span className="block font-semibold">{s.label}</span>
                  <span className="block text-sm text-muted-foreground">{s.note}</span>
                </span>
                <span className="money">{money(s.amount)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

interface Props {
  memberId: string
  memberName: string
  planId: string
}

export function EstimateView({ memberId, memberName, planId }: Props) {
  const { token } = useSession()
  const [code, setCode] = useState<string | null>(null)
  const [inNetwork, setInNetwork] = useState(true)
  const [query, setQuery] = useState("")

  const [procs, setProcs] = useState<{ list: Procedure[]; loading: boolean; error: string | null }>({
    list: [],
    loading: true,
    error: null,
  })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setProcs((s) => ({ ...s, loading: true, error: null }))
    getProcedures().then(
      (m) => {
        if (!cancelled) setProcs({ list: m.map((x) => x.procedure), loading: false, error: null })
      },
      (e) => {
        if (!cancelled) setProcs({ list: [], loading: false, error: errorMessage(e) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [attempt])
  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  const [usage, setUsage] = useState<Usage | null>(null)
  useEffect(() => {
    let cancelled = false
    setUsage(null)
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

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return procs.list
    return procs.list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.synonyms.some((s) => s.toLowerCase().includes(q)),
    )
  }, [procs.list, query])

  const ready = code !== null && usage !== null
  const key = `${planId}|${code}|${JSON.stringify(usage)}`
  const est = useLoad<EstimateResponse>(ready, key, () => postEstimate(planId, code!, usage!))
  const tips = useLoad<SavingsTipsResponse>(ready, key, () =>
    postSavingsTips({ plan_id: planId }, [{ id: "t1", code: code!, urgency: "flexible", after: null }], usage!),
  )
  const questions = useLoad<QuestionsResponse>(ready, key, () => postQuestions({ plan_id: planId }, [code!], usage!))
  const result = est.data ? (inNetwork ? est.data.in_network : est.data.out_of_network) : null

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section aria-labelledby="est-pick" className="portal-card self-start">
        <h2 id="est-pick" className="portal-card-title">Pick a procedure</h2>
        <label className="mt-2 block text-sm font-semibold" htmlFor="est-search">Search in plain words</label>
        <input
          id="est-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="For example: cap, filling, root canal"
          className="mt-1 min-h-11 w-full rounded-full border border-line bg-white px-4"
        />
        {procs.loading && <p role="status" className="mt-3 text-sm text-muted-foreground">Loading procedures...</p>}
        {procs.error && (
          <div role="alert" className="note mt-3">
            <p>{procs.error}</p>
            <button type="button" className="btn btn-outline mt-2" onClick={retry}>Try again</button>
          </div>
        )}
        {!procs.loading && !procs.error && shown.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">No procedures match "{query}".</p>
        )}
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" aria-label="Procedures">
          {shown.map((p) => (
            <li key={p.code}>
              <button
                type="button"
                aria-pressed={code === p.code}
                aria-label={p.name}
                onClick={() => setCode(p.code)}
                className="portal-card-select w-full rounded-2xl border border-line bg-white p-3 text-left"
              >
                <span className="block font-semibold text-burgundy">{p.name}</span>
                <span className="block text-xs text-muted-foreground">{p.code} · {p.category}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-6" aria-live="polite">
        {!code && (
          <div className="portal-card text-center">
            <p className="portal-card-title">Your estimate will show up here</p>
            <p className="text-sm text-muted-foreground">
              Pick a procedure to see what {memberName.split(" ")[0]} would pay.
            </p>
          </div>
        )}
        {code && (
          <div role="group" aria-label="Network" className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={inNetwork} className={chipClass(inNetwork)} onClick={() => setInNetwork(true)}>
              In network
            </button>
            <button type="button" aria-pressed={!inNetwork} className={chipClass(!inNetwork)} onClick={() => setInNetwork(false)}>
              Out of network
            </button>
          </div>
        )}
        {code && est.loading && !est.data && <p role="status" className="portal-card text-sm">Working out your cost...</p>}
        {est.error && <p role="alert" className="note">{est.error}</p>}
        {result && <ResultPanel r={result} />}
        {result && (
          <>
            <SavingsTipsCard state={tips} />
            <QuestionsCard state={questions} />
          </>
        )}
        <p className="text-xs text-muted-foreground">
          This is an estimate. Your actual cost depends on your dentist's charges and claim review.
        </p>
      </div>
    </div>
  )
}
