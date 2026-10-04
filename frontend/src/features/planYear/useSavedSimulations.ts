import { useCallback, useEffect, useState } from "react"
import { deleteSavedSimulation, listSavedSimulations, updateSavedSimulation } from "@/lib/api/savedSimulations"
import { errorMessage } from "@/lib/api/planYear"
import type { SavedSimulation } from "@/lib/types/savedSimulations"

interface State {
  sims: SavedSimulation[]
  loading: boolean
  error: string | null
  /** The routes are not on the server yet (404). The rest of the page still works. */
  unavailable: boolean
}

const is404 = (e: unknown) => (e as { status?: number } | null)?.status === 404
export const UNAVAILABLE_TEXT = "Saving comparisons is not available on the server yet."

/** Saved plan comparisons for one member. Reloads when the member changes. */
export function useSavedSimulations(memberId: string, token: string) {
  const [state, setState] = useState<State>({ sims: [], loading: true, error: null, unavailable: false })
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setState({ sims: [], loading: true, error: null, unavailable: false })
    setActionError(null)
    listSavedSimulations(memberId, token).then(
      (sims) => {
        if (!cancelled) setState({ sims, loading: false, error: null, unavailable: false })
      },
      (e) => {
        if (cancelled) return
        if (is404(e)) setState({ sims: [], loading: false, error: null, unavailable: true })
        else setState({ sims: [], loading: false, error: errorMessage(e), unavailable: false })
      },
    )
    return () => {
      cancelled = true
    }
  }, [memberId, token, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  const act = useCallback(async <T,>(run: () => Promise<T>): Promise<T | null> => {
    setBusy(true)
    setActionError(null)
    try {
      return await run()
    } catch (e) {
      setActionError(is404(e) ? UNAVAILABLE_TEXT : errorMessage(e))
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const rename = useCallback(
    async (id: string, name: string) => {
      const rec = await act(() => updateSavedSimulation(memberId, token, id, { name }))
      if (rec) setState((s) => ({ ...s, sims: s.sims.map((x) => (x.id === id ? rec : x)) }))
      return rec
    },
    [act, memberId, token],
  )
  const remove = useCallback(
    async (id: string) => {
      const ok = await act(async () => {
        await deleteSavedSimulation(memberId, token, id)
        return true
      })
      if (ok) setState((s) => ({ ...s, sims: s.sims.filter((x) => x.id !== id) }))
      return ok === true
    },
    [act, memberId, token],
  )

  return { ...state, busy, actionError, retry, rename, remove }
}
