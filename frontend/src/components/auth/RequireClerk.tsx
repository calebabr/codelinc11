import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@clerk/react'

// Route guard: signed-out visitors go to /login, and Clerk brings them back afterwards (redirect_url)
export default function RequireClerk() {
  const { isLoaded, isSignedIn } = useAuth()
  const location = useLocation()
  if (!isLoaded) {
    return (
      <div className="mx-auto max-w-md p-8" role="status">
        Loading…
      </div>
    )
  }
  if (!isSignedIn) return <Navigate to={`/login?redirect_url=${encodeURIComponent(location.pathname)}`} replace />
  return <Outlet />
}
