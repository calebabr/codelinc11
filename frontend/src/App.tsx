import { useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router'
import { Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import RequireAuth from '@/components/auth/RequireAuth'
import Landing from '@/pages/Landing'
import Login from '@/pages/Login'
import Signup from '@/pages/Signup'
import { UserProvider } from '@/state/UserContext'
import { ProfileSwitcher } from '@/components/ProfileSwitcher'
import { ChatPanel } from '@/components/ChatPanel'
import { Dashboard } from '@/pages/Dashboard'
import { Chatbot } from '@/pages/Chatbot'
import { Profiles } from '@/pages/Profiles'
import Coverage from '@/pages/Coverage'
import Estimate from '@/pages/Estimate'
import PlanYear from '@/pages/PlanYear'

// Nav for the signed-in app. Paths are relative to /app.
const links = [
  { to: '/app', label: 'Dashboard' },
  { to: '/app/coverage', label: 'My Coverage' },
  { to: '/app/estimate', label: 'Estimate' },
  { to: '/app/plan-year', label: 'Plan My Year' },
  { to: '/app/chatbot', label: 'Chatbot' },
  { to: '/app/profiles', label: 'Profiles' },
]

// The authenticated application: nav, profile switcher, chat drawer, screens.
function AppShell() {
  const navigate = useNavigate()
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <UserProvider>
      <div className="min-h-screen">
        <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:py-4">
            <NavLink to="/app" className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-primary" aria-hidden />
              <span className="font-heading text-xl font-semibold tracking-tight">
                Plan Coverage Explainer
              </span>
            </NavLink>

            <nav className="-mx-4 flex gap-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end
                  className={({ isActive }: { isActive: boolean }) =>
                    cn(
                      'shrink-0 border-b-2 pb-3 text-sm font-medium transition-colors sm:pb-1',
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>

            <div className="hidden sm:block">
              <ProfileSwitcher />
            </div>
          </div>
        </header>

        <main>
          <Routes>
            <Route index element={<Dashboard onOpenChat={() => navigate('/app/chatbot')} />} />
            <Route path="coverage" element={<Padded><Coverage /></Padded>} />
            <Route path="estimate" element={<Padded><Estimate /></Padded>} />
            <Route path="plan-year" element={<Padded><PlanYear /></Padded>} />
            <Route path="chatbot" element={<Chatbot />} />
            <Route path="profiles" element={<Profiles />} />
          </Routes>
        </main>

        {/* Floating assistant button + drawer, available on every app page */}
        {!chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-transform hover:scale-105"
            aria-label="Open assistant"
          >
            <Sparkles className="size-5" />
            <span className="hidden text-sm font-medium sm:inline">Ask the assistant</span>
          </button>
        )}

        {chatOpen && (
          <div
            className="fixed inset-0 z-40 flex justify-end bg-ink/30"
            onClick={() => setChatOpen(false)}
          >
            <div className="h-full w-full max-w-md p-3 sm:p-4" onClick={(e) => e.stopPropagation()}>
              <div className="relative h-full">
                <button
                  onClick={() => setChatOpen(false)}
                  className="absolute -left-3 top-2 z-10 flex size-7 items-center justify-center rounded-full bg-background text-foreground shadow ring-1 ring-foreground/10"
                  aria-label="Close assistant"
                >
                  <X className="size-4" />
                </button>
                <ChatPanel />
              </div>
            </div>
          </div>
        )}
      </div>
    </UserProvider>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      {/* Wildcard: Clerk moves through sub-steps like /login/factor-one and /signup/verify-email-address */}
      <Route path="/login/*" element={<Login />} />
      <Route path="/signup/*" element={<Signup />} />
      <Route
        path="/app/*"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      />
    </Routes>
  )
}

function Padded({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-5xl px-4 py-10">{children}</div>
}
