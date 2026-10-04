// One tap into the demo. Signs in as the account holder in a brand-new demo family, with no
// further choices. A visitor who already has a demo family sees "Continue your demo family".
// Used on the landing page (hero and nav) and at the top of /login. No sign-up, email or password.

import { useState } from "react"
import { useNavigate } from "react-router"
import { ArrowRight } from "lucide-react"
import { errorMessage } from "@/lib/api/planYear"
import { cn } from "@/lib/utils"
import { useSessionGate } from "@/state/SessionContext"

export default function TryDemoButton({
  className,
  errorClassName,
  wrapperClassName,
  showArrow = true,
}: {
  className?: string
  wrapperClassName?: string
  errorClassName?: string
  showArrow?: boolean
}) {
  const gate = useSessionGate()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setBusy(true)
    setError(null)
    try {
      if (gate.hasFamily) {
        // Back into the family this browser remembers (the account holder).
        if (gate.status !== "ready") {
          const primary = gate.accounts.find((a) => a.role === "primary")
          if (!primary) {
            navigate("/login")
            return
          }
          await gate.signIn(primary.member_id)
        }
      } else {
        await gate.tryDemo()
      }
      navigate("/")
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const label = gate.hasFamily ? "Continue your demo family" : "Try the demo"
  return (
    <span className={cn("inline-flex flex-col items-start gap-2", wrapperClassName)}>
      <button
        type="button"
        onClick={() => void go()}
        disabled={busy}
        className={cn(
          "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-orange-dark px-7 text-base font-bold text-white transition-colors hover:bg-[#b83208] disabled:opacity-70",
          className,
        )}
      >
        {busy ? "Getting your demo ready…" : label}
        {showArrow && !busy && <ArrowRight className="size-4" aria-hidden />}
      </button>
      {error && (
        <span role="alert" className={cn("max-w-xs text-sm text-primary", errorClassName)}>
          {error}
        </span>
      )}
    </span>
  )
}
