import { useState } from "react"
import { LayoutDashboard, MessageSquare, Users, Sparkles, X } from "lucide-react"
import { UserProvider } from "@/state/UserContext"
import { ProfileSwitcher } from "@/components/ProfileSwitcher"
import { ChatPanel } from "@/components/ChatPanel"
import { Dashboard } from "@/pages/Dashboard"
import { Chatbot } from "@/pages/Chatbot"
import { Profiles } from "@/pages/Profiles"

type Page = "dashboard" | "chatbot" | "profiles"

const NAV: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
  { id: "chatbot", label: "Chatbot", icon: <MessageSquare className="size-4" /> },
  { id: "profiles", label: "Profiles", icon: <Users className="size-4" /> },
]

function Shell() {
  const [page, setPage] = useState<Page>("dashboard")
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <span className="font-semibold">Plan Coverage Explainer</span>
          </div>
          <nav className="ml-auto flex items-center gap-1">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setPage(n.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  page === n.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {n.icon}
                <span className="hidden sm:inline">{n.label}</span>
              </button>
            ))}
          </nav>
          <div className="hidden md:block">
            <ProfileSwitcher />
          </div>
        </div>
        <div className="mx-auto block max-w-5xl px-4 pb-3 md:hidden">
          <ProfileSwitcher />
        </div>
      </header>

      {/* Pages */}
      <main>
        {page === "dashboard" && <Dashboard onOpenChat={() => setPage("chatbot")} />}
        {page === "chatbot" && <Chatbot />}
        {page === "profiles" && <Profiles />}
      </main>

      {/* Floating chat button + drawer (available on every page) */}
      {!chatOpen && page !== "chatbot" && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-transform hover:scale-105"
          aria-label="Open assistant"
        >
          <Sparkles className="size-5" />
          <span className="hidden sm:inline text-sm font-medium">Ask the assistant</span>
        </button>
      )}

      {chatOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" onClick={() => setChatOpen(false)}>
          <div
            className="h-full w-full max-w-md p-3 sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-full">
              <button
                onClick={() => setChatOpen(false)}
                className="absolute -left-3 top-2 z-10 flex size-7 items-center justify-center rounded-full bg-background text-foreground shadow ring-1 ring-foreground/10"
                aria-label="Close assistant"
              >
                <X className="size-4" />
              </button>
              <ChatPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <UserProvider>
      <Shell />
    </UserProvider>
  )
}
