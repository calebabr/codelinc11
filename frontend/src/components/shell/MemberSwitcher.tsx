import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSession } from "@/state/SessionContext"

// Card-style menu (not a native <select>) for choosing the active family member.
export function MemberSwitcher() {
  const { household, activeMember, setActiveMemberId } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/30 transition-colors hover:bg-white/20"
      >
        <span className="text-[0.7rem] opacity-80">Viewing</span>
        <span data-testid="active-member-label">{activeMember.name}</span>
        <ChevronDown className="size-3.5" aria-hidden />
      </button>

      {open && (
        <div
          role="group"
          aria-label="Choose a family member"
          className="absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl bg-white p-2 text-ink shadow-xl ring-1 ring-[var(--line)]"
        >
          <ul className="flex flex-col gap-1">
            {household.members.map((m) => {
              const selected = m.id === activeMember.id
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setActiveMemberId(m.id)
                      setOpen(false)
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--soft)]",
                      selected && "bg-[var(--soft)] ring-1 ring-burgundy",
                    )}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-burgundy text-xs font-semibold text-white">
                      {m.name.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{m.name}</span>
                      <span className="block text-xs capitalize text-[var(--muted)]">
                        {m.relationship === "self" ? "You" : m.relationship}
                        {m.status === "pending" ? " · pending" : ""}
                      </span>
                    </span>
                    {selected && <Check className="size-4 text-burgundy" aria-hidden />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
