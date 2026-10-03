import type { ReactNode } from 'react'
import { ChatDrawer } from '@/components/ChatDrawer'
import type { Page } from '@/lib/nav'

const NAV: { page: Page; label: string }[] = [
  { page: 'setup', label: 'My Plan' },
  { page: 'estimate', label: 'Estimate' },
  { page: 'quote', label: 'Dentist Quote' },
  { page: 'plan-year', label: 'Plan My Year' },
  { page: 'benefits', label: 'My Benefits' },
]

export function AppShell({
  page,
  onNavigate,
  children,
}: {
  page: Page
  onNavigate: (p: Page) => void
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-2 self-start text-left"
            aria-label="Dental Benefits Copilot home"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-lg text-white" aria-hidden="true">
              🦷
            </span>
            <span className="text-lg font-bold text-brand">Dental Benefits Copilot</span>
          </button>
          <nav aria-label="Main" className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {NAV.map((n) => (
              <button
                key={n.page}
                type="button"
                onClick={() => onNavigate(n.page)}
                aria-current={page === n.page ? 'page' : undefined}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  page === n.page
                    ? 'border-brand-orange text-brand'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {n.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 pb-28">{children}</main>
      <ChatDrawer />
    </div>
  )
}

export function PageHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-bold tracking-tight text-brand sm:text-3xl">{title}</h1>
      {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
    </div>
  )
}
