import { useState } from "react"
import { Link } from "react-router"
import { useSession } from "@/state/SessionContext"
import { createSavedSimulation, MAX_SIM_NAME_LENGTH } from "@/lib/api/savedSimulations"
import { errorMessage } from "@/lib/api/planYear"
import { UNAVAILABLE_TEXT } from "@/features/planYear/useSavedSimulations"
import type { SimulateRequest } from "@/lib/types/simulate"

export function defaultComparisonName(winnerName: string, now = new Date()): string {
  const short = now.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return `${winnerName} is best, ${short}`
}

/** "Save to Plan My Year" for the current choices. The server runs the simulation and stores its own summary. */
export function SaveComparison({ request, winnerName, planOrder }: { request: SimulateRequest; winnerName: string; planOrder: string[] }) {
  const { activeMember, token } = useSession()
  const [asking, setAsking] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedName, setSavedName] = useState<string | null>(null)

  const trimmed = name.trim()
  const start = () => {
    setName(defaultComparisonName(winnerName))
    setError(null)
    setSavedName(null)
    setAsking(true)
  }
  const save = async () => {
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      const rec = await createSavedSimulation(activeMember.id, token, trimmed, { ...request, plan_ids: planOrder })
      setSavedName(rec.name)
      setAsking(false)
    } catch (e) {
      setError((e as { status?: number }).status === 404 ? UNAVAILABLE_TEXT : errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-line p-3" data-testid="save-comparison">
      {!asking && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-orange" onClick={start}>Save to Plan My Year</button>
          {savedName && (
            <p role="status" className="text-sm">
              Saved "{savedName}". <Link to="/plan-year" className="font-semibold text-burgundy underline">See it in Plan My Year</Link>
            </p>
          )}
        </div>
      )}
      {asking && (
        <div>
          <label htmlFor="sim-name" className="block text-sm font-semibold">Name this comparison</label>
          <div className="mt-1 flex flex-wrap gap-2">
            <input
              id="sim-name"
              value={name}
              maxLength={MAX_SIM_NAME_LENGTH}
              onChange={(e) => setName(e.target.value)}
              className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-white px-4"
            />
            <button type="button" className="btn btn-orange" disabled={busy || !trimmed} onClick={save}>Save</button>
            <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setAsking(false)}>Cancel</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="note mt-2 text-sm">{error}</p>}
    </div>
  )
}
