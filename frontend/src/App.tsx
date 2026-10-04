import type { ReactNode } from 'react'
import { Route, Routes } from 'react-router'
import { useAuth } from '@clerk/react'
import { SessionProvider } from '@/state/SessionContext'
import { Shell } from '@/components/shell/Shell'
import { PlaceholderPage } from '@/components/shell/PlaceholderPage'
import RequireClerk from '@/components/auth/RequireClerk'
import HomePage from '@/pages/Home/HomePage'
import PlansPage from '@/pages/Plans/PlansPage'
import FamilyPage from '@/pages/Family/FamilyPage'
import CostsPage from '@/pages/Costs/CostsPage'
import PlanYearPage from '@/pages/PlanYear/PlanYearPage'
import AssistantPage from '@/pages/Assistant/AssistantPage'
import LoginPage from '@/pages/Login/LoginPage'
import SignupPage from '@/pages/Signup/SignupPage'
import ChooseProfilePage from '@/pages/ChooseProfile/ChooseProfilePage'
import StyleGuide from '@/pages/StyleGuide'
import Landing from '@/pages/Landing'

// Routes: /, /plans, /family, /costs, /plan-year, /assistant. /welcome is the public landing page.
// Sign-in: /login and /signup (Clerk), then /choose-profile (pick your household profile).
// The app pages and /choose-profile need a Clerk sign-in.
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/welcome" element={<Landing />} />
      {/* Wildcard: Clerk moves through sub-steps like /login/factor-one and /signup/verify-email-address */}
      <Route path="/login/*" element={<LoginPage />} />
      <Route path="/signup/*" element={<SignupPage />} />
      <Route element={<RequireClerk />}>
        <Route path="/choose-profile" element={<ChooseProfilePage />} />
        <Route element={<Shell />}>
          <Route index element={<HomePage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="family" element={<FamilyPage />} />
          <Route path="costs" element={<CostsPage />} />
          <Route path="plan-year" element={<PlanYearPage />} />
          <Route path="assistant" element={<AssistantPage />} />
          <Route path="style" element={<StyleGuide />} />
          <Route
            path="*"
            element={<PlaceholderPage title="Page not found">That page does not exist. Use the menu above.</PlaceholderPage>}
          />
        </Route>
      </Route>
    </Routes>
  )
}

// The household session follows the Clerk user: it starts over when they sign in, sign out
// or switch accounts (key), and sends their Clerk token when a profile is picked.
function ClerkSession({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth()
  return (
    <SessionProvider key={userId ?? 'signed-out'} paused={!isLoaded || !isSignedIn} getAuthToken={() => getToken()}>
      {children}
    </SessionProvider>
  )
}

export default function App() {
  return (
    <ClerkSession>
      <AppRoutes />
    </ClerkSession>
  )
}
