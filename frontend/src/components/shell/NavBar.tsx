import { Link, NavLink } from "react-router"
import { cn } from "@/lib/utils"
import { LogoMark } from "@/components/Logo"

export const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/plans", label: "Plans" },
  { to: "/family", label: "Family" },
  { to: "/costs", label: "Costs" },
  { to: "/plan-year", label: "Plan My Year" },
  { to: "/providers", label: "Providers" },
  { to: "/reports", label: "Reports" },
  { to: "/assistant", label: "Assistant" },
]

// Sticky white nav. On narrow screens the links scroll sideways.
export function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4">
        {/* The logo goes to the landing page; the Home tab is the app's home. The landing page's
            "Continue your demo family" button brings a signed-in visitor straight back. */}
        <Link
          to="/welcome"
          aria-label="Molar Money: back to the welcome page"
          className="hidden min-h-11 shrink-0 items-center gap-2 py-3 sm:flex"
        >
          <LogoMark className="size-6 text-burgundy" />
          <span className="font-heading text-lg font-semibold tracking-tight text-burgundy">Molar Money</span>
        </Link>
        <nav aria-label="Main" className="-mx-1 flex flex-1 gap-3 overflow-x-auto px-1 [scrollbar-width:none] sm:gap-5 [&::-webkit-scrollbar]:hidden">
          {NAV_ITEMS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }: { isActive: boolean }) =>
                cn(
                  "inline-flex min-h-[54px] min-w-11 shrink-0 items-center justify-center border-b-2 px-1 text-sm font-medium transition-colors",
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
