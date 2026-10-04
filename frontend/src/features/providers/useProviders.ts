import { useEffect, useRef, useState } from "react"
import { getProviders } from "@/lib/api/providers"
import { errorMessage } from "@/lib/api/planYear"
import type { Provider, ProviderQuery } from "@/lib/types/providers"

export interface ProvidersState {
  list: Provider[]
  loading: boolean
  error: string | null
}

/** Loads providers when the query changes, after a short pause so quick taps make one request. */
export function useProviders(query: ProviderQuery | null, token: string, delayMs = 300): ProvidersState & { retry: () => void } {
  const [state, setState] = useState<ProvidersState>({ list: [], loading: false, error: null })
  const [attempt, setAttempt] = useState(0)
  const key = query ? JSON.stringify(query) : ""
  const latest = useRef(query)
  latest.current = query

  useEffect(() => {
    const q = latest.current
    if (!q) {
      setState({ list: [], loading: false, error: null })
      return
    }
    const ctl = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    const t = setTimeout(() => {
      getProviders(q, token, ctl.signal).then(
        (list) => setState({ list, loading: false, error: null }),
        (e) => {
          if (ctl.signal.aborted) return
          setState({ list: [], loading: false, error: errorMessage(e) })
        },
      )
    }, delayMs)
    return () => {
      clearTimeout(t)
      ctl.abort()
    }
  }, [key, token, attempt, delayMs])

  return { ...state, retry: () => setAttempt((n) => n + 1) }
}
