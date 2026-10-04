import { useState } from "react"
import { Link } from "react-router"
import { useSession } from "@/state/SessionContext"
import { ErrorNote } from "@/components/ErrorNote"
import { deleteReport, errorMessage, markPaid } from "@/lib/api/reports"
import { money } from "@/lib/format"
import type { ReportKindFilter, ReportOrder } from "@/lib/types/reports"
import { useReports } from "@/features/reports/useReports"
import { ReportCard } from "@/features/reports/ReportCard"
import { SYNTHETIC_NOTICE } from "@/features/reports/notice"
import { AddDocument } from "@/features/reports/AddDocument"


const KINDS: { value: ReportKindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "claim", label: "Claims" },
  { value: "eob", label: "EOBs" },
  { value: "copay", label: "Copays" },
]
const ORDERS: { value: ReportOrder; label: string }[] = [
  { value: "asc", label: "Oldest first" },
  { value: "desc", label: "Newest first" },
]
const chip = (on: boolean) => `chip min-h-11 cursor-pointer border px-4 ${on ? "border-burgundy bg-burgundy text-white" : "border-line bg-white"}`

export default function ReportsPage() {
  const { activeMember, household, token } = useSession()
  const memberId = activeMember.id
  const first = activeMember.name.split(" ")[0]
  const [kind, setKind] = useState<ReportKindFilter>("all")
  const [order, setOrder] = useState<ReportOrder>("asc")
  const [openId, setOpenId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const reports = useReports(token, memberId, { kind, order })

  const items = reports.data?.items ?? []
  const totals = reports.data?.totals ?? null
  const primary = household.members.find((m) => m.role === "primary")?.name.split(" ")[0] ?? "the account owner"

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusyId(id)
    setActionError(null)
    try {
      await fn()
      await reports.reload()
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-bold text-burgundy sm:text-5xl">Reports</h1>
        <p className="mt-2 max-w-2xl text-lg text-muted-foreground">
          Claims, explanation of benefits (EOBs) and copays for {first}, explained in plain words.
        </p>
      </header>

      <p className="note" data-testid="synthetic-notice">{SYNTHETIC_NOTICE}</p>

      <div className="portal-card flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">Have a question about a bill or a claim?</p>
        <Link to="/reports/ask" className="btn btn-orange">Ask the assistant about my reports</Link>
      </div>

      {reports.denied ? (
        <p role="alert" className="note" data-testid="no-access">
          You can't see {first}'s documents. Only {first}{activeMember.role === "managed" ? ` (through ${primary})` : ""} and the account owner can open them.
        </p>
      ) : (
        <>
          {totals && (
            <section aria-labelledby="rp-owe" className="portal-card" data-testid="totals">
              <h2 id="rp-owe" className="portal-card-title">What you owe right now</h2>
              <p className="money text-4xl text-burgundy" data-testid="owe-open">{money(totals.you_owe_open)}</p>
              <p className="text-sm text-muted-foreground">Open bills that are not marked paid yet.</p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><dt className="text-muted-foreground">Billed</dt><dd className="money text-lg" data-testid="total-billed">{money(totals.billed)}</dd></div>
                <div><dt className="text-muted-foreground">Allowed</dt><dd className="money text-lg" data-testid="total-allowed">{money(totals.allowed)}</dd></div>
                <div><dt className="text-muted-foreground">Plan paid</dt><dd className="money text-lg" data-testid="total-plan-paid">{money(totals.plan_paid)}</dd></div>
                <div><dt className="text-muted-foreground">You paid</dt><dd className="money text-lg" data-testid="total-you-paid">{money(totals.you_paid)}</dd></div>
              </dl>
            </section>
          )}

          <section aria-label="Documents" className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div role="group" aria-label="Type of document" className="flex flex-wrap items-center gap-2">
                {KINDS.map((k) => (
                  <button key={k.value} type="button" aria-pressed={kind === k.value} className={chip(kind === k.value)} onClick={() => setKind(k.value)}>
                    {k.label}
                  </button>
                ))}
              </div>
              <div role="group" aria-label="Order by date" className="flex flex-wrap items-center gap-2">
                {ORDERS.map((o) => (
                  <button key={o.value} type="button" aria-pressed={order === o.value} className={chip(order === o.value)} onClick={() => setOrder(o.value)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {actionError && <ErrorNote message={actionError} />}
            {reports.loading && <p role="status" className="portal-card text-sm">Loading documents...</p>}
            {reports.error && <ErrorNote message={reports.error} onRetry={() => void reports.reload()} />}
            {!reports.loading && !reports.error && items.length === 0 && (
              <p className="portal-card text-sm" data-testid="empty">
                {kind === "all"
                  ? `No documents yet for ${first}. Add a sample below to see how it works.`
                  : "No documents of this type. Try another filter or add a sample below."}
              </p>
            )}
            {!reports.error && items.length > 0 && (
              <ul className="space-y-3" aria-label="Saved documents">
                {items.map((it) => (
                  <ReportCard
                    key={it.id}
                    item={it}
                    token={token}
                    memberId={memberId}
                    open={openId === it.id}
                    onToggle={() => setOpenId(openId === it.id ? null : it.id)}
                    busy={busyId === it.id}
                    onMarkPaid={() => void act(it.id, () => markPaid(token, memberId, it.id))}
                    onDelete={() => void act(it.id, () => deleteReport(token, memberId, it.id))}
                  />
                ))}
              </ul>
            )}
          </section>

          <AddDocument token={token} memberId={memberId} onAdded={() => void reports.reload()} />
        </>
      )}

      <p className="text-xs text-muted-foreground">
        This is an estimate. Your actual cost depends on your dentist's charges and claim review.
      </p>
    </div>
  )
}
