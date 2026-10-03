// Demo sign-in: one-click account cards from GET /auth/demo-accounts, no password.
// Self-contained on purpose: the design task can restyle this one file.

import { useState } from "react"
import { Link, Navigate, useNavigate } from "react-router"
import AuthLayout from "@/components/auth/AuthLayout"
import { ArrowRight } from "lucide-react"
import { errorMessage } from "@/lib/api/planYear"
import { useSessionGate } from "@/state/SessionContext"
import type { DemoAccount } from "@/lib/types/family"

const ROLE_WORDS: Record<string, string> = {
  primary: "Account holder",
  adult: "Adult",
  managed: "Child profile",
}

export default function LoginPage() {
  const gate = useSessionGate()
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function choose(memberId: string) {
    setBusyId(memberId)
    setError(null)
    try {
      await gate.signIn(memberId)
      navigate("/")
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  // Already signed in (for example after a reload in the same tab): go home.
  if (gate.status === "ready" && busyId === null) return <Navigate to="/" replace />

  function roleLine(a: DemoAccount): string {
    const word = ROLE_WORDS[a.role] ?? a.role
    // The demo accounts list has no status yet; Noah is the seeded pending member.
    const pending = a.status === "pending" || a.member_id === "m-noah"
    return pending ? `${word} · Waiting for approval` : word
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Pick a demo account to see your family's plan.">
      <div className="space-y-3">
        {gate.status === "loading" && (
          <p role="status" className="text-muted-foreground">
            Loading…
          </p>
        )}
        {gate.status === "error" && (
          <div role="alert" className="rounded-xl border border-border bg-accent p-4 text-sm">
            <p>{gate.error}</p>
            <button
              type="button"
              className="mt-2 rounded-full border border-primary px-4 py-2 font-semibold text-primary"
              onClick={gate.retry}
            >
              Try again
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-xl border border-border bg-accent p-4 text-sm">
            {error}
          </p>
        )}

        <ul className="space-y-3">
          {gate.accounts.map((a) => (
            <li key={a.account_id}>
              <button
                type="button"
                className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary hover:shadow-md disabled:opacity-60"
                disabled={busyId !== null}
                onClick={() => void choose(a.member_id)}
              >
                <span
                  aria-hidden
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground"
                >
                  {a.display_name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-foreground">{a.display_name}</span>
                  <span className="block text-sm text-muted-foreground">{roleLine(a)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{a.email}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
                  {busyId === a.member_id ? "Signing in…" : "Continue"} <ArrowRight aria-hidden className="size-4" />
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Maya (a child profile) has no login. Sign in as Jordan to see her benefits.
        </p>
        <Link to="/welcome" className="inline-block text-sm font-semibold text-primary hover:underline">
          Back to the welcome page
        </Link>
      </div>
    </AuthLayout>
  )
}
