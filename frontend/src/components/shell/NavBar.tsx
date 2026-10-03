import { NavLink } from "react-router"
import { cn } from "@/lib/utils"

export const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/plans", label: "Plans" },
  { to: "/family", label: "Family" },
  { to: "/costs", label: "Costs" },
  { to: "/plan-year", label: "Plan My Year" },
  { to: "/assistant", label: "Assistant" },
]

// Sticky white nav. On narrow screens the links scroll sideways.
export function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4">
        <NavLink to="/" className="hidden shrink-0 items-center gap-2 py-3 sm:flex">
          <span className="size-3 rounded-full bg-orange" aria-hidden />
          <span className="font-heading text-lg font-semibold tracking-tight text-burgundy">Dental Benefits</span>
        </NavLink>
        <nav aria-label="Main" className="-mx-1 flex flex-1 gap-5 overflow-x-auto px-1">
          {NAV_ITEMS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }: { isActive: boolean }) =>
                cn(
                  "shrink-0 border-b-2 py-4 text-sm font-medium transition-colors",
                  isActive
                    ? "border-orange text-burgundy"
                    : "border-transparent text-[var(--muted)] hover:text-ink",
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
