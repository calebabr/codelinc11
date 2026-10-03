import { useEffect, useState } from "react"
import { MAX_NAME_LENGTH, MAX_PLAN_ITEMS, type SavedPlan } from "@/lib/api/savedPlans"
import type { TreatmentItem } from "@/lib/types/planYear"
import type { useSavedPlans } from "@/features/planYear/useSavedPlans"

type Saved = ReturnType<typeof useSavedPlans>

export function defaultPlanName(firstName: string, now = new Date()): string {
  const short = now.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return `Plan for ${firstName}, ${short}`
}

export function sameItems(a: TreatmentItem[], b: TreatmentItem[]): boolean {
  const key = (l: TreatmentItem[]) => JSON.stringify(l.map((i) => [i.id, i.code, i.urgency, i.after]))
  return key(a) === key(b)
}

interface Props {
  firstName: string
  memberId: string
  saved: Saved
  items: TreatmentItem[]
  openPlanId: string | null
  /** Treatment names by procedure code, for the card summaries. */
  names: Map<string, string>
  onOpen: (plan: SavedPlan) => void
  onSavedAs: (plan: SavedPlan) => void
}

const SMALL = "!min-h-9 !px-3 text-sm"

export function SavedPlans({ firstName, memberId, saved, items, openPlanId, names, onOpen, onSavedAs }: Props) {
  const openPlan = saved.plans.find((p) => p.id === openPlanId) ?? null
  const dirty = openPlan !== null && !sameItems(openPlan.items, items)

  const [name, setName] = useState(() => defaultPlanName(firstName))
  useEffect(() => setName(defaultPlanName(firstName)), [memberId, firstName])
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameText, setRenameText] = useState("")
  const [confirmId, setConfirmId] = useState<string | null>(null)
  useEffect(() => {
    setRenaming(null)
    setConfirmId(null)
  }, [memberId])

  const tooMany = items.length > MAX_PLAN_ITEMS
  const trimmed = name.trim()
  const canSave = !saved.unavailable && !saved.busy && items.length > 0 && !tooMany && trimmed.length > 0

  const save = async () => {
    const rec = await saved.create(trimmed, items)
    if (rec) {
      onSavedAs(rec)
      setName(defaultPlanName(firstName))
    }
  }
  const updateOpen = async () => {
    if (openPlan) await saved.update(openPlan.id, { items })
  }
  const rename = async (plan: SavedPlan) => {
    const next = renameText.trim()
    if (!next) return
    if (await saved.update(plan.id, { name: next })) setRenaming(null)
  }
  const del = async (plan: SavedPlan) => {
    if (await saved.remove(plan.id)) setConfirmId(null)
  }

  return (
    <>
      <section aria-labelledby="py-save" className="portal-card">
        <h2 id="py-save" className="portal-card-title">Save this plan</h2>
        {saved.unavailable ? (
          <p className="text-sm text-muted-foreground">Saved plans are not available right now.</p>
        ) : (
          <>
            {openPlan && (
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span>Open: <strong>{openPlan.name}</strong></span>
                {dirty ? (
                  <span className="chip chip-warn" data-testid="unsaved-changes">Unsaved changes</span>
                ) : (
                  <span className="chip chip-ok">Saved</span>
                )}
                {dirty && (
                  <button type="button" className={`btn btn-orange ${SMALL}`} disabled={saved.busy} onClick={updateOpen}>
                    Update saved plan
                  </button>
                )}
              </div>
            )}
            <label htmlFor="py-plan-name" className="block text-sm font-semibold">Plan name</label>
            <div className="mt-1 flex flex-wrap gap-2">
              <input
                id="py-plan-name"
                value={name}
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => setName(e.target.value)}
                className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-white px-4"
              />
              <button type="button" className="btn btn-orange" disabled={!canSave} onClick={save}>
                {openPlan ? "Save as a new plan" : "Save this plan"}
              </button>
            </div>
            {items.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Add a treatment to save it.</p>}
            {tooMany && (
              <p className="mt-2 text-sm text-muted-foreground">A saved plan can hold up to {MAX_PLAN_ITEMS} treatments.</p>
            )}
          </>
        )}
        {saved.actionError && <p role="alert" className="note mt-2">{saved.actionError}</p>}
      </section>

      <section aria-labelledby="py-saved" className="portal-card">
        <h2 id="py-saved" className="portal-card-title">My saved plans</h2>
        {saved.loading && <p role="status" className="text-sm text-muted-foreground">Loading your saved plans...</p>}
        {saved.error && (
          <div role="alert" className="note">
            <p>{saved.error}</p>
            <button type="button" className="btn btn-outline mt-2" onClick={saved.retry}>Try again</button>
          </div>
        )}
        {saved.unavailable && (
          <p className="text-sm text-muted-foreground">Saved plans are not available right now. You can still build plans here.</p>
        )}
        {!saved.loading && !saved.error && !saved.unavailable && saved.plans.length === 0 && (
          <p className="text-sm text-muted-foreground">You have not saved a plan yet. Build one and tap "Save this plan".</p>
        )}
        <ul className="mt-2 space-y-3">
          {saved.plans.map((plan) => {
            const isOpen = plan.id === openPlanId
            return (
              <li
                key={plan.id}
                data-testid="saved-plan"
                aria-label={plan.name}
                className={`rounded-2xl border p-3 ${isOpen ? "border-burgundy bg-white" : "border-line"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {renaming === plan.id ? (
                    <>
                      <label htmlFor={`rn-${plan.id}`} className="sr-only">New name for {plan.name}</label>
                      <input
                        id={`rn-${plan.id}`}
                        value={renameText}
                        maxLength={MAX_NAME_LENGTH}
                        onChange={(e) => setRenameText(e.target.value)}
                        className="min-h-9 min-w-0 flex-1 rounded-full border border-line bg-white px-3"
                      />
                      <button
                        type="button"
                        className={`btn btn-orange ${SMALL}`}
                        disabled={saved.busy || !renameText.trim()}
                        onClick={() => rename(plan)}
                      >
                        Save name
                      </button>
                      <button type="button" className={`btn btn-outline ${SMALL}`} onClick={() => setRenaming(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-burgundy">{plan.name}</p>
                      {isOpen && <span className="chip chip-ok">Open now</span>}
                      {isOpen && dirty && <span className="chip chip-warn">Unsaved changes</span>}
                    </>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plan.items.length} {plan.items.length === 1 ? "treatment" : "treatments"}
                  {plan.items.length > 0 && ": " + plan.items.map((i) => names.get(i.code) ?? i.code).join(", ")}
                </p>
                {confirmId === plan.id ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={`Delete ${plan.name}?`}>
                    <span className="text-sm">Delete "{plan.name}"? This cannot be undone.</span>
                    <button type="button" className={`btn btn-orange ${SMALL}`} disabled={saved.busy} onClick={() => del(plan)}>
                      Yes, delete
                    </button>
                    <button type="button" className={`btn btn-outline ${SMALL}`} onClick={() => setConfirmId(null)}>
                      Keep it
                    </button>
                  </div>
                ) : (
                  renaming !== plan.id && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" className={`btn btn-outline ${SMALL}`} aria-label={`Open ${plan.name}`} onClick={() => onOpen(plan)}>
                        Open
                      </button>
                      <button
                        type="button"
                        className={`btn btn-outline ${SMALL}`}
                        aria-label={`Rename ${plan.name}`}
                        onClick={() => {
                          setRenaming(plan.id)
                          setRenameText(plan.name)
                        }}
                      >
                        Rename
                      </button>
                      <button type="button" className={`btn btn-outline ${SMALL}`} aria-label={`Delete ${plan.name}`} onClick={() => setConfirmId(plan.id)}>
                        Delete
                      </button>
                    </div>
                  )
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
