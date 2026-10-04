import { useCallback, useEffect, useRef, useState } from "react"
import { errorMessage, getReports, getSamples, type ReportQuery } from "@/lib/api/reports"
import { ApiError } from "@/lib/api/planYear"
import type { ReportList, ReportSample } from "@/lib/types/reports"

export interface ReportsState {
  data: ReportList | null
  loading: boolean
  error: string | null
  /** The server said this person's documents are not visible to the signed-in person. */
  denied: boolean
  reload: () => Promise<void>
}

/** Loads one person's saved documents. Reloads when the person, filter or order changes. */
export function useReports(token: string, memberId: string, q: ReportQuery): ReportsState {
  const [data, setData] = useState<ReportList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)
  const seq = useRef(0)
  const alive = useRef(true)

  const reload = useCallback(async () => {
    const mine = ++seq.current
    try {
      const res = await getReports(token, memberId, q)
      if (!alive.current || mine !== seq.current) return
      setData(res)
      setError(null)
      setDenied(false)
    } catch (e) {
      if (!alive.current || mine !== seq.current) return
      setData(null)
      if (e instanceof ApiError && e.status === 403) setDenied(true)
      else setError(errorMessage(e))
    } finally {
      if (alive.current && mine === seq.current) setLoading(false)
    }
  }, [token, memberId, q.kind, q.order]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    alive.current = true
    setLoading(true)
    setError(null)
    setDenied(false)
    void reload()
    return () => {
      alive.current = false
    }
  }, [reload])

  return { data, loading, error, denied, reload }
}

/** The sample documents the demo offers. */
export function useSamples(token: string) {
  const [list, setList] = useState<ReportSample[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getSamples(token).then(
      (l) => {
        if (cancelled) return
        setList(l)
        setError(null)
        setLoading(false)
      },
      (e) => {
        if (cancelled) return
        setError(errorMessage(e))
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [token, attempt])
  return { list, loading, error, retry: () => setAttempt((n) => n + 1) }
}
