import { useState } from "react"
import { useLocation } from "react-router"
import { Sparkles, X } from "lucide-react"
import { AssistantChat } from "@/features/assistant/AssistantChat"
import { useSession } from "@/state/SessionContext"

// Floating assistant button, shown on every page except /assistant.
// The panel holds the same chat as the Assistant page, for the active member (T10).
export function AssistantButton() {
  const { pathname } = useLocation()
  const { household, activeMember } = useSession()
  const primary = household.members.find((m) => m.role === "primary") ?? household.members[0]
  const [open, setOpen] = useState(false)

  if (pathname === "/assistant") return null

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open assistant"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-orange px-4 py-3 text-white shadow-lg transition-transform hover:scale-105"
        >
          <Sparkles className="size-5" aria-hidden />
          <span className="hidden text-sm font-medium sm:inline">Ask the assistant</span>
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={() => setOpen(false)}>
          <aside
            role="dialog"
            aria-label="Assistant"
            className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-burgundy px-4 py-3 text-white">
              <h2 className="font-heading text-lg">Assistant</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <AssistantChat
                signInAs={primary.id}
                memberId={activeMember.id}
                memberName={activeMember.name.split(" ")[0]}
              />
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
