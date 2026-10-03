import { Outlet } from "react-router"
import { UtilityBar } from "./UtilityBar"
import { NavBar } from "./NavBar"
import { Footer } from "./Footer"
import { AssistantButton } from "./AssistantButton"

export function Shell() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--soft)] text-ink">
      <UtilityBar />
      <NavBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <Footer />
      <AssistantButton />
    </div>
  )
}
