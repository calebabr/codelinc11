import { useNavigate } from "react-router"
import { EXPIRED_MESSAGE, NO_ROUTE_MESSAGE, SIGNIN_MESSAGE } from "@/lib/api/planYear"
import { useSessionGate } from "@/state/SessionContext"

/** A button that leaves a dead session: forget the expired family (if asked), sign out, go to the sign-in page. */
function SignInAgain({ label, forget }: { label: string; forget: boolean }) {
  const gate = useSessionGate()
  const navigate = useNavigate()
  return (
    <button
      type="button"
      className="btn btn-orange mt-2"
      onClick={() => {
        void (async () => {
          if (forget) await gate.forgetFamily()
          gate.session?.signOut()
          navigate("/login")
        })()
      }}
    >
      {label}
    </button>
  )
}

/**
 * An error message with the right way out. An expired demo family or a timed-out sign-in gets a button to the
 * sign-in page; a route the server does not have gets no retry button; anything else gets "Try again" when
 * `onRetry` is given. The message is the one the API client already made plain.
 */
export function ErrorNote({ message, onRetry, className = "note" }: { message: string; onRetry?: () => void; className?: string }) {
  const expired = message === EXPIRED_MESSAGE
  const signin = message === SIGNIN_MESSAGE
  const noRoute = message === NO_ROUTE_MESSAGE
  return (
    <div role="alert" className={className}>
      <p>{message}</p>
      {expired && <SignInAgain label="Start a new demo family" forget />}
      {signin && <SignInAgain label="Sign in again" forget={false} />}
      {!expired && !signin && !noRoute && onRetry && (
        <button type="button" className="btn btn-outline mt-2" onClick={onRetry}>Try again</button>
      )}
    </div>
  )
}
