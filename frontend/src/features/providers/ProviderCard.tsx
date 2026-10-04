import { money } from "@/lib/format"
import type { Provider } from "@/lib/types/providers"

export const SPECIALTY_LABEL: Record<string, string> = {
  general: "General dentistry",
  pediatric: "Children's dentistry",
  orthodontics: "Braces (orthodontics)",
  oral_surgery: "Oral surgery",
  endodontics: "Root canals (endodontics)",
  periodontics: "Gum care (periodontics)",
}

/** Keeps digits and a leading plus, for a tel: link. The display keeps the server's text. */
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`

interface Props {
  provider: Provider
  isMine: boolean
  busy: boolean
  onSet: () => void
  onRemove: () => void
}

export function ProviderCard({ provider: p, isMine, busy, onSet, onRemove }: Props) {
  const est = p.estimate
  return (
    <li className="portal-card" data-testid="provider-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="portal-card-title !mb-0 break-words">{p.practice_name}</h3>
          <p className="text-sm">{p.dentist_name} · {SPECIALTY_LABEL[p.specialty] ?? p.specialty}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isMine && <span className="chip chip-ok">Your dentist</span>}
          {p.in_network ? <span className="chip chip-ok">In network</span> : <span className="chip chip-warn">Out of network</span>}
        </div>
      </div>
      <p className="mt-2 text-sm font-semibold text-burgundy">{p.city}, {p.state} · {p.distance_mi} mi</p>
      <p className="text-sm text-muted-foreground">{p.address}, {p.city}, {p.state} {p.zip}</p>
      <p className="mt-1 text-sm">
        <a
          className="inline-flex min-h-11 items-center font-semibold text-burgundy underline"
          href={telHref(p.phone)}
          aria-label={`Call ${p.practice_name} at ${p.phone}`}
        >
          {p.phone}
        </a>
      </p>
      {p.languages.length > 0 && <p className="text-sm text-muted-foreground">Languages: {p.languages.join(", ")}</p>}
      <p className="mt-1">
        {p.accepting_new ? <span className="chip chip-ok">Accepting new patients</span> : <span className="chip chip-off">Not accepting</span>}
      </p>

      {est && (
        <div className="note mt-3" data-testid="provider-estimate">
          <p className="text-base font-bold text-burgundy">You would pay {money(est.you_pay)} here</p>
          {!est.in_network && (
            <p className="text-sm">
              Plan pays {money(est.plan_pays)}.
              {est.balance_bill > 0 && <> You may also owe {money(est.balance_bill)} the dentist can bill beyond the plan allowance.</>}
            </p>
          )}
          {est.note && <p className="text-sm text-muted-foreground">{est.note}</p>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {isMine ? (
          <button type="button" className="btn btn-outline" disabled={busy} onClick={onRemove} aria-label={`Remove ${p.practice_name} as my dentist`}>
            Remove
          </button>
        ) : (
          <button type="button" className="btn btn-orange" disabled={busy} onClick={onSet} aria-label={`Set ${p.practice_name} as my dentist`}>
            Set as my dentist
          </button>
        )}
      </div>
    </li>
  )
}
