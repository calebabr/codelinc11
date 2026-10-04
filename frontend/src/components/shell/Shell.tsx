import { Navigate, Outlet, useLocation } from "react-router"
import { motion } from "motion/react"
import { ease } from "@/lib/motion"
import { useSessionGate } from "@/state/SessionContext"
import { UtilityBar } from "./UtilityBar"
import { NavBar } from "./NavBar"
import { Footer } from "./Footer"
import { AssistantButton } from "./AssistantButton"

export function Shell() {
  const gate = useSessionGate()
  const { pathname } = useLocation()

  // Signed in to Clerk (RequireClerk) but no household profile picked yet
  if (gate.status === "signed-out") return <Navigate to="/choose-profile" replace />
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
    <div className="flex min-h-screen flex-col bg-[var(--soft)] text-ink">
      <UtilityBar />
      <NavBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {/* key: replay the entrance on every page change. Its sections stagger in via .page-motion (index.css). */}
        <motion.div
          key={pathname}
          className="page-motion"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease }}
        >
          <Outlet />
        </motion.div>
      </main>
      <Footer />
      <AssistantButton />
    </div>
  )
}
