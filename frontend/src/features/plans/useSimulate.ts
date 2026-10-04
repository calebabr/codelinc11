import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError } from "@/lib/api/planYear"
import { postSimulate } from "@/lib/api/simulate"
import type { SimulateRequest, SimulateResponse } from "@/lib/types/simulate"

export interface SimulateState {
  result: SimulateResponse | null
  loading: boolean
  error: string | null
  unavailable: boolean
}

const DEBOUNCE_MS = 400

/** Calls POST /simulate whenever the request changes (debounced; the first call is immediate). */
export function useSimulate(request: SimulateRequest | null, token: string | null) {
  const [state, setState] = useState<SimulateState>({ result: null, loading: !!request, error: null, unavailable: false })
  const [attempt, setAttempt] = useState(0)
  const first = useRef(true)
  const key = request ? JSON.stringify(request) : ""

  useEffect(() => {
    if (!key) return
    const body = JSON.parse(key) as SimulateRequest
    const ctrl = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null, unavailable: false }))
    const delay = first.current ? 0 : DEBOUNCE_MS
    first.current = false
    const timer = setTimeout(() => {
      postSimulate(body, token, ctrl.signal).then(
        (result) => setState({ result, loading: false, error: null, unavailable: false }),
        (e) => {
          if (ctrl.signal.aborted) return
          if (e instanceof ApiError && e.status === 404) {
            setState({ result: null, loading: false, error: null, unavailable: true })
          } else {
            setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Something went wrong." }))
          }
        },
      )
    }, delay)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [key, token, attempt])

  return { ...state, retry: useCallback(() => setAttempt((n) => n + 1), []) }
}
