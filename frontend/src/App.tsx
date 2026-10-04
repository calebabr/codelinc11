import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { SessionProvider } from '@/state/SessionContext'
import { Shell } from '@/components/shell/Shell'
import { PlaceholderPage } from '@/components/shell/PlaceholderPage'
import HomePage from '@/pages/Home/HomePage'
import FamilyPage from '@/pages/Family/FamilyPage'
import { PageLoading } from '@/components/shell/PageLoading'
import LoginPage from '@/pages/Login/LoginPage'

// Heavy and public pages load on demand so the first load on a phone stays small.
const Landing = lazy(() => import('@/pages/Landing'))
const JoinPage = lazy(() => import('@/pages/Join/JoinPage'))
const StyleGuide = lazy(() => import('@/pages/StyleGuide'))
const PlansPage = lazy(() => import('@/pages/Plans/PlansPage'))
const CostsPage = lazy(() => import('@/pages/Costs/CostsPage'))
const PlanYearPage = lazy(() => import('@/pages/PlanYear/PlanYearPage'))
const NotificationsPage = lazy(() => import('@/pages/Notifications/NotificationsPage'))
const ProvidersPage = lazy(() => import('@/pages/Providers/ProvidersPage'))
const ReportsPage = lazy(() => import('@/pages/Reports/ReportsPage'))
const ReportsAskPage = lazy(() => import('@/pages/Reports/ReportsAskPage'))
const AssistantPage = lazy(() => import('@/pages/Assistant/AssistantPage'))

// Routes: /, /plans, /family, /costs, /plan-year, /providers, /reports (and /reports/ask), /assistant. /login is the demo sign-in. /welcome is the public landing page.
// eslint-disable-next-line react-refresh/only-export-components
export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoading />}>
    <Routes>
      <Route path="/welcome" element={<Landing />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route element={<Shell />}>
        <Route index element={<HomePage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="family" element={<FamilyPage />} />
        <Route path="costs" element={<CostsPage />} />
        <Route path="plan-year" element={<PlanYearPage />} />
        <Route path="providers" element={<ProvidersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/ask" element={<ReportsAskPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="style" element={<StyleGuide />} />
        <Route
          path="*"
          element={<PlaceholderPage title="Page not found">That page does not exist. Use the menu above.</PlaceholderPage>}
        />
      </Route>
    </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <AppRoutes />
    </SessionProvider>
  )
}
