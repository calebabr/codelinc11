import { useEffect, useState } from "react"
import { ErrorNote } from "@/components/ErrorNote"
import { errorMessage, getExplanation } from "@/lib/api/reports"
import { formatDate, money } from "@/lib/format"
import type { ReportExplanation, ReportItem } from "@/lib/types/reports"

export const KIND_LABEL: Record<string, string> = { claim: "Claim", eob: "EOB", copay: "Copay", other: "Other" }

const plain = { textDecoration: "none" } as const

function statusBadge(item: ReportItem): { text: string; cls: string } {
  if (item.paid_status === "paid") return { text: "Paid", cls: "chip chip-ok" }
  if (item.paid_status === "unpaid") return { text: "You owe", cls: "chip chip-warn" }
  const s = item.data.status
  if (s) return { text: s.charAt(0).toUpperCase() + s.slice(1), cls: /denied/i.test(s) ? "chip chip-warn" : "chip chip-ok" }
  return { text: "Nothing to pay", cls: "chip chip-ok" }
}

/** A plain list of the steps, each with a bar. Bar length is only a picture of the size, never a new number. */
function Steps({ ex }: { ex: ReportExplanation }) {
  const top = Math.max(0, ...ex.steps.map((s) => Math.abs(s.amount ?? 0)))
  return (
    <ol className="space-y-2" aria-label="How the amounts add up">
      {ex.steps.map((s, i) => (
        <li key={i} data-testid="explain-step">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold">{s.label}</span>
            <span className="money font-bold text-burgundy">{s.amount === null ? "" : money(s.amount)}</span>
          </div>
          {s.amount !== null && top > 0 && (
            <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden="true">
              <div className="h-2 rounded-full bg-burgundy" style={{ width: `${Math.max(2, (Math.abs(s.amount) / top) * 100)}%` }} />
            </div>
          )}
          {s.plain && <p className="mt-0.5 text-xs text-muted-foreground" data-testid="step-plain">{s.plain}</p>}
        </li>
      ))}
    </ol>
  )
}

/** The server names this line "Note on the document"; it holds the remark (for example a denial reason). */
const REMARK_LABEL = "Note on the document"

function Explain({ token, memberId, id, remark }: { token: string; memberId: string; id: string; remark?: string | null }) {
  const [ex, setEx] = useState<ReportExplanation | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setEx(null)
    setErr(null)
    getExplanation(token, memberId, id).then(
      (r) => !cancelled && setEx(r),
      (e) => !cancelled && setErr(errorMessage(e)),
    )
    return () => {
      cancelled = true
    }
  }, [token, memberId, id, attempt])

  if (err) return <ErrorNote className="note mt-3" message={err} onRetry={() => setAttempt((n) => n + 1)} />
  if (!ex) return <p role="status" className="mt-3 text-sm">Reading this document...</p>
  const noteLine = ex.lines.find((l) => l.label === REMARK_LABEL)
  const note = remark?.trim() || noteLine?.plain || null
  const lines = ex.lines.filter((l) => l.label !== REMARK_LABEL)
  const stepLabels = new Set(ex.steps.map((s) => s.label))
  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-line bg-white p-3" data-testid="explanation">
      {ex.what_it_is && <p className="text-sm">{ex.what_it_is}</p>}
      {note && (
        <p className="note text-sm" data-testid="doc-remark">
          <span className="font-semibold">Note on the document: </span>{note}
        </p>
      )}
      {lines.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm" aria-label="What each line means" data-testid="explain-lines">
          {lines.map((l, i) => (
            <li key={i}>
              <span className="font-semibold">{l.label}</span>
              {l.amount !== null && !stepLabels.has(l.label) ? ` ${money(l.amount)}` : ""}: {l.plain}
            </li>
          ))}
        </ul>
      )}
      {ex.steps.length > 0 && <Steps ex={ex} />}
      {ex.balance_billing_note && (
        <p className="note text-sm" data-testid="balance-note">{ex.balance_billing_note}</p>
      )}
      {ex.next_step && (
        <div>
          <p className="text-sm font-semibold text-burgundy">What to do next</p>
          <p className="text-sm">{ex.next_step}</p>
        </div>
      )}
    </div>
  )
}

interface Props {
  item: ReportItem
  token: string
  memberId: string
  open: boolean
  onToggle: () => void
  busy: boolean
  onMarkPaid: () => void
  onDelete: () => void
}

export function ReportCard({ item, token, memberId, open, onToggle, busy, onMarkPaid, onDelete }: Props) {
  const [confirm, setConfirm] = useState(false)
  const badge = statusBadge(item)
  const d = item.data
  const label = KIND_LABEL[item.kind] ?? "Document"
  return (
    <li className="portal-card" data-testid="report-item">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="portal-card-title !mb-0 break-words">{item.title}</h3>
          <p className="text-sm text-muted-foreground">
            {item.service_date ? formatDate(item.service_date) : "No date"}
            {item.provider_name ? ` · ${item.provider_name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="chip bg-muted" style={plain}>{label}</span>
          <span className={badge.cls} style={plain} data-testid="status-badge">{badge.text}</span>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {d.billed != null && (
          <div><dt className="text-muted-foreground">Billed</dt><dd className="money text-lg">{money(d.billed)}</dd></div>
        )}
        {d.plan_paid != null && (
          <div><dt className="text-muted-foreground">Plan paid</dt><dd className="money text-lg">{money(d.plan_paid)}</dd></div>
        )}
        {d.you_owe != null && (
          <div><dt className="text-muted-foreground">You owe</dt><dd className="money text-lg text-burgundy">{money(d.you_owe)}</dd></div>
        )}
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-outline" aria-expanded={open} onClick={onToggle} aria-label={`${open ? "Hide" : "Explain"} ${item.title}`}>
          {open ? "Hide explanation" : "Explain this"}
        </button>
        {item.paid_status === "unpaid" && (
          <button type="button" className="btn btn-outline" disabled={busy} onClick={onMarkPaid} aria-label={`Mark ${item.title} paid`}>
            Mark paid
          </button>
        )}
        {confirm ? (
          <>
            <span className="text-sm">Delete this document?</span>
            <button type="button" className="btn btn-orange" disabled={busy} onClick={() => { setConfirm(false); onDelete() }} aria-label={`Yes, delete ${item.title}`}>
              Yes, delete
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setConfirm(false)}>Cancel</button>
          </>
        ) : (
          <button type="button" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[var(--muted)] hover:text-burgundy" disabled={busy} onClick={() => setConfirm(true)} aria-label={`Delete ${item.title}`}>
            Delete
          </button>
        )}
      </div>
      {open && <Explain token={token} memberId={memberId} id={item.id} remark={d.remark} />}
    </li>
  )
}
