import { Link } from "react-router"
import { useSession } from "@/state/SessionContext"
import { MemberSwitcher } from "./MemberSwitcher"

// Slim burgundy bar above the main nav: household name, member switcher, sign-in state.
export function UtilityBar() {
  const { household, account, signOut } = useSession()
  return (
    <div className="bg-burgundy pt-[env(safe-area-inset-top)] text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-1 text-xs">
        <span className="truncate font-medium" data-testid="household-label">
          {household.name}
          <span className="font-normal text-white/80" data-testid="plan-label">
            {" "}· {household.plan_tier.name} plan
          </span>
        </span>
        <div className="flex items-center gap-3">
          <MemberSwitcher />
          {account ? (
            <button type="button" onClick={signOut} className="hidden min-h-11 items-center underline-offset-2 hover:underline sm:inline-flex">
              Sign out
            </button>
          ) : (
            <Link to="/login" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
