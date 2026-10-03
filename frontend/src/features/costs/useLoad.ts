import { useEffect, useState } from "react"
import { errorMessage } from "@/lib/api/planYear"
import type { Loadable } from "@/features/planYear/usePlanYear"

/** Runs `run` whenever `key` changes (after `delay` ms); ignores answers that arrive late. */
export function useLoad<T>(enabled: boolean, key: string, run: () => Promise<T>, delay = 0): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ data: null, loading: false, error: null })
  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null })
      return
    }
    let cancelled = false
    setState((s) => ({ data: s.data, loading: true, error: null }))
    const t = setTimeout(() => {
      run().then(
        (data) => {
          if (!cancelled) setState({ data, loading: false, error: null })
        },
        (err) => {
          if (!cancelled) setState({ data: null, loading: false, error: errorMessage(err) })
        },
      )
    }, delay)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // `key` stands in for everything `run` closes over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key])
  return state
}
