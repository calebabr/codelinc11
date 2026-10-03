import { useState } from "react"
import { money, percent } from "@/lib/format"
import { postInvite } from "@/lib/api/family"
import { errorMessage } from "@/lib/api/planYear"
import type { FamilyMember, InviteResponse, MemberOverview, ServiceEligibility } from "@/lib/types/family"
import type { Async } from "./useFamily"

function ServiceCard({ s, pending }: { s: ServiceEligibility; pending: boolean }) {
  let cls = "chip-off"
  let word = "Not available"
  if (s.covered) {
    cls = "chip-ok"
    word = "Available"
  } else if (pending) {
    cls = "chip-pending"
    word = "Pending verification"
  }
  return (
    <li className="rounded-xl border border-[var(--line)] p-3" data-testid={`service-${s.service}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-burgundy">{s.label}</span>
        <span className={`chip ${cls}`}>{word}</span>
      </div>
      {s.covered && (
        <p className="mt-1 text-sm">
          Plan pays {percent(s.plan_share)}
          {s.deductible_applies ? ", after the deductible" : ", deductible does not apply"}
        </p>
      )}
      {s.note && <p className="mt-1 text-sm text-muted-foreground">{s.note}</p>}
    </li>
  )
}

function InviteBox({ member, householdId, token }: { member: FamilyMember; householdId: string; token: string }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState<InviteResponse | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setInvite(await postInvite(householdId, email.trim(), member.id, token))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (invite) {
    return (
      <p className="note" role="status">
        Invite recorded as {invite.status}. No email is sent in this demo.
      </p>
    )
  }
  if (!open) {
    return (
      <button type="button" className="btn btn-outline" onClick={() => setOpen(true)}>
        Invite {member.name.split(" ")[0]}
      </button>
    )
  }
  return (
    <form onSubmit={send} className="space-y-2">
      <label className="block text-sm font-bold text-burgundy" htmlFor={`invite-${member.id}`}>
        Email address for {member.name}
      </label>
      <input
        id={`invite-${member.id}`}
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="min-h-11 w-full rounded-xl border border-[var(--line)] px-3"
      />
      {error && (
        <p role="alert" className="text-sm text-warn-ink">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-orange" disabled={busy}>
        {busy ? "Saving…" : "Add invite (demo)"}
      </button>
    </form>
  )
}

export function MemberDetail({
  member,
  overview,
  viewerIsPrimary,
  householdId,
  token,
  canViewAs,
  isActive,
  onViewAs,
  onRetry,
}: {
  member: FamilyMember
  overview: Async<MemberOverview>
  viewerIsPrimary: boolean
  householdId: string
  token: string
  canViewAs: boolean
  isActive: boolean
  onViewAs: () => void
  onRetry: () => void
}) {
  const pending = member.status === "pending"
  const o = overview.data
  const first = member.name.split(" ")[0]
  const canInvite = viewerIsPrimary && !member.has_login && member.role !== "managed" && member.age >= 18
  // Bar width is a display ratio of two API values, not a dollar amount.
  const barPct = o && o.benefits.annual_max > 0 ? Math.min(100, (o.benefits.max_used / o.benefits.annual_max) * 100) : 0
  return (
    <section aria-label={`Details for ${member.name}`} className="portal-card space-y-5" data-testid="member-detail">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="portal-card-title !text-2xl">{member.name}</h2>
          <p className="text-sm capitalize text-muted-foreground">
            {member.relationship} · age {member.age}
          </p>
        </div>
        {canViewAs && (
          <button type="button" className="btn btn-outline" onClick={onViewAs} disabled={isActive}>
            {isActive ? `Viewing as ${first}` : `View as ${first}`}
          </button>
        )}
      </div>

      {pending && (
        <p className="note" data-testid="pending-note">
          <strong>Pending verification.</strong> {member.status_note ?? "We still need to confirm this person's coverage."}
        </p>
      )}
      {!pending && member.status_note && <p className="note">{member.status_note}</p>}

      {member.relationship === "child" && (
        <p className="text-sm">Children are covered to age 19, or to 26 as a full-time student.</p>
      )}

      {overview.loading && <p role="status">Loading {first}'s benefits…</p>}
      {overview.error && (
        <div role="alert" className="note">
          <p>{overview.error}</p>
          <button type="button" className="btn btn-outline mt-2" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {o && (
        <>
          <div>
            <h3 className="font-bold text-burgundy">{first}'s numbers this plan year</h3>
            <p className="money mt-1 text-3xl text-burgundy" data-testid="max-left">
              {money(o.benefits.max_remaining)} left
            </p>
            <div
              className="coverage mt-2"
              role="progressbar"
              aria-label="Yearly maximum used"
              aria-valuemin={0}
              aria-valuemax={o.benefits.annual_max}
              aria-valuenow={o.benefits.max_used}
            >
              <i style={{ width: `${barPct}%` }} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Maximum used</dt>
                <dd className="font-bold" data-testid="max-used">
                  {money(o.usage.max_used)} of {money(o.benefits.annual_max)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Deductible met</dt>
                <dd className="font-bold" data-testid="deductible">
                  {money(o.usage.deductible_met)} of {money(o.benefits.deductible)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Visits</dt>
                <dd className="font-bold" data-testid="visits">
                  {o.usage.visits}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Cleanings used</dt>
                <dd className="font-bold" data-testid="cleanings">
                  {o.usage.cleanings_used}
                </dd>
              </div>
            </dl>
            {o.reminder && <p className="note mt-3">{o.reminder}</p>}
          </div>

          <div>
            <h3 className="font-bold text-burgundy">What {first} can use</h3>
            <ul className="mt-2 grid gap-3 sm:grid-cols-2">
              {o.eligibility.map((s) => (
                <ServiceCard key={s.service} s={s} pending={pending} />
              ))}
            </ul>
          </div>
        </>
      )}

      {canInvite && <InviteBox member={member} householdId={householdId} token={token} />}
    </section>
  )
}
