import { useState, type FormEvent } from "react"
import { errorMessage } from "@/lib/api/planYear"
import type { FamilyMember } from "@/lib/types/family"
import { useSession } from "@/state/SessionContext"
import { changedFields, DEMO_CONTACT_HELP, inputCls, NOTES_MAX, valuesOf, type ProfileValues } from "./contact"

const today = () => new Date().toISOString().slice(0, 10)

/** Plain-language note when a birthday change moves someone between adult and child. */
export function roleChangeNote(before: FamilyMember, after: FamilyMember, primaryFirst: string): string | null {
  if (before.role === after.role) return null
  const first = after.name.split(" ")[0]
  if (after.role === "adult") return `${first} is now 18 and counts as an adult. Adults can have their own account.`
  if (after.role === "managed") return `${first} is now under 18 and is managed by ${primaryFirst}.`
  return null
}

export function ProfileForm({
  member,
  primaryFirst,
  onCancel,
  onSaved,
}: {
  member: FamilyMember
  primaryFirst: string
  onCancel: () => void
  onSaved: (saved: FamilyMember, note: string | null) => void
}) {
  const { updateMember } = useSession()
  const [v, setV] = useState<ProfileValues>(() => valuesOf(member))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof ProfileValues) => (e: { target: { value: string } }) => setV((cur) => ({ ...cur, [k]: e.target.value }))
  const id = (k: string) => `profile-${member.id}-${k}`

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!v.name.trim()) return setError("Please enter a name.")
    if (!v.dob) return setError("Please enter a date of birth.")
    const patch = changedFields(member, v)
    if (Object.keys(patch).length === 0) return onCancel()
    setBusy(true)
    try {
      const saved = await updateMember(member.id, patch)
      onSaved(saved, roleChangeNote(member, saved, primaryFirst))
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-[var(--line)] p-4" aria-label={`Edit profile for ${member.name}`} noValidate>
      <h3 className="font-bold text-burgundy">Edit profile</h3>
      <div>
        <label className="block text-sm font-bold text-burgundy" htmlFor={id("name")}>Name</label>
        <input id={id("name")} className={inputCls} value={v.name} onChange={set("name")} autoComplete="off" />
      </div>
      <div>
        <label className="block text-sm font-bold text-burgundy" htmlFor={id("dob")}>Date of birth</label>
        <input id={id("dob")} type="date" max={today()} className={inputCls} value={v.dob} onChange={set("dob")} />
      </div>
      <div>
        <label className="block text-sm font-bold text-burgundy" htmlFor={id("email")}>Email</label>
        <input id={id("email")} type="email" inputMode="email" className={inputCls} value={v.email} onChange={set("email")} autoComplete="off" />
      </div>
      <div>
        <label className="block text-sm font-bold text-burgundy" htmlFor={id("phone")}>Text message (SMS) number</label>
        <input id={id("phone")} type="tel" inputMode="tel" className={inputCls} value={v.phone} onChange={set("phone")} autoComplete="off" />
      </div>
      <div>
        <label className="block text-sm font-bold text-burgundy" htmlFor={id("zip")}>ZIP</label>
        <input id={id("zip")} inputMode="numeric" className={inputCls} value={v.zip} onChange={set("zip")} autoComplete="off" />
      </div>
      <div>
        <label className="block text-sm font-bold text-burgundy" htmlFor={id("notes")}>Notes</label>
        <textarea id={id("notes")} rows={3} maxLength={NOTES_MAX} className={`${inputCls} py-2`} value={v.notes} onChange={set("notes")} />
        <p className="text-sm text-muted-foreground" data-testid="notes-count">{v.notes.length} / {NOTES_MAX}</p>
      </div>
      <p className="text-sm text-muted-foreground">{DEMO_CONTACT_HELP}</p>
      {error && (
        <p role="alert" className="text-sm text-warn-ink">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-orange min-h-11" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn btn-outline min-h-11" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  )
}
