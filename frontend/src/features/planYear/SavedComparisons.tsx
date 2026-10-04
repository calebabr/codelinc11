import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { MAX_SIM_NAME_LENGTH } from "@/lib/api/savedSimulations"
import { formatDate } from "@/lib/format"
import type { SavedSimulation } from "@/lib/types/savedSimulations"
import type { useSavedSimulations } from "@/features/planYear/useSavedSimulations"

type Saved = ReturnType<typeof useSavedSimulations>

const SMALL = "!min-h-9 !px-3 text-sm"

/** The router state "Open" sends to /plans. */
export interface SimulationHandoff {
  simulation: SavedSimulation["request"]
}

function coveredText(sim: SavedSimulation): string {
  return sim.request.members.map((m) => `${m.name} (${m.care_level} care)`).join(", ")
}

function knownText(sim: SavedSimulation, names: Map<string, string>): string | null {
  const parts = sim.request.members.flatMap((m) =>
    m.known_care.map((k) => `${names.get(k.code) ?? k.code}${k.count > 1 ? ` x${k.count}` : ""} for ${m.name}`),
  )
  return parts.length > 0 ? parts.join(", ") : null
}

export function SavedComparisons({ memberId, saved, names }: { memberId: string; saved: Saved; names: Map<string, string> }) {
  const navigate = useNavigate()
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameText, setRenameText] = useState("")
  const [confirmId, setConfirmId] = useState<string | null>(null)
  useEffect(() => {
    setRenaming(null)
    setConfirmId(null)
  }, [memberId])

  const open = (sim: SavedSimulation) => {
    const state: SimulationHandoff = { simulation: sim.request }
    navigate("/plans", { state })
  }
  const rename = async (sim: SavedSimulation) => {
    const next = renameText.trim()
    if (!next) return
    if (await saved.rename(sim.id, next)) setRenaming(null)
  }
  const del = async (sim: SavedSimulation) => {
    if (await saved.remove(sim.id)) setConfirmId(null)
  }

  return (
    <section aria-labelledby="py-saved-sims" className="portal-card">
      <h2 id="py-saved-sims" className="portal-card-title">Saved plan comparisons</h2>
      {saved.loading && <p role="status" className="text-sm text-muted-foreground">Loading your saved comparisons...</p>}
      {saved.error && (
        <div role="alert" className="note">
          <p>{saved.error}</p>
          <button type="button" className="btn btn-outline mt-2" onClick={saved.retry}>Try again</button>
        </div>
      )}
      {saved.unavailable && (
        <p className="text-sm text-muted-foreground">Saving comparisons is not available on the server yet.</p>
      )}
      {!saved.loading && !saved.error && !saved.unavailable && saved.sims.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You have not saved a comparison yet. On the Plans page, open "Which plan fits us?" and tap "Save to Plan My Year".
        </p>
      )}
      {saved.actionError && <p role="alert" className="note mt-2">{saved.actionError}</p>}
      <ul className="mt-2 space-y-3">
        {saved.sims.map((sim) => {
          const known = knownText(sim, names)
          return (
            <li key={sim.id} data-testid="saved-comparison" aria-label={sim.name} className="rounded-2xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                {renaming === sim.id ? (
                  <>
                    <label htmlFor={`rns-${sim.id}`} className="sr-only">New name for {sim.name}</label>
                    <input
                      id={`rns-${sim.id}`}
                      value={renameText}
                      maxLength={MAX_SIM_NAME_LENGTH}
                      onChange={(e) => setRenameText(e.target.value)}
                      className="min-h-9 min-w-0 flex-1 rounded-full border border-line bg-white px-3"
                    />
                    <button type="button" className={`btn btn-orange ${SMALL}`} disabled={saved.busy || !renameText.trim()} onClick={() => rename(sim)}>
                      Save name
                    </button>
                    <button type="button" className={`btn btn-outline ${SMALL}`} onClick={() => setRenaming(null)}>Cancel</button>
                  </>
                ) : (
                  <p className="font-semibold text-burgundy">{sim.name}</p>
                )}
              </div>
              <p className="mt-1 text-sm" data-testid="saved-summary">
                Best: {sim.summary.winner_name}, cheapest in {sim.summary.winner_share}% of years
                <span className="ml-2 text-xs text-muted-foreground">(as saved)</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Covered: {coveredText(sim)}</p>
              {known && <p className="text-sm text-muted-foreground">Known care: {known}</p>}
              <p className="text-sm text-muted-foreground">
                {sim.request.in_network ? "In network" : "Out of network"} · Saved {formatDate(sim.created_at)}
              </p>
              {confirmId === sim.id ? (
                <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={`Delete ${sim.name}?`}>
                  <span className="text-sm">Delete "{sim.name}"? This cannot be undone.</span>
                  <button type="button" className={`btn btn-orange ${SMALL}`} disabled={saved.busy} onClick={() => del(sim)}>Yes, delete</button>
                  <button type="button" className={`btn btn-outline ${SMALL}`} onClick={() => setConfirmId(null)}>Keep it</button>
                </div>
              ) : (
                renaming !== sim.id && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className={`btn btn-outline ${SMALL}`} aria-label={`Open ${sim.name}`} onClick={() => open(sim)}>Open</button>
                    <button
                      type="button"
                      className={`btn btn-outline ${SMALL}`}
                      aria-label={`Rename ${sim.name}`}
                      onClick={() => {
                        setRenaming(sim.id)
                        setRenameText(sim.name)
                      }}
                    >
                      Rename
                    </button>
                    <button type="button" className={`btn btn-outline ${SMALL}`} aria-label={`Delete ${sim.name}`} onClick={() => setConfirmId(sim.id)}>Delete</button>
                  </div>
                )
              )}
            </li>
          )
        })}
      </ul>
      {saved.sims.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          The summary is what the comparison showed when you saved it. "Open" runs it again with today's plans. This is an estimate. Your actual cost depends on your dentist's charges and claim review.
        </p>
      )}
    </section>
  )
}
