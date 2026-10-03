import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@clerk/react'

// Sends signed-out visitors to /login; Clerk brings them back here (redirect_url) after they sign in
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const location = useLocation()
  if (!isLoaded) return null
  if (!isSignedIn) return <Navigate to={`/login?redirect_url=${encodeURIComponent(location.pathname)}`} replace />
  return children
}
