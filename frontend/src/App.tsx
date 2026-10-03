import { useState } from 'react'
import { AppShell } from '@/components/AppShell'
import type { Page } from '@/lib/nav'
import { Benefits } from '@/pages/Benefits'
import { Estimate } from '@/pages/Estimate'
import { Landing } from '@/pages/Landing'
import { PlanYear } from '@/pages/PlanYear'
import { Setup } from '@/pages/Setup'
import { TreatmentPlan } from '@/pages/TreatmentPlan'
import { PlanProvider } from '@/state/PlanContext'

function Pages({ page, navigate }: { page: Page; navigate: (p: Page) => void }) {
  if (page === 'landing') return <Landing onNavigate={navigate} />
  return (
    <AppShell
      page={page}
      onNavigate={(p) => {
        navigate(p)
        window.scrollTo?.(0, 0)
      }}
    >
      {page === 'setup' && <Setup onNavigate={navigate} />}
      {page === 'estimate' && <Estimate />}
      {page === 'quote' && <TreatmentPlan onNavigate={navigate} />}
      {page === 'plan-year' && <PlanYear />}
      {page === 'benefits' && <Benefits />}
    </AppShell>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>('landing')
  return (
    <PlanProvider>
      <Pages page={page} navigate={setPage} />
    </PlanProvider>
  )
}
