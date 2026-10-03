// Demo sign-in: one card per account from GET /auth/demo-accounts, no password.
// Simple on purpose; the design task replaces the visuals and owns this file.

import { useState } from "react"
import { Navigate, useNavigate } from "react-router"
import { errorMessage } from "@/lib/api/planYear"
import { useSessionGate } from "@/state/SessionContext"

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

  // Already signed in (for example after the automatic first sign-in): go home.
  if (gate.status === "ready" && busyId === null) return <Navigate to="/" replace />

  return (
    <div className="mx-auto max-w-md space-y-4 p-8">
      <h1 className="text-3xl font-bold text-burgundy">Sign in</h1>
      <p className="text-sm text-muted-foreground">This is a demo. Pick a person to continue. No password is needed.</p>

      {gate.status === "loading" && <p role="status">Loading…</p>}
      {gate.status === "error" && (
        <div role="alert" className="note">
          <p>{gate.error}</p>
          <button type="button" className="btn btn-outline mt-2" onClick={gate.retry}>
            Try again
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="note">
          {error}
        </p>
      )}

      <ul className="space-y-3">
        {gate.accounts.map((a) => (
          <li key={a.account_id}>
            <button
              type="button"
              className="portal-card w-full text-left"
              disabled={busyId !== null}
              onClick={() => void choose(a.member_id)}
            >
              <span className="block font-bold text-burgundy">{a.display_name}</span>
              <span className="block text-sm text-muted-foreground">
                {a.email} ({a.role})
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
