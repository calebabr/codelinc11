import { Link } from "react-router"
import { CalendarDays, CalendarPlus, MessageCircle, Calculator, ArrowRight } from "lucide-react"
import { useSession } from "@/state/SessionContext"
import { money, formatDate } from "@/lib/format"
import { remindersUrl } from "@/lib/api/home"
import { useHomeData, useLogVisit, useProcedureChips } from "@/features/home/useHome"
import type { BenefitsStatus } from "@/lib/types/home"

// Layout ratio for bar widths only. Dollar figures are always shown as the API returned them.
function ratio(part: number, whole: number): number {
  return whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0
}

function StatCard(props: {
  title: string
  value: string
  detail: string
  pct: number
  label: string
  testId: string
}) {
  return (
    <div className="portal-card" data-testid={props.testId}>
      <h2 className="portal-card-title">{props.title}</h2>
      <p className="money mt-2 text-4xl text-burgundy">{props.value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{props.detail}</p>
      <div
        className="coverage mt-4"
        role="progressbar"
        aria-label={props.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(props.pct)}
      >
        <i style={{ width: `${props.pct}%` }} />
      </div>
    </div>
  )
}

function Cards({ b }: { b: BenefitsStatus }) {
  const cleaning = b.frequencies.find((f) => f.code === "D1110")
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard
        testId="card-max"
        title="Maximum left"
        value={money(b.max_remaining)}
        detail={`left of ${money(b.annual_max)} this plan year`}
        pct={ratio(b.max_used, b.annual_max)}
        label="Yearly maximum used"
      />
      <StatCard
        testId="card-deductible"
        title="Deductible"
        value={b.deductible_remaining > 0 ? money(b.deductible_remaining) : "Met"}
        detail={
          b.deductible_remaining > 0
            ? `left to pay before the plan pays (of ${money(b.deductible)})`
            : `You have paid your ${money(b.deductible)} deductible`
        }
        pct={ratio(b.deductible_met, b.deductible)}
        label="Deductible paid"
      />
      <StatCard
        testId="card-cleanings"
        title="Cleanings used"
        value={cleaning ? `${cleaning.used} of ${cleaning.limit}` : "None"}
        detail={cleaning ? `${cleaning.remaining} left this plan year` : "No cleaning limit on this plan"}
        pct={cleaning ? ratio(cleaning.used, cleaning.limit) : 0}
        label="Cleanings used"
      />
    </div>
  )
}

const LINKS = [
  { to: "/costs", label: "Costs", text: "See what a visit or a year could cost.", Icon: Calculator },
  { to: "/plan-year", label: "Plan My Year", text: "Find the cheapest order for your care.", Icon: CalendarDays },
  { to: "/assistant", label: "Assistant", text: "Ask a question in plain words.", Icon: MessageCircle },
]

export default function HomePage() {
  const { household, activeMember, token } = useSession()
  const { data, loading, error, retry } = useHomeData(token, activeMember.id)
  const chips = useProcedureChips()
  const visit = useLogVisit(household.planTier, activeMember.id, data?.overview ?? null)
  const first = activeMember.name.split(" ")[0]
  const isSelf = activeMember.relationship === "self"

  const benefits = visit.logged?.benefits ?? data?.overview.benefits ?? null
  const overview = data?.overview
  const reminder = visit.logged ? visit.logged.benefits.reminder : overview?.reminder
  const upcoming = (data?.schedule ?? []).slice(0, 3)

  return (
    <div className="space-y-8">
      <section className="hero-banner rounded-[24px] p-6 sm:p-10">
        <p className="eyebrow">Your dental benefits</p>
        <h1 className="mt-2 text-4xl font-bold text-white sm:text-5xl">Welcome back, {first}</h1>
        <p className="mt-3 text-lg text-white/85">
          {overview ? `${overview.plan_tier.name} plan` : "Your plan"} ·{" "}
          {isSelf ? "Viewing your own benefits" : `Viewing ${activeMember.name} (${activeMember.relationship})`}
        </p>
      </section>

      {loading && (
        <p role="status" className="text-muted-foreground">
          Loading {first}'s benefits…
        </p>
      )}

      {error && (
        <div role="alert" className="note">
          <p>{error}</p>
          <button type="button" className="btn btn-outline mt-3" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {benefits && overview && (
        <>
          <Cards b={benefits} />

          {reminder ? (
            <section className="note" aria-label="Benefits reminder">
              <p className="font-semibold text-burgundy">Use your benefits before they reset</p>
              <p className="mt-1">{reminder}</p>
              <a className="btn btn-orange mt-3" href={remindersUrl(benefits.plan_name, benefits.max_remaining)} download>
                <CalendarPlus aria-hidden className="h-4 w-4" /> Add reminders to my calendar
              </a>
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">
              <a className="underline" href={remindersUrl(benefits.plan_name, benefits.max_remaining)} download>
                Add a benefits reminder to my calendar
              </a>
            </p>
          )}

          <section aria-labelledby="coming-up" className="portal-card">
            <h2 id="coming-up" className="portal-card-title">
              Coming up
            </h2>
            {upcoming.length === 0 ? (
              <p className="mt-3 text-muted-foreground">Nothing is scheduled for {first} yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {upcoming.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3" data-testid="upcoming-item">
                    <div>
                      <p className="font-semibold">{e.title}</p>
                      {e.note && <p className="text-sm text-muted-foreground">{e.note}</p>}
                    </div>
                    <span className={`chip ${e.kind === "appointment" ? "chip-ok" : "chip-pending"}`}>
                      {e.kind === "appointment" ? "Appointment" : "Reminder"} · {formatDate(e.due_date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="log-visit" className="portal-card">
            <h2 id="log-visit" className="portal-card-title">
              Log a visit for {first}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tap a visit to see what it uses up. This only changes the numbers for {first}, on this page.
            </p>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Choose a visit">
              {chips.slice(0, 8).map((p) => (
                <button
                  key={p.code}
                  type="button"
                  className="btn btn-outline"
                  disabled={visit.busy}
                  onClick={() => visit.log(p.code)}
                  aria-label={`Log ${p.name}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            {visit.error && (
              <p role="alert" className="mt-3 text-sm text-burgundy">
                {visit.error}
              </p>
            )}
            {visit.logged && (
              <div className="result-panel mt-4" data-testid="visit-result">
                <p className="eyebrow">{visit.logged.last.name}</p>
                {!visit.logged.last.covered && <p className="text-sm">Not covered because of a frequency limit.</p>}
                <p className="money text-4xl">You pay {money(visit.logged.last.you_pay)}</p>
                <p className="text-sm text-white/85">The plan pays {money(visit.logged.last.plan_pays)}</p>
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              This is an estimate. Your actual cost depends on your dentist's charges and claim review.
            </p>
          </section>
        </>
      )}

      <section aria-labelledby="quick-links">
        <h2 id="quick-links" className="sr-only">
          Quick links
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {LINKS.map(({ to, label, text, Icon }) => (
            <Link key={to} to={to} className="portal-card flex items-start gap-3 no-underline">
              <Icon aria-hidden className="mt-1 h-5 w-5 text-orange-dark" />
              <span>
                <span className="portal-card-title flex items-center gap-1">
                  {label} <ArrowRight aria-hidden className="h-4 w-4" />
                </span>
                <span className="block text-sm text-muted-foreground">{text}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
