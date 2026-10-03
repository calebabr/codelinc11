import { useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router'
import { Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserProvider } from '@/state/UserContext'
import { ProfileSwitcher } from '@/components/ProfileSwitcher'
import { ChatPanel } from '@/components/ChatPanel'
import GetStarted from '@/pages/GetStarted'
import Home from '@/pages/Home'
import Coverage from '@/pages/Coverage'
import Estimate from '@/pages/Estimate'
import PlanYear from '@/pages/PlanYear'
import StyleGuide from '@/pages/StyleGuide'
import { Dashboard } from '@/pages/Dashboard'
import { Chatbot } from '@/pages/Chatbot'
import { Profiles } from '@/pages/Profiles'

const links = [
  { to: '/', label: 'Home' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/coverage', label: 'My Coverage' },
  { to: '/estimate', label: 'Estimate' },
  { to: '/plan-year', label: 'Plan My Year' },
  { to: '/chatbot', label: 'Chatbot' },
  { to: '/profiles', label: 'Profiles' },
]

function Shell() {
  const navigate = useNavigate()
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:py-4">
          <NavLink to="/" className="flex items-center gap-2">
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
          <Route path="/" element={<Padded><Home /></Padded>} />
          <Route path="/dashboard" element={<Dashboard onOpenChat={() => navigate('/chatbot')} />} />
          <Route path="/coverage" element={<Padded><Coverage /></Padded>} />
          <Route path="/estimate" element={<Padded><Estimate /></Padded>} />
          <Route path="/plan-year" element={<Padded><PlanYear /></Padded>} />
          <Route path="/chatbot" element={<Chatbot />} />
          <Route path="/profiles" element={<Profiles />} />
          <Route path="/get-started" element={<Padded><GetStarted /></Padded>} />
          <Route path="/style" element={<Padded><StyleGuide /></Padded>} />
        </Routes>
      </main>

      {/* Floating assistant button + drawer, available on every page */}
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
  )
}

function Padded({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-5xl px-4 py-10">{children}</div>
}

export default function App() {
  return (
    <UserProvider>
      <Shell />
    </UserProvider>
  )
}
