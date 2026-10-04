// "Name your family": an optional, friendly card where the account holder can give the demo family
// made-up names. Used once after the first one-tap sign-in (Home) and later from "Rename family"
// (Family page). The four fields are matched to people by role, relationship and age from the
// household data, never by id or by name, so it works for any demo family.

import { useState, type FormEvent } from "react"
import { errorMessage } from "@/lib/api/planYear"
import type { FamilyMember, HouseholdNamesRequest } from "@/lib/types/family"
import { useSession } from "@/state/SessionContext"

export const NAME_MAX = 24
export const SURNAME_MAX = 30
const NAME_RE = /^[\p{L}\p{M} '’.-]+$/u

export type SlotKey = "you" | "spouse" | "young" | "older"

export interface Slot {
  key: SlotKey
  label: string
  hint?: string
  member: FamilyMember
}

function isPartner(m: FamilyMember): boolean {
  return /spouse|partner|husband|wife/i.test(m.relationship)
}

/** Match the form's four people to household members by role, relationship and age. */
export function slotsFor(members: FamilyMember[]): Slot[] {
  const out: Slot[] = []
  const primary = members.find((m) => m.role === "primary")
  if (primary) out.push({ key: "you", label: "You", member: primary })
  const spouse = members.find((m) => m.role !== "primary" && isPartner(m))
  if (spouse) out.push({ key: "spouse", label: "Your spouse", member: spouse })
  const young = members.find((m) => m.role === "managed")
  if (young) out.push({ key: "young", label: "Your young child", hint: "You manage their account.", member: young })
  const older = members.find((m) => m.role === "adult" && !isPartner(m))
  if (older)
    out.push({
      key: "older",
      label: "Your older child",
      hint: "Too old to be a dependent, has their own account.",
      member: older,
    })
  return out
}

/** The family surname is the household name without the trailing word "household". */
export function surnameOf(householdName: string): string {
  return householdName.replace(/\s+household$/i, "").trim()
}

/** A plain message for a name that the server would refuse, or "" if it is fine. */
export function nameProblem(raw: string, max: number, required: boolean): string {
  const v = raw.trim()
  if (!v) return required ? "Please enter a name." : ""
  if (v.length > max) return `Use ${max} characters or fewer.`
  if (!NAME_RE.test(v)) return "Use letters, spaces, apostrophes, hyphens and periods only."
  return ""
}

export function NameFamilyForm({
  title = "Name your family",
  cancelLabel,
  onDone,
}: {
  title?: string
  /** "Skip" on the first-run card, "Cancel" when opened from the Family page. */
  cancelLabel: string
  /** Called after Skip/Cancel or after the names were saved. */
  onDone: () => void
}) {
  const { household, renameFamily, dismissNaming } = useSession()
  const slots = slotsFor(household.members)
  const initialSurname = surnameOf(household.name)
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(slots.map((s) => [s.key, s.member.name])),
    surname: initialSurname,
  }))
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const problem = (key: string) =>
    key === "surname" ? nameProblem(values.surname ?? "", SURNAME_MAX, false) : nameProblem(values[key] ?? "", NAME_MAX, true)
  const shown = (key: string) => (touched[key] || submitted ? problem(key) : "")

  async function save(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (["surname", ...slots.map((s) => s.key)].some((k) => problem(k))) return
    const body: HouseholdNamesRequest = {
      members: slots
        .filter((s) => values[s.key].trim() !== s.member.name)
        .map((s) => ({ member_id: s.member.id, name: values[s.key].trim() })),
    }
    const surname = (values.surname ?? "").trim()
    if (surname && surname !== initialSurname) body.household_name = surname
    if (body.members.length === 0 && body.household_name === undefined) {
      dismissNaming() // nothing changed: same as skipping
      onDone()
      return
    }
    setBusy(true)
    try {
      await renameFamily(body)
      onDone()
    } catch (err) {
      setServerError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function skip() {
    dismissNaming()
    onDone()
  }

  const field = (key: string, label: string, max: number, hint?: string) => {
    const msg = shown(key)
    const id = `name-${key}`
    return (
      <div key={key}>
        <label htmlFor={id} className="block text-sm font-semibold text-ink">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        <input
          id={id}
          type="text"
          value={values[key] ?? ""}
          maxLength={max + 20}
          autoComplete="off"
          aria-invalid={msg ? true : undefined}
          aria-describedby={[hint ? `${id}-hint` : "", msg ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}
          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          onBlur={() => setTouched((t) => ({ ...t, [key]: true }))}
          className="mt-1 min-h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink"
        />
        {msg && (
          <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-burgundy">
            {msg}
          </p>
        )}
      </div>
    )
  }

  return (
    <section aria-labelledby="name-family-title" className="portal-card" data-testid="name-family">
      <h2 id="name-family-title" className="portal-card-title">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Use made-up names, this is a demo.</p>
      <p className="text-sm text-muted-foreground">You can skip this and change names later from the Family page.</p>
      <form className="mt-4 space-y-4" onSubmit={(e) => void save(e)} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          {slots.map((s) => field(s.key, s.label, NAME_MAX, s.hint))}
        </div>
        <div className="sm:max-w-[50%]">{field("surname", "Family surname (optional)", SURNAME_MAX)}</div>
        {serverError && (
          <p role="alert" className="note">
            {serverError}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-orange" disabled={busy}>
            {busy ? "Saving…" : "Save names"}
          </button>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={skip}>
            {cancelLabel}
          </button>
        </div>
      </form>
    </section>
  )
}
