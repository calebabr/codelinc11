import { useCallback, useEffect, useRef, useState } from "react"
import { useLocation } from "react-router"
import { Sparkles, X } from "lucide-react"
import { AssistantChat } from "@/features/assistant/AssistantChat"
import { useSession } from "@/state/SessionContext"

// Floating assistant button, shown on every page except /assistant.
// The panel holds the same chat as the Assistant page, for the active member (T10).
export function AssistantButton() {
  const { pathname } = useLocation()
  const { activeMember, token } = useSession()
  const [open, setOpen] = useState(false)
  const openerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    // Give focus back to the button that opened the panel.
    setTimeout(() => openerRef.current?.focus(), 0)
  }, [])

  // Move focus into the panel on open; close on Escape; keep Tab inside the panel.
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        close()
        return
      }
      if (e.key !== "Tab" || !panelRef.current) return
      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!panelRef.current.contains(active)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, close])

  if (pathname === "/assistant") return null

  return (
    <>
      {!open && (
        <button
          ref={openerRef}
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
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={close}>
          <aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Assistant"
            className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-burgundy px-4 py-3 text-white">
              <h2 className="font-heading text-lg">Assistant</h2>
              <button ref={closeRef} type="button" onClick={close} aria-label="Close assistant">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <AssistantChat
                token={token}
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
