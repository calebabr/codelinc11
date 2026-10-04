import { useCallback, useEffect, useRef, useState } from "react"
import { useLocation } from "react-router"
import { Sparkles, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { ease } from "@/lib/motion"
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
  // Phones: size the panel to the visible area so the input stays above the on-screen keyboard.
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null)

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

  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden" // the page behind must not scroll
    if (!vv) return () => { document.body.style.overflow = previous }
    const update = () => setViewport({ height: vv.height, top: vv.offsetTop })
    update()
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
      document.body.style.overflow = previous
      setViewport(null)
    }
  }, [open])

  if (pathname === "/assistant" || pathname === "/reports/ask") return null

  return (
    <>
      {!open && (
        <button
          ref={openerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open assistant"
          // bottom 6rem: sits above the "Powered by Netlify" badge (bottom-right, about 64 px tall, top layer),
          // which otherwise covers this button and takes its clicks on the live site.
          className="fixed bottom-[max(6rem,calc(env(safe-area-inset-bottom)+4.75rem))] right-[max(1.25rem,env(safe-area-inset-right))] z-40 flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-full bg-orange-dark px-4 py-3 text-white shadow-lg transition-transform hover:scale-105"
        >
          <Sparkles className="size-5" aria-hidden />
          <span className="hidden text-sm font-medium sm:inline">Ask the assistant</span>
        </button>
      )}
      {/* Opens with a short fade and slide; AnimatePresence plays it in reverse on close */}
      <AnimatePresence>
      {open && (
        <motion.div
          key="assistant-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-x-0 top-0 z-50 flex h-dvh justify-end bg-ink/30 sm:p-3"
          style={viewport ? { height: viewport.height, top: viewport.top } : undefined}
          onClick={close}
        >
          <motion.aside
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.28, ease }}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Assistant"
            className="flex h-full w-full flex-col overflow-hidden bg-white shadow-xl sm:max-w-[30rem] sm:rounded-2xl lg:max-w-[32rem]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-burgundy px-4 pt-[max(0.25rem,env(safe-area-inset-top))] text-white">
              <h2 className="font-heading text-lg">Assistant</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Close assistant"
                className="-mr-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10"
              >
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
          </motion.aside>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  )
}
