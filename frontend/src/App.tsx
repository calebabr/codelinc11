import { Route, Routes } from 'react-router'
import { SessionProvider } from '@/state/SessionContext'
import { Shell } from '@/components/shell/Shell'
import { PlaceholderPage } from '@/components/shell/PlaceholderPage'
import HomePage from '@/pages/Home/HomePage'
import PlansPage from '@/pages/Plans/PlansPage'
import FamilyPage from '@/pages/Family/FamilyPage'
import CostsPage from '@/pages/Costs/CostsPage'
import PlanYearPage from '@/pages/PlanYear/PlanYearPage'
import AssistantPage from '@/pages/Assistant/AssistantPage'
import StyleGuide from '@/pages/StyleGuide'

// Routes: /, /plans, /family, /costs, /plan-year, /assistant. /login is reserved for the sign-in UI.
// eslint-disable-next-line react-refresh/only-export-components
export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <div className="mx-auto max-w-md p-8">
            <PlaceholderPage title="Sign in">Sign-in is coming soon.</PlaceholderPage>
          </div>
        }
      />
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
    </Routes>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <AppRoutes />
    </SessionProvider>
  )
}
