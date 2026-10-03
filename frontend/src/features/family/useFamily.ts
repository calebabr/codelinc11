import { useEffect, useState } from "react"
import { getMemberOverview } from "@/lib/api/family"
import { errorMessage } from "@/lib/api/planYear"
import type { MemberOverview } from "@/lib/types/family"

export interface Async<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/** Loads one person's overview whenever the selected person (or `reload`) changes. */
export function useOverview(memberId: string | null, token: string | null, reload = 0): Async<MemberOverview> {
  const [state, setState] = useState<Async<MemberOverview>>({ data: null, loading: false, error: null })
  useEffect(() => {
    if (!memberId || !token) {
      setState({ data: null, loading: false, error: null })
      return
    }
    let cancelled = false
    setState({ data: null, loading: true, error: null })
    getMemberOverview(memberId, token).then(
      (data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      },
      (err) => {
        if (!cancelled) setState({ data: null, loading: false, error: errorMessage(err) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [memberId, token, reload])
  return state
}
