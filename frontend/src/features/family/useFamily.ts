import { useCallback, useEffect, useState } from "react"
import { demoLogin, getDemoAccounts, getMemberOverview } from "@/lib/api/family"
import { errorMessage } from "@/lib/api/planYear"
import type { DemoAccount, DemoLoginResponse, MemberOverview } from "@/lib/types/family"

export interface Async<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/** Signs in with the demo accounts (no password) and keeps the token in memory only. */
export function useFamilySession(preferredMemberId?: string) {
  const [accounts, setAccounts] = useState<DemoAccount[]>([])
  const [login, setLogin] = useState<DemoLoginResponse | null>(null)
  const [state, setState] = useState<{ loading: boolean; error: string | null }>({ loading: true, error: null })
  const [attempt, setAttempt] = useState(0)
  const [chosen, setChosen] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, error: null })
    const run = async () => {
      try {
        const list = await getDemoAccounts()
        if (cancelled) return
        setAccounts(list)
        const pick =
          list.find((a) => a.member_id === chosen) ??
          list.find((a) => a.member_id === preferredMemberId && a.role === "primary") ??
          list.find((a) => a.role === "primary") ??
          list[0]
        if (!pick) throw new Error("No demo accounts are available.")
        const result = await demoLogin(pick.member_id)
        if (cancelled) return
        setLogin(result)
        setState({ loading: false, error: null })
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: errorMessage(err) })
      }
    }
    void run()
    return () => {
      cancelled = true
    }
    // preferredMemberId is only a first guess; later changes do not sign anyone out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen, attempt])

  const signInAs = useCallback((memberId: string) => setChosen(memberId), [])
  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { accounts, login, ...state, signInAs, retry }
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
