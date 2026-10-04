import { useState, type FormEvent } from "react"
import { errorMessage } from "@/lib/api/planYear"
import type { FamilyMember, NewMemberRequest, NewRelationship } from "@/lib/types/family"
import { useSession } from "@/state/SessionContext"
import { DEMO_CONTACT_HELP, digitsOnly, inputCls } from "./contact"

const RELATIONSHIPS: Array<{ value: NewRelationship; label: string }> = [
  { value: "spouse", label: "Spouse" },
  { value: "partner", label: "Partner" },
  { value: "child", label: "Child" },
  { value: "other", label: "Other" },
]

/** A card with an "Add a family member" button that opens an inline form (primary only). */
export function AddMemberCard({ onAdded }: { onAdded: (m: FamilyMember) => void }) {
  const { addMember } = useSession()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [rel, setRel] = useState<NewRelationship | null>(null)
  const [dob, setDob] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [zip, setZip] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  function reset() {
    setName("")
    setRel(null)
    setDob("")
    setEmail("")
    setPhone("")
    setZip("")
    setError(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError("Please enter a name.")
    if (!rel) return setError("Please choose how they are related to you.")
    if (!dob) return setError("Please enter a date of birth.")
    const body: NewMemberRequest = { name: name.trim(), relationship: rel, dob }
    if (email.trim()) body.email = email.trim()
    if (digitsOnly(phone)) body.phone = digitsOnly(phone)
    if (zip.trim()) body.zip = zip.trim()
    setBusy(true)
    try {
      const saved = await addMember(body)
      setDone(`${saved.name} was added to your family.`)
      reset()
      setOpen(false)
      onAdded(saved)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Add a family member" className="portal-card space-y-3">
      <h2 className="portal-card-title">Add a family member</h2>
      {done && (
        <p className="note" role="status">
          {done}
        </p>
      )}
      {!open ? (
        <button
          type="button"
          className="btn btn-orange min-h-11"
          onClick={() => {
            setDone(null)
            setOpen(true)
          }}
        >
          Add a family member
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div>
            <label className="block text-sm font-bold text-burgundy" htmlFor="add-name">Name</label>
            <input id="add-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </div>
          <div role="group" aria-label="Relationship">
            <p className="text-sm font-bold text-burgundy">How are they related to you?</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {RELATIONSHIPS.map((r) => (
                <button key={r.value} type="button" className="chip portal-card-select min-h-11 min-w-11" aria-pressed={rel === r.value} onClick={() => setRel(r.value)}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-burgundy" htmlFor="add-dob">Date of birth</label>
            <input id="add-dob" type="date" max={new Date().toISOString().slice(0, 10)} className={inputCls} value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-bold text-burgundy" htmlFor="add-email">Email (optional)</label>
            <input id="add-email" type="email" inputMode="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </div>
          <div>
            <label className="block text-sm font-bold text-burgundy" htmlFor="add-phone">Text message (SMS) number (optional)</label>
            <input id="add-phone" type="tel" inputMode="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" />
          </div>
          <div>
            <label className="block text-sm font-bold text-burgundy" htmlFor="add-zip">ZIP (optional)</label>
            <input id="add-zip" inputMode="numeric" className={inputCls} value={zip} onChange={(e) => setZip(e.target.value)} autoComplete="off" />
          </div>
          <p className="text-sm text-muted-foreground">{DEMO_CONTACT_HELP}</p>
          {error && (
            <p role="alert" className="text-sm text-warn-ink">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-orange min-h-11" disabled={busy}>
              {busy ? "Adding…" : "Add to family"}
            </button>
            <button
              type="button"
              className="btn btn-outline min-h-11"
              onClick={() => {
                reset()
                setOpen(false)
              }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
