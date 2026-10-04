// Clerk sign-in (decision D2: real login). Clerk proves who the person is; the household
// profile they then pick still comes from our backend (SessionContext).
// Only the publishable key lives in the frontend. The secret key is backend-only.

import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ClerkProvider } from '@clerk/react'
import { shadcn } from '@clerk/ui/themes'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

// Clerk's forms read our shadcn tokens (colors, radius, fonts) through the shadcn theme. Clerk's CSS
// goes in the "clerk" layer (ordered below Tailwind utilities in index.css), so our classes win.
const appearance = { theme: shadcn, cssLayerName: 'clerk' }

export default function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  if (!PUBLISHABLE_KEY) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="max-w-md text-lg">
          Sign-in isn’t set up yet. Add <code className="font-mono">VITE_CLERK_PUBLISHABLE_KEY</code> to{' '}
          <code className="font-mono">frontend/.env.local</code> and restart <code className="font-mono">npm run dev</code>.
        </p>
      </div>
    )
  }

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      // Move between Clerk screens with our router instead of full page loads
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/login"
      signUpUrl="/signup"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      afterSignOutUrl="/welcome"
      appearance={appearance}
    >
      {children}
    </ClerkProvider>
  )
}
