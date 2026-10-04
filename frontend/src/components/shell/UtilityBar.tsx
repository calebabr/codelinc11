import { useClerk } from "@clerk/react"
import { useSession } from "@/state/SessionContext"
import { MemberSwitcher } from "./MemberSwitcher"

// Slim burgundy bar above the main nav: household name, member switcher, sign-in state.
export function UtilityBar() {
  const { household, signOut: switchProfile } = useSession()
  const { signOut } = useClerk()
  return (
    <div className="bg-burgundy text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-1.5 text-xs">
        <span className="truncate font-medium" data-testid="household-label">
          {household.name}
          <span className="font-normal text-white/80" data-testid="plan-label">
            {" "}· {household.plan_tier.name} plan
          </span>
        </span>
        <div className="flex items-center gap-3">
          <MemberSwitcher />
          {/* Back to "Who's using bitewise?" without leaving the Clerk account */}
          <button type="button" onClick={switchProfile} className="hidden underline-offset-2 hover:underline sm:inline">
            Switch profile
          </button>
          <button
            type="button"
            onClick={() => void signOut({ redirectUrl: "/welcome" })}
            className="underline-offset-2 hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
