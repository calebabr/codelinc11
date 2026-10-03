import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ClerkProvider } from '@clerk/react'
import { shadcn } from '@clerk/ui/themes'

// Publishable key only (safe for the browser). The secret key never goes in the frontend.
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

// Clerk's components use our shadcn tokens + brand. Clerk's CSS sits in the "clerk" layer
// (ordered before Tailwind utilities in index.css), so Tailwind classes in `elements` win.
const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  variables: {
    colorPrimary: '#6b0f2a',
    colorPrimaryForeground: '#ffffff',
    colorForeground: '#1c0a12',
    colorMutedForeground: '#4b5563',
    colorDanger: '#b42318',
    colorRing: '#6b0f2a',
    fontFamily: "'Manrope Variable', system-ui, sans-serif",
    borderRadius: '0.75rem',
  },
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  if (!PUBLISHABLE_KEY) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blush p-6 text-center">
        <p className="max-w-md text-lg">
          Sign-in isn’t set up yet. Add <code className="font-mono text-primary">VITE_CLERK_PUBLISHABLE_KEY</code> to{' '}
          <code className="font-mono">frontend/.env.local</code> and restart <code className="font-mono">npm run dev</code>.
        </p>
      </div>
    )
  }

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      // Let Clerk move between screens with our router instead of full page loads
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/login"
      signUpUrl="/signup"
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
      afterSignOutUrl="/"
      appearance={appearance}
    >
      {children}
    </ClerkProvider>
  )
}
