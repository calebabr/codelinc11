import { Suspense } from "react"
import { Navigate, Outlet } from "react-router"
import { PageLoading } from "./PageLoading"
import { useSessionGate } from "@/state/SessionContext"
import { UtilityBar } from "./UtilityBar"
import { NavBar } from "./NavBar"
import { Footer } from "./Footer"
import { AssistantButton } from "./AssistantButton"

export function Shell() {
  const gate = useSessionGate()

  if (gate.status === "signed-out") return <Navigate to="/login" replace />
  if (gate.status === "loading") {
    return (
      <div className="mx-auto max-w-md p-8" role="status">
        Loading your account…
      </div>
    )
  }
  if (gate.status === "error" || !gate.session) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-8">
        <div role="alert" className="note">
          <p className="font-semibold">We could not sign you in.</p>
          <p>{gate.error ?? "Something went wrong. Please try again."}</p>
          <button type="button" className="btn btn-outline mt-2" onClick={gate.retry}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--soft)] text-ink">
      <UtilityBar />
      <NavBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <AssistantButton />
    </div>
  )
}
